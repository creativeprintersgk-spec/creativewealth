/**
 * full_import_mprofit.ts
 * ──────────────────────────────────────────────────────────────
 * Definitive MProfit CSV → Supabase import script.
 *
 * Steps:
 *   1. Clear all mock data (keeps: asset_master, groups)
 *   2. Create family "SHAH FAMILY"
 *   3. Create accounts from PFolioType=10 portfolios
 *   4. Create investment portfolios (linked to accounts by name inference)
 *   5. Create ledgers from ACMA1.csv
 *   6. Create virtual asset ledgers (MAID refs in Trans1 where EXTID=-1)
 *   7. Create virtual broker ledgers (MAID refs where EXTID=-5)
 *   8. Import vouchers from Vouchers1.csv
 *   9. Import entries from Trans1.csv
 *  10. Compute & import Capital Gains (FIFO) from BS1.csv
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

// ─────────────────── Helpers ───────────────────────────────────

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) { resolve([]); return; }
    fs.createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', (d) => rows.push(d))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function upsertBatch(table: string, rows: any[], batchSize = 500) {
  if (rows.length === 0) { console.log(`  ⏭  ${table}: 0 rows, skipping`); return; }
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`  ❌ ${table} batch [${i}–${i + batch.length}]:`, error.message);
    }
  }
  console.log(`  ✅ ${table}: ${rows.length} rows`);
}

async function upsertBatchNoId(table: string, rows: any[], batchSize = 500) {
  if (rows.length === 0) { console.log(`  ⏭  ${table}: 0 rows, skipping`); return; }
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ❌ ${table} batch [${i}–${i + batch.length}]:`, error.message);
    }
  }
  console.log(`  ✅ ${table}: ${rows.length} rows`);
}

// MProfit PARENT_ID (group codes in ACMA1) → Supabase group_id
const PARENT_TO_GROUP: Record<string, string> = {
  '1':      'capital_account',
  '2':      'loans_liability',
  '45':     'property',
  '50':     'stocks',
  '55':     'current_assets',
  '60':     'bank_accounts',
  '64':     'capital_account',
  '65':     'capital_account',
  '90':     'brokers',
  '155':    'other_income',
  '160':    'other_expense',
  '200075': 'jewellery',
  '200120': 'ppf_epf',
};

// MProfit VTYP → Supabase voucher type
const VTYP_MAP: Record<string, string> = {
  '1': 'payment',
  '2': 'receipt',
  '3': 'journal',
  '4': 'contra',
  '5': 'journal',
  '6': 'contra',
  '7': 'journal',
  '8': 'journal',
  '9': 'journal',
  '10': 'receipt',
  '11': 'payment',
  '12': 'journal',
};

// asset_type code → Supabase group_id
function assetTypeToGroup(assetType: number): string {
  if (assetType === 50)  return 'stocks';
  if (assetType === 60)  return 'mf_equity';
  if (assetType === 65)  return 'mf_debt';
  if (assetType === 70)  return 'mf_equity';
  if (assetType === 110) return 'fds';
  if (assetType === 100) return 'traded_bonds';
  if (assetType === 130) return 'gold';
  if (assetType === 140) return 'silver';
  if (assetType === 200) return 'ppf_epf';
  if (assetType === 150) return 'insurance_asset';
  if (assetType === 300) return 'aif';
  return 'stocks';
}

// Infer account_id from portfolio InvestorName / FullName
function inferAccountId(pf: any): string {
  const name = `${pf.InvestorName || ''} ${pf.FullName || ''}`.toLowerCase();
  if (name.includes('arjin'))                             return 'acc_61';
  if (name.includes('krisha') || name.includes('kss'))   return 'acc_36';
  if (name.includes('saahil huf') || name.includes('sps huf')) return 'acc_62';
  if (name.includes('saahil'))                            return 'acc_31';
  if (name.includes('unnati'))                            return 'acc_29';
  if (name.includes('huf'))                               return 'acc_32';
  if (name.includes('pramesh') || name.includes('prs'))  return 'acc_30';
  return 'acc_30'; // default → Pramesh
}

// ─────────────────── Main ──────────────────────────────────────

async function runImport() {
  console.log('\n🚀  FULL MPROFIT IMPORT STARTED\n' + '='.repeat(50));

  // ═══ STEP 1: CLEAR MOCK DATA ═══════════════════════════════
  console.log('\n[1/10] Clearing existing mock data...');

  // Tables with text primary key → delete where id is not empty
  for (const table of ['entries', 'vouchers', 'tax_lots', 'prices', 'ledgers',
                        'investor_groups', 'portfolios', 'accounts', 'families']) {
    const { error } = await supabase.from(table).delete().neq('id', '__never__');
    if (error) console.warn(`    ⚠  ${table}: ${error.message}`);
    else console.log(`    🗑  ${table} cleared`);
  }
  // capital_gains_summary has no text id — delete by any numeric field
  const { error: cgErr } = await supabase
    .from('capital_gains_summary')
    .delete()
    .neq('amid', -999999);
  if (cgErr) console.warn(`    ⚠  capital_gains_summary: ${cgErr.message}`);
  else console.log('    🗑  capital_gains_summary cleared');

  // ═══ STEP 2: LOAD CSVS ══════════════════════════════════════
  console.log('\n[2/10] Loading CSV files...');
  const portfoliosRaw = await parseCSV('Portfolios.csv');
  const acma          = await parseCSV('ACMA1.csv');
  const vouchersRaw   = await parseCSV('Vouchers1.csv');
  const trans         = await parseCSV('Trans1.csv');
  console.log(`    Portfolios: ${portfoliosRaw.length}, ACMA1: ${acma.length}`);
  console.log(`    Vouchers:   ${vouchersRaw.length}, Trans: ${trans.length}`);

  // ═══ STEP 3: FAMILY ══════════════════════════════════════════
  console.log('\n[3/10] Creating family...');
  const { error: famErr } = await supabase.from('families').upsert({ id: 'shah_family', name: 'SHAH FAMILY' });
  if (famErr) console.error('  ❌ family:', famErr.message);
  else console.log('  ✅ SHAH FAMILY created');

  // ═══ STEP 4: ACCOUNTS ════════════════════════════════════════
  console.log('\n[4/10] Creating accounts...');
  // Account-level portfolios (PFolioType=10) represent individual investors
  const accountPortfolios = portfoliosRaw.filter(p => p.PFolioType === '10' && p.IsGroup !== '1');
  // Build ACID → account_id map (used for linking vouchers / entries)
  const acidToAccountId: Record<string, string> = {};
  for (const ap of accountPortfolios) {
    acidToAccountId[ap.ID] = `acc_${ap.ID}`;
  }

  const accountRows = accountPortfolios.map(ap => ({
    id: `acc_${ap.ID}`,
    family_id: 'shah_family',
    account_name: (ap.FullName || ap.InvestorName || `Account ${ap.ID}`).trim(),
    pan: ap.PAN ? ap.PAN.toUpperCase() : null,
  }));
  await upsertBatch('accounts', accountRows);

  // ═══ STEP 5: PORTFOLIOS ══════════════════════════════════════
  console.log('\n[5/10] Creating portfolios...');
  const investmentPortfolios = portfoliosRaw.filter(
    p => p.IsGroup !== '1' && p.PFolioType !== '10'
  );
  const portfolioRows = investmentPortfolios.map(pf => ({
    id: `pf_${pf.ID}`,
    account_id: inferAccountId(pf),
    portfolio_name: (pf.InvestorName || `Portfolio ${pf.ID}`).trim(),
    broker: null,
  }));
  await upsertBatch('portfolios', portfolioRows);

  // ═══ STEP 6: ENSURE REQUIRED GROUPS ═════════════════════════
  console.log('\n[6/10] Ensuring required groups exist...');
  const extraGroups = [
    { id: 'bank_accounts',   name: 'Bank Accounts',        parent_id: 'current_assets', type: 'ASSET' },
    { id: 'brokers',         name: 'Brokers',              parent_id: 'current_assets', type: 'ASSET' },
    { id: 'loans_liability', name: 'Loans & Liabilities',  parent_id: null,             type: 'LIABILITY' },
    { id: 'capital_account', name: 'Capital Account',      parent_id: null,             type: 'LIABILITY' },
    { id: 'property',        name: 'Property',             parent_id: null,             type: 'ASSET' },
    { id: 'current_assets',  name: 'Current Assets',       parent_id: null,             type: 'ASSET' },
    { id: 'other_income',    name: 'Other Income',         parent_id: null,             type: 'INCOME' },
    { id: 'other_expense',   name: 'Other Expense',        parent_id: null,             type: 'EXPENSE' },
    { id: 'jewellery',       name: 'Jewellery',            parent_id: null,             type: 'ASSET' },
    { id: 'ppf_epf',         name: 'PPF & EPF',            parent_id: null,             type: 'ASSET' },
    { id: 'mf_equity',       name: 'Equity Mutual Funds',  parent_id: null,             type: 'ASSET' },
    { id: 'mf_debt',         name: 'Debt Mutual Funds',    parent_id: null,             type: 'ASSET' },
    { id: 'fds',             name: 'Fixed Deposits',       parent_id: null,             type: 'ASSET' },
    { id: 'traded_bonds',    name: 'Traded Bonds',         parent_id: null,             type: 'ASSET' },
    { id: 'silver',          name: 'Silver',               parent_id: null,             type: 'ASSET' },
    { id: 'insurance_asset', name: 'Insurance',            parent_id: null,             type: 'ASSET' },
    { id: 'aif',             name: 'AIF',                  parent_id: null,             type: 'ASSET' },
  ];
  for (const g of extraGroups) {
    const { error } = await supabase.from('groups').upsert(g, { onConflict: 'id' });
    if (error && !error.message.includes('duplicate')) {
      console.warn(`  ⚠  group ${g.id}: ${error.message}`);
    }
  }
  console.log('  ✅ Required groups ensured');

  // ═══ STEP 7: ACMA LEDGERS ════════════════════════════════════
  console.log('\n[7/10] Creating ACMA1 ledgers...');
  const acmaIds = new Set(acma.map(a => a.ID));
  const acmaLedgerRows = acma.map(a => ({
    id: `ldgr_acma_${a.ID}`,
    group_id: PARENT_TO_GROUP[a.PARENT_ID] || 'other_expense',
    name: a.NAME || `Ledger ${a.ID}`,
    opening_balance: 0,
    opening_type: 'DR',
    amid: null,
  }));
  await upsertBatch('ledgers', acmaLedgerRows);

  // ═══ STEP 8: VIRTUAL LEDGERS (from Trans1) ═══════════════════
  console.log('\n[8/10] Building virtual ledgers from Trans1.csv...');

  const assetMaids   = new Set<string>();
  const brokerMaids  = new Set<string>();
  const otherMaids   = new Set<string>();

  for (const t of trans) {
    if (!acmaIds.has(t.MAID)) {
      if      (t.EXTID === '-1') assetMaids.add(t.MAID);
      else if (t.EXTID === '-5') brokerMaids.add(t.MAID);
      else                        otherMaids.add(t.MAID);
    }
  }

  // Fetch asset metadata from asset_master
  const assetMaidNums = Array.from(assetMaids).map(Number).filter(n => !isNaN(n));
  const assetMeta = new Map<number, { name: string, asset_type: number, asset_type_name: string }>();
  for (let i = 0; i < assetMaidNums.length; i += 200) {
    const slice = assetMaidNums.slice(i, i + 200);
    const { data } = await supabase
      .from('asset_master')
      .select('amid, name, asset_type, asset_type_name')
      .in('amid', slice);
    data?.forEach(a => assetMeta.set(a.amid, {
      name: a.name,
      asset_type: a.asset_type,
      asset_type_name: a.asset_type_name,
    }));
  }

  const assetLedgerRows = assetMaidNums.map(amid => {
    const hasMeta = assetMeta.has(amid);
    const info = assetMeta.get(amid) || { name: `Asset ${amid}`, asset_type: 50, asset_type_name: 'Stocks' };
    return {
      id: `ldgr_asset_${amid}`,
      group_id: assetTypeToGroup(info.asset_type),
      name: info.name,
      opening_balance: 0,
      opening_type: 'DR',
      amid: hasMeta ? amid : null,
    };
  });
  await upsertBatch('ledgers', assetLedgerRows);

  const brokerLedgerRows = Array.from(brokerMaids).map(maid => ({
    id: `ldgr_broker_${maid}`,
    group_id: 'brokers',
    name: `Broker A/c ${maid}`,
    opening_balance: 0,
    opening_type: 'DR',
    amid: null,
  }));
  await upsertBatch('ledgers', brokerLedgerRows);

  const otherLedgerRows = Array.from(otherMaids).map(maid => ({
    id: `ldgr_other_${maid}`,
    group_id: 'current_assets',
    name: `Misc A/c ${maid}`,
    opening_balance: 0,
    opening_type: 'DR',
    amid: null,
  }));
  await upsertBatch('ledgers', otherLedgerRows);

  // ═══ STEP 9: VOUCHERS ════════════════════════════════════════
  console.log('\n[9/10] Importing vouchers...');

  // Build set of valid portfolio IDs and account IDs for FK safety
  const validPortfolioIds = new Set(portfolioRows.map(p => p.id));
  const validAccountIds   = new Set(accountRows.map(a => a.id));

  const voucherRows = vouchersRaw.map(v => {
    const pfid = v.PFID && v.PFID.trim() !== '' ? `pf_${v.PFID.trim()}` : null;
    const acid = v.ACID && v.ACID.trim() !== '' ? v.ACID.trim() : null;
    const accountId = acid && acidToAccountId[acid] ? acidToAccountId[acid] : null;

    return {
      id: `v_${v.VID}`,
      date: v.DT ? v.DT.split(' ')[0] : null,
      type: VTYP_MAP[v.VTYP] || 'journal',
      voucher_no: String(v.VID),
      fy: '',
      narration: (v.NARR || '').slice(0, 500),
      account_id:   accountId && validAccountIds.has(accountId) ? accountId : null,
      portfolio_id: pfid && validPortfolioIds.has(pfid) ? pfid : null,
    };
  }).filter(v => v.date !== null && v.date !== '');

  // Add virtual vouchers for opening balance entries (VID = 0) to ensure they are imported
  const openingAcids = new Set<string>();
  for (const t of trans) {
    if (t.VID === '0' && t.ACID && t.ACID.trim() !== '') {
      openingAcids.add(t.ACID.trim());
    }
  }

  openingAcids.forEach(acid => {
    const accountId = acidToAccountId[acid];
    if (accountId && validAccountIds.has(accountId)) {
      voucherRows.push({
        id: `v_0_${acid}`,
        date: '2019-04-01', // Standard opening date for FY 2019-2020
        type: 'journal',
        voucher_no: '0',
        fy: '2019-2020',
        narration: 'Opening Balance Voucher',
        account_id: accountId,
        portfolio_id: null
      });
    }
  });

  await upsertBatch('vouchers', voucherRows, 500);

  // ═══ STEP 10: ENTRIES ════════════════════════════════════════
  console.log('\n[10/10] Importing entries...');

  // Build set of valid voucher IDs and ledger IDs
  const validVoucherIds = new Set(voucherRows.map(v => v.id));

  function ledgerId(maid: string, extid: string): string {
    if (acmaIds.has(maid))   return `ldgr_acma_${maid}`;
    if (extid === '-1')       return `ldgr_asset_${maid}`;
    if (extid === '-5')       return `ldgr_broker_${maid}`;
    return `ldgr_other_${maid}`;
  }

  const entryRows: any[] = [];
  for (const t of trans) {
    let vid = `v_${t.VID}`;
    if (t.VID === '0' && t.ACID && t.ACID.trim() !== '') {
      vid = `v_0_${t.ACID.trim()}`;
    }
    if (!validVoucherIds.has(vid)) continue; // skip orphaned entries

    entryRows.push({
      id:         `e_${t.TRANSID}`,
      voucher_id: vid,
      ledger_id:  ledgerId(t.MAID, t.EXTID),
      debit:      parseFloat(t.DRAMT) || 0,
      credit:     parseFloat(t.CRAMT) || 0,
      quantity:   0,
      price:      0,
      narration:  (t.Narr || '').slice(0, 200),
    });
  }
  await upsertBatch('entries', entryRows, 500);

  // ═══ STEP 11: MARKET PRICES (from MPrices.csv) ══════════════
  console.log('\n[11/11] Importing market prices (mprices)...');
  const mpricesRaw = await parseCSV('MPrices.csv');
  console.log(`    Parsed ${mpricesRaw.length} rows from MPrices.csv`);
  
  function formatCsvDate(d: string): string | null {
    if (!d) return null;
    const parts = d.trim().split('-');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  const mpriceRows = mpricesRaw.map(r => {
    const date = formatCsvDate(r.Date);
    return {
      source_id_atyp: Number(r.SourceID_ATYP) || 0,
      amid: Number(r.AMID) || 0,
      currp: r.CURRP && r.CURRP.trim() !== '' ? parseFloat(r.CURRP) : null,
      prevp: r.PREVP && r.PREVP.trim() !== '' ? parseFloat(r.PREVP) : null,
      date: date
    };
  }).filter(r => r.amid > 0 && r.date !== null);

  console.log(`    Clearing existing mprices...`);
  const { error: clearErr } = await supabase.from('mprices').delete().neq('row_id', -1);
  if (clearErr) {
    console.warn(`    ⚠  Could not clear mprices: ${clearErr.message}`);
  }

  console.log(`    Uploading ${mpriceRows.length} prices to mprices table...`);
  const BATCH_SIZE = 200;
  for (let i = 0; i < mpriceRows.length; i += BATCH_SIZE) {
    const chunk = mpriceRows.slice(i, i + BATCH_SIZE);
    const { error: insErr } = await supabase.from('mprices').insert(chunk);
    if (insErr) {
      console.error(`    ❌ Error inserting mprices batch [${i} to ${i + chunk.length}]:`, insErr.message);
    }
  }
  console.log('    ✅ mprices imported');

  // ═══ DONE ══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(50));
  console.log('✅  IMPORT COMPLETE!');
  console.log(`    Families:        1`);
  console.log(`    Accounts:        ${accountRows.length}`);
  console.log(`    Portfolios:      ${portfolioRows.length}`);
  console.log(`    ACMA Ledgers:    ${acmaLedgerRows.length}`);
  console.log(`    Asset Ledgers:   ${assetLedgerRows.length}`);
  console.log(`    Broker Ledgers:  ${brokerLedgerRows.length}`);
  console.log(`    Vouchers:        ${voucherRows.length}`);
  console.log(`    Entries:         ${entryRows.length}`);
  console.log(`    Market Prices:   ${mpriceRows.length}`);
  console.log('='.repeat(50) + '\n');
}

runImport().catch(console.error);

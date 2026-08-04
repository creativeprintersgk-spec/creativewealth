import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// We simulate the database initialization and BS calculation locally or query from DB.
// Let's write a simple BS generator exactly following the rules in src/logic.ts / src/services/balanceSheet.ts.
async function run() {
  const ACID = 31;
  const start = '2026-04-01';
  const end = '2027-03-31';
  console.log(`=== Calculating BS for Saahil (acid=${ACID}) for period ${start} to ${end} ===`);

  const { data: acmac1 } = await supabase.from('acmac1').select('*');
  const { data: transc1 } = await supabase.from('transc1').select('*');
  const { data: trans1 } = await supabase.from('trans1').select('*');
  const { data: vouchersc1 } = await supabase.from('vouchersc1').select('*');
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');

  // Let's find portfolios for this acid
  const saahilPortfolios = portfolios.filter(p => p.accountId === ACID || p.id === ACID);
  const saahilPflIds = saahilPortfolios.map(p => p.id);
  console.log(`Saahil Portfolios:`, saahilPortfolios.map(p => ({ id: p.id, name: p.investor_name })));

  // Deduplicate acmac1 as done in logic.ts
  const uniqueAcmac1 = [];
  const seenAcmac = new Set();
  for (const a of acmac1) {
    if (a.name === 'Difference in Opening Balances') continue;
    const key = `${a.id}_${a.acid}_${a.is_group}_${a.parent_id}_${a.name}_${a.special_type_id}`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      uniqueAcmac1.push(a);
    }
  }

  // Filter acmac1 by acid
  const filteredAcmac = uniqueAcmac1.filter(a => a.acid === ACID);
  const groups = filteredAcmac.filter(a => a.is_group);
  const ledgers = filteredAcmac.filter(a => !a.is_group);

  console.log(`Unique Acmac1 rows for acid=${ACID}: groups=${groups.length}, ledgers=${ledgers.length}`);

  // Create voucher maps
  const vchMap = new Map();
  vouchersc1.forEach(v => vchMap.set(`c_${v.vid}`, { ...v, _src: 'c' }));
  vouchers1.forEach(v => vchMap.set(`t_${v.vid}`, { ...v, _src: 't' }));

  // Collect entries
  const entries = [
    ...transc1.map(e => ({ ...e, _src: 'c' })),
    ...trans1.map(e => ({ ...e, _src: 't' }))
  ];

  // Map entries to their voucher and check if they belong to this account
  const accountEntries = entries.filter(e => {
    const v = vchMap.get(`${e._src}_${e.vid}`);
    const entryDate = e.dt || v?.dt;
    const entryAcid = e.acid || v?.acid;
    const entryPfid = v?.pfid;

    // Filter by date
    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    const dateOk = isOpeningBalance || entryDate <= end;
    if (!dateOk) return false;

    // Filter by account/portfolio
    const belongs = (entryAcid === ACID) || (entryPfid && saahilPflIds.includes(entryPfid));
    return belongs;
  });

  console.log(`Account entries within period (<= ${end}): ${accountEntries.length}`);

  // Group type helper
  function getGroupType(st) {
    if ([150, 40, 50, 125].includes(st)) return 'ASSET';
    if ([250, 275, 276].includes(st)) return 'LIABILITY';
    if (st === 280) return 'INCOME';
    if (st === 290) return 'EXPENSE';
    return 'ASSET';
  }

  function getLedgerGroupType(ledgerGroupId) {
    let current = groups.find(g => g.id === ledgerGroupId);
    while (current) {
      if (current.special_type_id) return getGroupType(current.special_type_id);
      current = groups.find(g => g.id === current.parent_id);
    }
    return 'ASSET';
  }

  // Calculate ledger balances
  const ledgerBalances = {};
  ledgers.forEach(l => {
    const type = getLedgerGroupType(l.parent_id);
    let dr = 0, cr = 0;
    accountEntries.forEach(e => {
      if (e.maid === l.id) {
        dr += Number(e.dramt) || 0;
        cr += Number(e.cramt) || 0;
      }
    });
    const balance = type === 'ASSET' ? dr - cr : cr - dr;
    ledgerBalances[l.id] = { ledger: l, type, dr, cr, balance };
  });

  // Calculate group totals
  function getGroupBalance(groupId) {
    let bal = 0;
    // ledgers direct children
    ledgers.forEach(l => {
      if (l.parent_id === groupId) {
        bal += ledgerBalances[l.id]?.balance || 0;
      }
    });
    // sub groups
    groups.forEach(g => {
      if (g.parent_id === groupId) {
        bal += getGroupBalance(g.id);
      }
    });
    return bal;
  }

  // Get root groups (parent_id = 0 or parent_id is not in the groups for this acid)
  const rootGroups = groups.filter(g => g.parent_id === 0 || !groups.some(p => p.id === g.parent_id));

  console.log('\nRoot Group Balances:');
  let totalAssets = 0, totalLiabilities = 0, totalIncome = 0, totalExpense = 0;
  rootGroups.forEach(g => {
    const bal = getGroupBalance(g.id);
    const type = getGroupType(g.special_type_id || 150);
    console.log(`  Name: ${g.name.padEnd(25)} Type: ${type.padEnd(10)} Balance: ${bal.toFixed(2)}`);
    if (type === 'ASSET') totalAssets += bal;
    else if (type === 'LIABILITY') totalLiabilities += bal;
    else if (type === 'INCOME') totalIncome += bal;
    else if (type === 'EXPENSE') totalExpense += bal;
  });

  const netProfit = totalIncome - totalExpense;
  console.log(`\nTotals:`);
  console.log(`  Total Assets:      ${totalAssets.toFixed(2)}`);
  console.log(`  Total Liabilities: ${totalLiabilities.toFixed(2)}`);
  console.log(`  Total Income:      ${totalIncome.toFixed(2)}`);
  console.log(`  Total Expense:     ${totalExpense.toFixed(2)}`);
  console.log(`  Net Profit/Loss:   ${netProfit.toFixed(2)}`);
  console.log(`  Total Liabilities & Profit: ${(totalLiabilities + netProfit).toFixed(2)}`);
  console.log(`  Unbalanced Amount: ${(totalAssets - (totalLiabilities + netProfit)).toFixed(2)}`);
}

run().catch(console.error);

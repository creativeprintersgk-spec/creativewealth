/**
 * Find the exact ₹663 source in Krisha's (acid=32) balance sheet.
 * We need to find what's different between the simulation and the actual app.
 * 
 * Key: The app uses getStoredEntries() which uses BOTH transc1 AND trans1.
 * Our simulation also does this. But maybe the issue is in the entry filtering:
 * entryAcid matches OR portfolio matches.
 * 
 * Let me check what entries exist for Krisha where the voucher has no acid/pfid.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function safeFetch(table: string, max = 100000): Promise<any[]> {
  const pkMap: Record<string, string> = { transc1: 'transid', trans1: 'transid', vouchersc1: 'vid', vouchers1: 'vid', acmac1: 'id', acc_pflink: 'pfid' };
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (all.length < max) {
    const { data, error } = await supabase.from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
    if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

function getGroupType(st: number): string {
  if ([150, 40, 50, 125].includes(st)) return 'ASSET';
  if ([250, 275, 276].includes(st)) return 'LIABILITY';
  if (st === 280) return 'INCOME';
  if (st === 290) return 'EXPENSE';
  return 'ASSET';
}

async function run() {
  console.log('=== FINDING EXACT ₹663 SOURCE IN KRISHA BS ===\n');

  const KRISHA_ACID = 32;
  const END_DATE = '2027-03-31';
  const accountId = String(KRISHA_ACID);

  const [acmac1All, pflinks, vouchersC1, vouchers1, transc1All, trans1All] = await Promise.all([
    safeFetch('acmac1'), safeFetch('acc_pflink'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'),
    safeFetch('transc1'), safeFetch('trans1')
  ]);

  const krishaPfids = pflinks.filter((l: any) => Number(l.acid) === KRISHA_ACID).map((l: any) => String(l.pfid));
  console.log(`Krisha pfids:`, krishaPfids);

  // Build voucher map
  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { id: `c_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { id: `t_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });

  // Build entries
  const entries = [
    ...transc1All.map((e: any) => ({ id: `c_${e.transid}`, voucherId: `c_${e.vid}`, ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, accountId: e.acid ? String(e.acid) : undefined })),
    ...trans1All.map((e: any) => ({ id: `t_${e.transid}`, voucherId: `t_${e.vid}`, ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, accountId: e.acid ? String(e.acid) : undefined }))
  ];

  // Get Krisha groups + ledgers
  const krishaGroups = acmac1All.filter((a: any) => a.is_group && Number(a.acid) === KRISHA_ACID);
  const krishaLedgers = acmac1All.filter((a: any) => !a.is_group && Number(a.acid) === KRISHA_ACID);

  // getGroupTypeSim
  const getGroupTypeSim = (groupId: string): string => {
    let current: any = krishaGroups.find((g: any) => String(g.id) === groupId);
    while (current) {
      const t = getGroupType(current.special_type_id || 150);
      if (t !== 'ASSET' || current.special_type_id) return t;
      const parent = current.parent_id ? String(current.parent_id) : undefined;
      if (!parent) break;
      current = krishaGroups.find((g: any) => String(g.id) === parent);
    }
    return 'ASSET';
  };

  // calcLedgerBal — exactly as in balanceSheet.ts
  const ledgerNetBals: { id: string, name: string, dr: number, cr: number, groupType: string, net: number }[] = [];

  krishaLedgers.forEach((l: any) => {
    const groupId = String(l.parent_id);
    const groupType = getGroupTypeSim(groupId);
    let dr = 0, cr = 0;

    entries.forEach((e: any) => {
      if (e.ledgerId !== String(l.id)) return;
      const v = voucherMap[e.voucherId];
      const entryDate = v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      if (entryDate && entryDate <= END_DATE) {
        const belongs = (entryAcid === accountId) || (entryPfid && krishaPfids.includes(entryPfid));
        if (!belongs) return;
        dr += e.debit || 0;
        cr += e.credit || 0;
      }
    });

    const net = groupType === 'ASSET' ? (dr - cr) : (cr - dr);
    if (Math.abs(net) > 0.01) {
      ledgerNetBals.push({ id: String(l.id), name: l.name, dr, cr, groupType, net });
    }
  });

  // Total assets vs liabilities
  let totalAssets = 0, totalLiabilities = 0;
  ledgerNetBals.forEach(l => {
    if (l.groupType === 'ASSET') totalAssets += l.net;
    else totalLiabilities += l.net;
  });

  console.log(`Total Assets:      ₹${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ₹${totalLiabilities.toFixed(2)}`);
  console.log(`Difference: ₹${(totalAssets - totalLiabilities).toFixed(2)}\n`);

  // Show ledgers where sign flip might be wrong
  console.log('--- Income/Expense/Liability ledgers for Krisha (non-ASSET) ---');
  const nonAssets = ledgerNetBals.filter(l => l.groupType !== 'ASSET');
  nonAssets.forEach(l => {
    console.log(`  maid=${l.id} "${l.name}" type=${l.groupType} DR=${l.dr.toFixed(2)} CR=${l.cr.toFixed(2)} net=${l.net.toFixed(2)}`);
  });

  // Check: are there any entries for Krisha with NO date (would be excluded from balance)?
  console.log('\n--- Entries for Krisha with no date (excluded from calculation) ---');
  let noDatCount = 0;
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;
    const belongs = (entryAcid === accountId) || (entryPfid && krishaPfids.includes(entryPfid));
    if (belongs && (!entryDate || entryDate === '')) {
      noDatCount++;
      if (noDatCount <= 10) {
        const l = acmac1All.find((a: any) => String(a.id) === e.ledgerId);
        console.log(`  entry=${e.id} voucherId=${e.voucherId} ledger="${l?.name}" DR=${e.debit} CR=${e.credit} (date="${entryDate}")`);
      }
    }
  });
  console.log(`Total entries with no date: ${noDatCount}`);

  // Check: entries after END_DATE that get excluded?
  console.log('\n--- Krisha entries after 2027-03-31 (would be excluded) ---');
  let afterCount = 0;
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;
    const belongs = (entryAcid === accountId) || (entryPfid && krishaPfids.includes(entryPfid));
    if (belongs && entryDate && entryDate > END_DATE) {
      afterCount++;
      const l = acmac1All.find((a: any) => String(a.id) === e.ledgerId);
      console.log(`  entry=${e.id} date=${entryDate} ledger="${l?.name}" DR=${e.debit} CR=${e.credit}`);
    }
  });
  if (afterCount === 0) console.log('  None');

  // Check if there are any entries attributed to Krisha-pfid vouchers but with DIFFERENT acid in entry itself
  console.log('\n--- Checking portfolio-linked entries (pfid vouchers, entry acid may differ) ---');
  let pfidOnlyCount = 0;
  let pfidOnlyDr = 0, pfidOnlyCr = 0;
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;
    const byAcid = entryAcid === accountId;
    const byPfid = entryPfid && krishaPfids.includes(entryPfid);
    if (byPfid && !byAcid && entryDate && entryDate <= END_DATE) {
      pfidOnlyCount++;
      pfidOnlyDr += e.debit || 0;
      pfidOnlyCr += e.credit || 0;
    }
  });
  console.log(`Entries included via pfid (not acid): ${pfidOnlyCount}`);
  console.log(`  Total DR: ₹${pfidOnlyDr.toFixed(2)}, CR: ₹${pfidOnlyCr.toFixed(2)}, Net: ₹${(pfidOnlyDr - pfidOnlyCr).toFixed(2)}`);
}

run().catch(console.error);

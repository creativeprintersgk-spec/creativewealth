import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fetchAll(table: string, pkCol: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table).select('*').order(pkCol).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function run() {
  // This is checking for Unnati (acid=30) Kotak Bank (maid=48, id=48)
  const ACID = 30;
  const MAID = 48;  // Kotak Bank (A/c No. - 2012066081)
  const END_DATE = '2026-03-31';

  const [tc1, t1, vc1, v1] = await Promise.all([
    fetchAll('transc1', 'transid'),
    fetchAll('trans1', 'transid'),
    fetchAll('vouchersc1', 'vid'),
    fetchAll('vouchers1', 'vid'),
  ]);

  console.log(`Total rows: transc1=${tc1.length}, trans1=${t1.length}, vouchersc1=${vc1.length}, vouchers1=${v1.length}`);

  // === SIMULATE getStoredEntries() (what balanceSheet.ts uses) ===
  const c1Entries = tc1.map((e: any) => ({
    id: `c_${e.transid}`,
    voucherId: `c_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    date: e.dt || '',
    accountId: e.acid ? String(e.acid) : undefined,
  }));
  const t1Entries = t1.map((e: any) => ({
    id: `t_${e.transid}`,
    voucherId: `t_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    date: e.dt || '',
    accountId: e.acid ? String(e.acid) : undefined,
  }));
  const allEntries = [...c1Entries, ...t1Entries];

  // Voucher map (getStoredVouchers style)
  const voucherMap: Record<string, any> = {};
  vc1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { ...v, accountId: v.acid ? String(v.acid) : undefined }; });
  v1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { ...v, accountId: v.acid ? String(v.acid) : undefined }; });

  const accountId = String(ACID);
  const ledgerId = String(MAID);

  // BS calcLedgerBal simulation
  let bsDr = 0, bsCr = 0;
  allEntries.forEach((e: any) => {
    if (e.ledgerId !== ledgerId) return;
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.dt;
    const entryAcid = e.accountId || v?.accountId;

    if (!entryDate || entryDate > END_DATE) return;
    
    const belongsToAccount = entryAcid === accountId;
    if (!belongsToAccount) return;

    bsDr += e.debit || 0;
    bsCr += e.credit || 0;
  });

  console.log(`\n=== BS calcLedgerBal result for maid=${MAID} acid=${ACID} ===`);
  console.log(`  Total DR=${bsDr.toFixed(2)}, Total CR=${bsCr.toFixed(2)}`);
  console.log(`  ASSET balance (DR-CR) = ${(bsDr - bsCr).toFixed(2)}`);

  // === SIMULATE getLedgerWithBalance() (what Drilldown uses) ===
  const ddC1 = tc1.filter((e: any) => e.maid === MAID && e.acid === ACID);
  const ddT1 = t1.filter((e: any) => e.maid === MAID && e.acid === ACID);
  let ddDr = 0, ddCr = 0;
  [...ddC1, ...ddT1].forEach((e: any) => {
    if (!e.dt || e.dt > END_DATE) return;
    ddDr += Number(e.dramt) || 0;
    ddCr += Number(e.cramt) || 0;
  });

  console.log(`\n=== getLedgerWithBalance result for maid=${MAID} acid=${ACID} ===`);
  console.log(`  c1 entries: ${ddC1.length}, t1 entries: ${ddT1.length}`);
  console.log(`  Total DR=${ddDr.toFixed(2)}, Total CR=${ddCr.toFixed(2)}`);
  console.log(`  ASSET balance (DR-CR) = ${(ddDr - ddCr).toFixed(2)}`);

  // Now check what acmac1 says for opening balance
  const { data: acmac1 } = await supabase.from('acmac1').select('*').eq('id', MAID).eq('acid', ACID);
  console.log(`\n=== ACMAC1 for maid=${MAID} acid=${ACID} ===`);
  (acmac1 || []).forEach((a: any) => {
    console.log(`  name="${a.name}", op_dr=${a.db_bal}, op_cr=${a.cr_bal}`);
    const opBalance = (Number(a.db_bal) || 0) - (Number(a.cr_bal) || 0);
    console.log(`  Opening balance (DR-CR): ${opBalance.toFixed(2)}`);
    console.log(`  Closing (BS method): ${(opBalance + bsDr - bsCr).toFixed(2)}`);
    console.log(`  Closing (Drilldown):  ${(opBalance + ddDr - ddCr).toFixed(2)}`);
  });

  // Count matched vs unmatched entries per path
  let bsMatched = 0, bsMissed = 0;
  allEntries.forEach((e: any) => {
    if (e.ledgerId !== ledgerId) return;
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.dt;
    const entryAcid = e.accountId || v?.accountId;
    if (!entryDate || entryDate > END_DATE) return;
    if (entryAcid === accountId) bsMatched++;
    else bsMissed++;
  });
  console.log(`\n=== BS filter: matched=${bsMatched}, MISSED (wrong acid)=${bsMissed} ===`);
}

run().catch(console.error);

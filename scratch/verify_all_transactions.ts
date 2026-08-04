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

async function safeFetch(table: string, max = 50000): Promise<any[]> {
  const pkMap: Record<string, string> = {
    bs1: 'trid', transc1: 'transid', trans1: 'transid',
    vouchersc1: 'vid', vouchers1: 'vid',
    portfolios: 'id', acc_pflink: 'pfid',
    acmac1: 'id', sam: 'amid'
  };
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

async function run() {
  console.log('=== COMPREHENSIVE TRANSACTION & LEDGER VERIFICATION ===\n');

  console.log('Loading data...');
  const [transc1, trans1, vouchersC1, vouchers1, bs1, pflinks, portfolios, acmac1] = await Promise.all([
    safeFetch('transc1'), safeFetch('trans1'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'),
    safeFetch('bs1'), safeFetch('acc_pflink'), safeFetch('portfolios'), safeFetch('acmac1')
  ]);
  console.log(`Loaded: ${transc1.length} transc1 entries, ${trans1.length} trans1 entries`);
  console.log(`Loaded: ${vouchersC1.length} vouchersC1, ${vouchers1.length} vouchers1`);
  console.log(`Loaded: ${bs1.length} bs1 holdings\n`);

  // Build maps
  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = v; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = v; });

  const pfMap: Record<string, any> = {};
  portfolios.forEach((p: any) => { pfMap[String(p.id)] = p; });

  const pfToAcid: Record<string, number> = {};
  pflinks.forEach((l: any) => { pfToAcid[String(l.pfid)] = l.acid; });

  // === CHECK 1: Double-entry balance per voucher ===
  console.log('--- CHECK 1: Double-Entry Balance per Voucher ---');
  const allEntries = [
    ...transc1.map((e: any) => ({ ...e, _src: 'c' })),
    ...trans1.map((e: any) => ({ ...e, _src: 't' }))
  ];
  
  // Group entries by voucher
  const voucherEntries: Record<string, { dr: number, cr: number, src: string }> = {};
  allEntries.forEach((e: any) => {
    const key = `${e._src}_${e.vid}`;
    if (!voucherEntries[key]) voucherEntries[key] = { dr: 0, cr: 0, src: e._src };
    voucherEntries[key].dr += Number(e.dramt) || 0;
    voucherEntries[key].cr += Number(e.cramt) || 0;
  });

  let unbalancedCount = 0;
  let totalVouchers = 0;
  const unbalancedVouchers: any[] = [];
  
  for (const [key, bal] of Object.entries(voucherEntries)) {
    totalVouchers++;
    const diff = Math.abs(bal.dr - bal.cr);
    if (diff > 0.02) { // Allow 2 paise rounding tolerance
      unbalancedCount++;
      const [src, vidStr] = key.split('_');
      const v = voucherMap[key];
      unbalancedVouchers.push({
        vid: vidStr,
        src: src === 'c' ? 'vouchersc1' : 'vouchers1',
        date: v?.date,
        narration: v?.narration?.substring(0, 50),
        dr: bal.dr.toFixed(2),
        cr: bal.cr.toFixed(2),
        diff: diff.toFixed(2)
      });
    }
  }
  
  console.log(`Total vouchers with entries: ${totalVouchers}`);
  console.log(`Balanced vouchers: ${totalVouchers - unbalancedCount}`);
  console.log(`UNBALANCED vouchers: ${unbalancedCount}`);
  if (unbalancedVouchers.length > 0) {
    console.log('\nTop unbalanced vouchers:');
    unbalancedVouchers.slice(0, 10).forEach(v => {
      console.log(`  vid=${v.vid} (${v.src}) date=${v.date} diff=₹${v.diff} DR=₹${v.dr} CR=₹${v.cr}`);
      console.log(`    narration: "${v.narration}"`);
    });
  }
  
  // === CHECK 2: bs1 PMS records linked to vouchersc1 ===
  console.log('\n--- CHECK 2: bs1 Holdings vs Voucher Links ---');
  const bs1WithVoucher = bs1.filter((b: any) => b.acvch);
  const bs1WithoutVoucher = bs1.filter((b: any) => !b.acvch);
  const bs1WithCnid = bs1.filter((b: any) => b.cnid && !b.acvch);
  
  console.log(`Total bs1 records: ${bs1.length}`);
  console.log(`  - Linked to voucher (acvch): ${bs1WithVoucher.length}`);
  console.log(`  - Linked via cnid only: ${bs1WithCnid.length}`);
  console.log(`  - Unlinked (no acvch, no cnid): ${bs1WithoutVoucher.filter((b: any) => !b.cnid).length}`);

  // === CHECK 3: Portfolio-wise holdings summary ===
  console.log('\n--- CHECK 3: Portfolio Holdings Summary ---');
  const holdingsByPortfolio: Record<string, { count: number, buys: number, sells: number }> = {};
  bs1.forEach((b: any) => {
    const pfid = String(b.pfid);
    if (!holdingsByPortfolio[pfid]) holdingsByPortfolio[pfid] = { count: 0, buys: 0, sells: 0 };
    holdingsByPortfolio[pfid].count++;
    if (b.trty === 20) holdingsByPortfolio[pfid].buys++;
    if (b.trty === 99 || b.trty === 101) holdingsByPortfolio[pfid].sells++;
  });

  const pfIds = Object.keys(holdingsByPortfolio).sort((a, b) => Number(a) - Number(b));
  console.log(`Portfolios with holdings: ${pfIds.length}`);
  pfIds.forEach(pfid => {
    const pf = pfMap[pfid];
    const h = holdingsByPortfolio[pfid];
    console.log(`  Portfolio ${pfid} (${pf?.portfolioName || 'Unknown'}): ${h.count} records (${h.buys} buys, ${h.sells} sells)`);
  });

  // === CHECK 4: Missing bs1 records for vouchersC1 journal entries ===
  console.log('\n--- CHECK 4: Journal Vouchers vs bs1 Correspondence ---');
  const journalVouchers = vouchersC1.filter((v: any) => 
    ['journal', 'payment', 'receipt'].includes(v.vtype || v.type || '')
  );
  
  let journalsWithBs1 = 0;
  let journalsWithoutBs1 = 0;
  const bs1VidSet = new Set(bs1.filter((b: any) => b.acvch).map((b: any) => b.acvch));
  
  journalVouchers.forEach((v: any) => {
    if (bs1VidSet.has(v.vid)) {
      journalsWithBs1++;
    } else {
      // Check if it has asset entries (qty-based)
      const entries = transc1.filter((e: any) => e.vid === v.vid && Number(e.qty) > 0);
      if (entries.length > 0) journalsWithoutBs1++;
    }
  });
  
  console.log(`Journal vouchers checked: ${journalVouchers.length}`);
  console.log(`With bs1 records: ${journalsWithBs1}`);
  console.log(`With qty entries but NO bs1: ${journalsWithoutBs1}`);

  // === CHECK 5: Total debit vs credit across ALL entries ===
  console.log('\n--- CHECK 5: Overall System Balance ---');
  let totalDr = 0, totalCr = 0;
  allEntries.forEach((e: any) => {
    totalDr += Number(e.dramt) || 0;
    totalCr += Number(e.cramt) || 0;
  });
  const systemDiff = Math.abs(totalDr - totalCr);
  console.log(`Total Debits:  ₹${totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Total Credits: ₹${totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`System Difference: ₹${systemDiff.toFixed(4)} ${systemDiff < 1 ? '✅ BALANCED' : '❌ UNBALANCED'}`);

  // === CHECK 6: Contract Note (cnid) consistency ===
  console.log('\n--- CHECK 6: Contract Note (cnid) Consistency ---');
  const cnidMap: Record<number, any[]> = {};
  bs1.forEach((b: any) => {
    if (b.cnid) {
      if (!cnidMap[b.cnid]) cnidMap[b.cnid] = [];
      cnidMap[b.cnid].push(b);
    }
  });
  
  const cnIds = Object.keys(cnidMap);
  const multiAssetCnids = cnIds.filter(cn => cnidMap[Number(cn)].length > 1);
  console.log(`Contract notes with bs1 records: ${cnIds.length}`);
  console.log(`Multi-asset contract notes: ${multiAssetCnids.length}`);
  if (multiAssetCnids.length > 0) {
    console.log('Sample multi-asset contract notes:');
    multiAssetCnids.slice(0, 5).forEach(cn => {
      const records = cnidMap[Number(cn)];
      console.log(`  cnid=${cn}: ${records.length} trades`);
      records.forEach((r: any) => {
        console.log(`    - amid=${r.amid} qty=${r.qty} trty=${r.trty} pfid=${r.pfid}`);
      });
    });
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

run().catch(console.error);

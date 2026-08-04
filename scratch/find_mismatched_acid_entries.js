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

async function run() {
  const startDate = '2026-04-01';
  const endDate = '2027-03-31';
  console.log(`=== Scanning for transactions with mismatched acid or pfid in FY 26-27 ===`);

  // Fetch portfolios to get portfolio IDs and their linked accounts
  const [portfoliosRes, pflinkRes] = await Promise.all([
    supabase.from('portfolios').select('*'),
    supabase.from('acc_pflink').select('*')
  ]);
  
  const portfolios = portfoliosRes.data || [];
  const accPflink = pflinkRes.data || [];

  const pfToAcid = new Map();
  accPflink.forEach(l => pfToAcid.set(l.pfid, l.acid));

  const [vouchersC1Res, vouchers1Res, transC1Res, trans1Res] = await Promise.all([
    supabase.from('vouchersc1').select('*').gte('dt', startDate).lte('dt', endDate),
    supabase.from('vouchers1').select('*').gte('dt', startDate).lte('dt', endDate),
    supabase.from('transc1').select('*').gte('dt', startDate).lte('dt', endDate),
    supabase.from('trans1').select('*').gte('dt', startDate).lte('dt', endDate)
  ]);

  const vouchers = [
    ...(vouchersC1Res.data || []).map(v => ({ ...v, _src: 'c' })),
    ...(vouchers1Res.data || []).map(v => ({ ...v, _src: 't' }))
  ];

  const transc1 = transC1Res.data || [];
  const trans1 = trans1Res.data || [];

  const { data: acmac } = await supabase.from('acmac1').select('id, name, acid');
  const ledgerMap = new Map((acmac || []).map(a => [a.id, a]));

  const transc1ByVid = new Map();
  transc1.forEach(e => {
    if (!transc1ByVid.has(e.vid)) transc1ByVid.set(e.vid, []);
    transc1ByVid.get(e.vid).push(e);
  });

  const trans1ByVid = new Map();
  trans1.forEach(e => {
    if (!trans1ByVid.has(e.vid)) trans1ByVid.set(e.vid, []);
    trans1ByVid.get(e.vid).push(e);
  });

  let foundCount = 0;

  for (const v of vouchers) {
    const lines = v._src === 'c' ? (transc1ByVid.get(v.vid) || []) : (trans1ByVid.get(v.vid) || []);
    if (lines.length === 0) continue;

    // The effective account ID for the voucher is:
    // 1. If v.acid is set, use it.
    // 2. If v.pfid is set, look up the linked acid from accPflink.
    const voucherAcid = v.acid || (v.pfid ? pfToAcid.get(v.pfid) : null);

    let hasMismatch = false;
    lines.forEach(l => {
      // Find the entry's acid
      const entryAcid = l.acid;
      if (voucherAcid && entryAcid && entryAcid !== voucherAcid) {
        hasMismatch = true;
      }
    });

    if (hasMismatch) {
      foundCount++;
      console.log(`\n⚠️ Mismatched Acid Voucher [${v._src}] vid=${v.vid}:`);
      console.log(`  Date: ${v.dt}, No: ${v.vchno}, Narr: "${v.narr}"`);
      console.log(`  Voucher Acid (resolved): ${voucherAcid}, pfid: ${v.pfid}`);
      lines.forEach(l => {
        const ledger = ledgerMap.get(l.maid);
        const isMismatched = voucherAcid && l.acid && l.acid !== voucherAcid;
        console.log(`    - transid=${l.transid}, maid=${l.maid} (${ledger?.name}), DR=${l.dramt}, CR=${l.cramt}, line_acid=${l.acid} ${isMismatched ? '❌ MISMATCH' : '✅ ok'}`);
      });
    }
  }

  console.log(`\nScan complete. Found ${foundCount} vouchers with mismatched acid entries.`);
}

run().catch(console.error);

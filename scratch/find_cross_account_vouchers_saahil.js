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
  const ACID = 31;
  const startDate = '2026-04-01';
  const endDate = '2027-03-31';
  console.log(`=== Scanning for cross-entity vouchers affecting Saahil (acid=${ACID}) in FY 26-27 ===`);

  // Fetch portfolios to get portfolio IDs
  const [portfoliosRes, pflinkRes] = await Promise.all([
    supabase.from('portfolios').select('*'),
    supabase.from('acc_pflink').select('*')
  ]);
  
  const portfolios = portfoliosRes.data || [];
  const accPflink = pflinkRes.data || [];

  // Filter portfolios linked to acid 31
  const saahilPflIds = accPflink.filter(l => l.acid === ACID).map(l => l.pfid);
  console.log(`Saahil portfolios: ${saahilPflIds.join(', ')}`);

  // Fetch all vouchers in FY 26-27
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

  // Group transaction lines by voucher
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

  const { data: acmac } = await supabase.from('acmac1').select('id, name, acid');
  const ledgerMap = new Map((acmac || []).map(a => [a.id, a]));

  let foundCount = 0;

  for (const v of vouchers) {
    const lines = v._src === 'c' ? (transc1ByVid.get(v.vid) || []) : (trans1ByVid.get(v.vid) || []);
    if (lines.length === 0) continue;

    // Check if any line in this voucher belongs to Saahil
    const saahilLines = [];
    const nonSaahilLines = [];

    lines.forEach(l => {
      // Find parent voucher in the memory-like way:
      const entryAcid = l.acid || v.acid;
      const entryPfid = v.pfid;
      const belongs = (entryAcid === ACID) || (entryPfid && saahilPflIds.includes(entryPfid));
      if (belongs) {
        saahilLines.push(l);
      } else {
        nonSaahilLines.push(l);
      }
    });

    if (saahilLines.length > 0 && nonSaahilLines.length > 0) {
      foundCount++;
      const saahilDr = saahilLines.reduce((s, e) => s + (Number(e.dramt) || 0), 0);
      const saahilCr = saahilLines.reduce((s, e) => s + (Number(e.cramt) || 0), 0);
      
      console.log(`\n⚠️ Cross-Entity Voucher [${v._src}] vid=${v.vid}:`);
      console.log(`  Date: ${v.dt}, No: ${v.vchno}, Narr: "${v.narr}"`);
      console.log(`  Saahil Lines DR: ₹${saahilDr.toFixed(2)}, CR: ₹${saahilCr.toFixed(2)}, Net Saahil: ₹${(saahilDr - saahilCr).toFixed(2)}`);
      
      console.log(`  Saahil lines:`);
      saahilLines.forEach(l => {
        const ledger = ledgerMap.get(l.maid);
        console.log(`    - transid=${l.transid}, maid=${l.maid} (${ledger?.name}), DR=${l.dramt}, CR=${l.cramt}, acid=${l.acid}`);
      });

      console.log(`  Non-Saahil lines:`);
      nonSaahilLines.forEach(l => {
        const ledger = ledgerMap.get(l.maid);
        console.log(`    - transid=${l.transid}, maid=${l.maid} (${ledger?.name}), DR=${l.dramt}, CR=${l.cramt}, acid=${l.acid}`);
      });
    }
  }

  console.log(`\nScan complete. Found ${foundCount} cross-entity vouchers.`);
}

run().catch(console.error);

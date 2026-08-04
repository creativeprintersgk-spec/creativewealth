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
  const SAAHIL_ACID = 31;

  console.log('=== PINPOINTING 14075.25 IMBALANCE IN SAAHIL ===\n');

  // Get ALL transc1 entries for Saahil
  const { data: tc1 } = await supabase.from('transc1').select('*').eq('acid', SAAHIL_ACID);
  
  // Group entries by vid
  const entriesByVid = new Map();
  (tc1 || []).forEach(e => {
    if (!entriesByVid.has(e.vid)) entriesByVid.set(e.vid, []);
    entriesByVid.get(e.vid).push(e);
  });

  let totalNetImbalance = 0;
  const unbalancedVouchers = [];

  for (const [vid, entries] of entriesByVid.entries()) {
    const totalDr = entries.reduce((s, e) => s + (Number(e.dramt) || 0), 0);
    const totalCr = entries.reduce((s, e) => s + (Number(e.cramt) || 0), 0);
    const diff = totalDr - totalCr;
    if (Math.abs(diff) > 0.01) {
      totalNetImbalance += diff;
      unbalancedVouchers.push({ vid, diff, totalDr, totalCr, entries });
    }
  }

  console.log(`Total transc1 entries for Saahil: ${tc1?.length || 0}`);
  console.log(`Total unbalanced vouchers: ${unbalancedVouchers.length}`);
  console.log(`Net imbalance (Dr - Cr): ${totalNetImbalance.toFixed(2)}`);
  console.log(`Expected: 14075.25\n`);

  // Sort by abs diff descending
  unbalancedVouchers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  
  console.log('--- All Unbalanced Vouchers (sorted by amount) ---');
  // Fetch vouchersc1 for Saahil for narration
  const { data: vc1All } = await supabase.from('vouchersc1').select('*').eq('acid', SAAHIL_ACID);
  const voucherMap = new Map((vc1All || []).map(v => [v.vid, v]));

  unbalancedVouchers.forEach(({ vid, diff, totalDr, totalCr, entries }) => {
    const v = voucherMap.get(vid);
    const narr = v ? `dt=${v.dt} narr="${v.narr || ''}"` : '(no voucher header)';
    console.log(`  vid=${vid} diff=${diff.toFixed(2)} Dr=${totalDr.toFixed(2)} Cr=${totalCr.toFixed(2)} | ${narr}`);
  });

  // Also check if any vid 13330-13349 (recent) are unbalanced
  console.log('\n--- Recent voucher vids 13329-13352 entries ---');
  for (let vid = 13329; vid <= 13352; vid++) {
    const entries = (tc1 || []).filter(e => e.vid === vid);
    if (entries.length > 0) {
      const dr = entries.reduce((s, e) => s + (Number(e.dramt) || 0), 0);
      const cr = entries.reduce((s, e) => s + (Number(e.cramt) || 0), 0);
      const v = voucherMap.get(vid);
      console.log(`  vid=${vid} Dr=${dr.toFixed(2)} Cr=${cr.toFixed(2)} diff=${(dr-cr).toFixed(2)} | ${v ? `dt=${v.dt} narr="${v.narr || ''}"` : '(no header)'}`);
      entries.forEach(e => console.log(`    maid=${e.maid} dr=${e.dramt} cr=${e.cramt}`));
    } else {
      // Check if the voucher exists but has no entries  
      const v = voucherMap.get(vid);
      if (v) {
        console.log(`  vid=${vid} NO ENTRIES | dt=${v.dt} narr="${v.narr || ''}"`);
      }
    }
  }

  // Check vouchersc1 entries near the NTPC import date
  console.log('\n--- All vouchersc1 entries for Saahil (sorted by dt, last 20) ---');
  const sortedVouchers = (vc1All || []).sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
  sortedVouchers.slice(-20).forEach(v => {
    const entries = (tc1 || []).filter(e => e.vid === v.vid);
    const dr = entries.reduce((s, e) => s + (Number(e.dramt) || 0), 0);
    const cr = entries.reduce((s, e) => s + (Number(e.cramt) || 0), 0);
    console.log(`  vid=${v.vid} dt=${v.dt} narr="${v.narr || ''}" entries=${entries.length} Dr=${dr.toFixed(2)} Cr=${cr.toFixed(2)} diff=${(dr-cr).toFixed(2)}`);
  });
}

run().catch(console.error);

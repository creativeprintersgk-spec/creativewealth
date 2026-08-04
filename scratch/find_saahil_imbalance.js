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

  console.log('=== FINDING NET IMBALANCE IN SAAHIL\'S LEDGER ===\n');

  // Get ALL transc1 entries for Saahil
  const { data: tc1 } = await supabase.from('transc1').select('*').eq('acid', SAAHIL_ACID);
  // Get ALL vouchersc1 for Saahil
  const { data: vc1 } = await supabase.from('vouchersc1').select('*').eq('acid', SAAHIL_ACID);
  
  const voucherMap = new Map((vc1 || []).map(v => [v.vid, v]));

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
      const v = voucherMap.get(vid);
      unbalancedVouchers.push({ vid, diff, totalDr, totalCr, entries, voucher: v });
    }
  }

  console.log(`Total unbalanced vouchers for Saahil (acid=31): ${unbalancedVouchers.length}`);
  console.log(`Net imbalance (Dr - Cr): ${totalNetImbalance.toFixed(2)}\n`);

  if (unbalancedVouchers.length > 0) {
    console.log('--- Unbalanced Vouchers Detail ---');
    unbalancedVouchers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    unbalancedVouchers.forEach(({ vid, diff, totalDr, totalCr, entries, voucher }) => {
      console.log(`\n  vid=${vid} diff=${diff.toFixed(2)} (Dr=${totalDr.toFixed(2)}, Cr=${totalCr.toFixed(2)})`);
      if (voucher) console.log(`  Voucher: dt=${voucher.dt} narr="${voucher.narr || ''}" pfid=${voucher.pfid}`);
      entries.forEach(e => {
        console.log(`    maid=${e.maid} dr=${e.dramt} cr=${e.cramt} dt=${e.dt}`);
      });
    });
  }

  // Also check acmac1 balance totals for Saahil
  console.log('\n=== ACMAC1 db_bal vs cr_bal TOTALS FOR SAAHIL (acid=31) ===');
  const { data: acmac1 } = await supabase.from('acmac1').select('*').eq('acid', SAAHIL_ACID).eq('is_group', false);
  let totalDbBal = 0;
  let totalCrBal = 0;
  (acmac1 || []).forEach(l => {
    totalDbBal += Number(l.db_bal) || 0;
    totalCrBal += Number(l.cr_bal) || 0;
  });
  console.log(`Total db_bal across all ledgers: ${totalDbBal.toFixed(2)}`);
  console.log(`Total cr_bal across all ledgers: ${totalCrBal.toFixed(2)}`);
  console.log(`Net (db - cr): ${(totalDbBal - totalCrBal).toFixed(2)}`);

  // Show non-zero unbalanced ledgers (db_bal != cr_bal significant)
  const ubl = (acmac1 || []).filter(l => Math.abs((Number(l.db_bal) || 0) - (Number(l.cr_bal) || 0)) > 0.01);
  console.log(`\nLedgers with non-zero net balance (count=${ubl.length}):`);
  
  // Get parent group info
  const { data: groups } = await supabase.from('acmac1').select('id, name, is_group').eq('acid', SAAHIL_ACID).eq('is_group', true);
  const groupMap = new Map((groups || []).map(g => [g.id, g.name]));

  // Sum by group type
  let assetTotal = 0, liabTotal = 0;
  const ASSET_GROUPS = [200050, 200061, 200062, 200040, 200070, 200075, 200077, 200095, 200115, 200120, 200135, 200150, 200155, 200160, 200195, 200141, 200140, 200058, 200066];
  
  ubl.forEach(l => {
    const net = (Number(l.db_bal) || 0) - (Number(l.cr_bal) || 0);
    const groupName = groupMap.get(l.parent_id) || `group ${l.parent_id}`;
    const isAsset = ASSET_GROUPS.includes(l.parent_id);
    if (isAsset) assetTotal += net; else liabTotal += net;
    console.log(`  id=${l.id} "${l.name}" parent=${l.parent_id}(${groupName}) net=${net.toFixed(2)} ${isAsset ? '[ASSET]' : '[LIAB/P&L]'}`);
  });
  
  console.log(`\nAsset ledger total (db-cr): ${assetTotal.toFixed(2)}`);
  console.log(`Liab/P&L ledger total (db-cr): ${liabTotal.toFixed(2)}`);
  console.log(`Imbalance (assets - liabs): ${(assetTotal - liabTotal).toFixed(2)}`);
}

run().catch(console.error);

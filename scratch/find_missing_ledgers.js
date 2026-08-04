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
  console.log(`=== Finding missing ledgers in acmac1 for acid=${ACID} ===`);

  const [acmacRes, transC1Res, trans1Res] = await Promise.all([
    supabase.from('acmac1').select('id, name, is_group, parent_id').eq('acid', ACID),
    supabase.from('transc1').select('maid, dramt, cramt, dt, vid').eq('acid', ACID),
    supabase.from('trans1').select('maid, dramt, cramt, dt, vid').eq('acid', ACID)
  ]);

  const acmac = acmacRes.data || [];
  const transc1 = transC1Res.data || [];
  const trans1 = trans1Res.data || [];

  const ledgerIds = new Set(acmac.map(a => a.id));
  console.log(`Registered ledgers/groups in acmac1 for acid=${ACID}: ${ledgerIds.size}`);

  const allEntries = [...transc1, ...trans1];
  console.log(`Total transaction lines for acid=${ACID}: ${allEntries.length}`);

  const missingMaids = new Map();
  allEntries.forEach(e => {
    if (!ledgerIds.has(e.maid)) {
      if (!missingMaids.has(e.maid)) {
        missingMaids.set(e.maid, { dr: 0, cr: 0, count: 0, entries: [] });
      }
      const data = missingMaids.get(e.maid);
      data.dr += Number(e.dramt) || 0;
      data.cr += Number(e.cramt) || 0;
      data.count++;
      data.entries.push(e);
    }
  });

  console.log(`Found ${missingMaids.size} unique missing ledger IDs in transactions:`);
  for (const [maid, data] of missingMaids.entries()) {
    console.log(`\nMissing Ledger ID: ${maid}`);
    console.log(`  Count of transaction lines: ${data.count}`);
    console.log(`  Total DR: ₹${data.dr.toFixed(2)}, Total CR: ₹${data.cr.toFixed(2)}`);
    console.log(`  Net Balance (DR - CR): ₹${(data.dr - data.cr).toFixed(2)}`);
    
    // Let's resolve the asset name from sam or asset_master
    const { data: samRow } = await supabase.from('sam').select('anm').eq('amid', maid).single();
    const { data: amRow } = await supabase.from('asset_master').select('name').eq('amid', maid).single();
    const resolvedName = samRow?.anm || amRow?.name || 'Unknown Asset';
    console.log(`  Resolved Name: ${resolvedName}`);

    // Print a sample entry to show context
    if (data.entries.length > 0) {
      const sample = data.entries[0];
      console.log(`  Sample Entry: date=${sample.dt}, vid=${sample.vid}, dramt=${sample.dramt}, cramt=${sample.cramt}`);
      
      // Let's print the full voucher details
      const table = transc1.includes(sample) ? 'vouchersc1' : 'vouchers1';
      const { data: vch } = await supabase.from(table).select('vchno, narr, dt').eq('vid', sample.vid).single();
      if (vch) {
        console.log(`    Voucher: vchno=${vch.vchno}, date=${vch.dt}, narr="${vch.narr}"`);
      }
    }
  }
}

run().catch(console.error);

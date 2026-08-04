/**
 * REVERT: The opening balance fix applied today was WRONG.
 * The opening balance was already correct. Reverting Capital Account adjustments.
 * 
 * acid=29: Revert Capital Account CR from ₹10,010,784.93 back to ₹10,003,784.93 (-7000)
 * acid=30: Revert Capital Account CR from ₹10,148,243.32 back to ₹10,143,243.32 (-5000)
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

async function run() {
  console.log('=== REVERTING INCORRECT OPENING BALANCE FIX ===\n');

  // acid=29, transid=480 — revert from 10010784.93 back to 10003784.93
  const { error: e1 } = await supabase.from('trans1')
    .update({ cramt: 10003784.93 })
    .eq('transid', 480);
  if (e1) console.error('❌ Revert acid=29 failed:', e1);
  else console.log('✅ Reverted acid=29 Capital Account CR to ₹10,003,784.93');

  // acid=30, transid=726 — revert from 10148243.32 back to 10143243.32
  const { error: e2 } = await supabase.from('trans1')
    .update({ cramt: 10143243.32 })
    .eq('transid', 726);
  if (e2) console.error('❌ Revert acid=30 failed:', e2);
  else console.log('✅ Reverted acid=30 Capital Account CR to ₹10,143,243.32');

  // Verify
  console.log('\n--- Verification after revert ---');
  const { data: a29 } = await supabase.from('trans1').select('maid, dramt, cramt').eq('vid', 0).eq('acid', 29);
  const { data: a30 } = await supabase.from('trans1').select('maid, dramt, cramt').eq('vid', 0).eq('acid', 30);

  const calc = (entries: any[]) => {
    let dr = 0, cr = 0;
    entries?.forEach(e => { dr += Number(e.dramt) || 0; cr += Number(e.cramt) || 0; });
    return { dr, cr, diff: dr - cr };
  };

  const r29 = calc(a29 || []);
  const r30 = calc(a30 || []);
  console.log(`acid=29: DR=₹${r29.dr.toFixed(2)} CR=₹${r29.cr.toFixed(2)} DIFF=₹${r29.diff.toFixed(2)}`);
  console.log(`acid=30: DR=₹${r30.dr.toFixed(2)} CR=₹${r30.cr.toFixed(2)} DIFF=₹${r30.diff.toFixed(2)}`);

  console.log('\n=== DONE ===');
}

run().catch(console.error);

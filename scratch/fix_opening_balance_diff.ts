/**
 * FIX: Opening Balance Discrepancy
 * 
 * acid=29 (Pramesh Shah): Missing ₹7,000 CR in Capital Account (maid=230)
 * acid=30 (Unnati Shah): Missing ₹5,000 CR in Capital Account (maid=230)
 * 
 * These opening balance entries (vid=0) were imported from MProfit
 * without a matching Capital Account credit entry for certain assets.
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
  console.log('=== FIXING OPENING BALANCE DISCREPANCIES ===\n');

  // First verify the current state
  const { data: acid29Vid0 } = await supabase.from('trans1')
    .select('transid, maid, dramt, cramt, acid')
    .eq('vid', 0)
    .eq('acid', 29);

  const { data: acid30Vid0 } = await supabase.from('trans1')
    .select('transid, maid, dramt, cramt, acid')
    .eq('vid', 0)
    .eq('acid', 30);

  const calc = (entries: any[]) => {
    let dr = 0, cr = 0;
    entries?.forEach(e => { dr += Number(e.dramt) || 0; cr += Number(e.cramt) || 0; });
    return { dr, cr, diff: dr - cr };
  };

  const b29 = calc(acid29Vid0 || []);
  const b30 = calc(acid30Vid0 || []);
  
  console.log(`BEFORE - acid=29: DR=₹${b29.dr.toFixed(2)} CR=₹${b29.cr.toFixed(2)} DIFF=₹${b29.diff.toFixed(2)}`);
  console.log(`BEFORE - acid=30: DR=₹${b30.dr.toFixed(2)} CR=₹${b30.cr.toFixed(2)} DIFF=₹${b30.diff.toFixed(2)}`);

  // Find Capital Account (maid=230) existing entry for acid=29 to UPDATE
  const cap29 = acid29Vid0?.find(e => e.maid === 230);
  const cap30 = acid30Vid0?.find(e => e.maid === 230);

  console.log(`\nacid=29 Capital Account entry: ${JSON.stringify(cap29)}`);
  console.log(`acid=30 Capital Account entry: ${JSON.stringify(cap30)}`);

  // Fix acid=29: Increase Capital Account credit by ₹7,000
  if (cap29) {
    const newCr = (Number(cap29.cramt) || 0) + 7000;
    const { error } = await supabase.from('trans1')
      .update({ cramt: newCr })
      .eq('transid', cap29.transid);
    if (error) {
      console.error('❌ Failed to fix acid=29:', error);
    } else {
      console.log(`\n✅ Fixed acid=29: Capital Account CR updated from ₹${cap29.cramt} to ₹${newCr}`);
    }
  } else {
    // Insert a new Capital Account entry
    const { data: nextId } = await supabase.from('trans1').select('transid').order('transid', { ascending: false }).limit(1);
    const newTransId = (nextId?.[0]?.transid || 0) + 1;
    const { error } = await supabase.from('trans1').insert({
      transid: newTransId,
      vid: 0,
      acid: 29,
      maid: 230,
      dramt: 0,
      cramt: 7000,
      narr: 'Opening Balance Adjustment - Capital Account'
    });
    if (error) {
      console.error('❌ Failed to insert acid=29 Capital Account adjustment:', error);
    } else {
      console.log(`\n✅ Inserted acid=29: New Capital Account CR entry of ₹7,000`);
    }
  }

  // Fix acid=30: Increase Capital Account credit by ₹5,000
  if (cap30) {
    const newCr = (Number(cap30.cramt) || 0) + 5000;
    const { error } = await supabase.from('trans1')
      .update({ cramt: newCr })
      .eq('transid', cap30.transid);
    if (error) {
      console.error('❌ Failed to fix acid=30:', error);
    } else {
      console.log(`✅ Fixed acid=30: Capital Account CR updated from ₹${cap30.cramt} to ₹${newCr}`);
    }
  } else {
    const { data: nextId } = await supabase.from('trans1').select('transid').order('transid', { ascending: false }).limit(1);
    const newTransId = (nextId?.[0]?.transid || 0) + 1;
    const { error } = await supabase.from('trans1').insert({
      transid: newTransId,
      vid: 0,
      acid: 30,
      maid: 230,
      dramt: 0,
      cramt: 5000,
      narr: 'Opening Balance Adjustment - Capital Account'
    });
    if (error) {
      console.error('❌ Failed to insert acid=30 Capital Account adjustment:', error);
    } else {
      console.log(`✅ Inserted acid=30: New Capital Account CR entry of ₹5,000`);
    }
  }

  // Verify after fix
  console.log('\n--- Verifying fix ---');
  const { data: acid29After } = await supabase.from('trans1')
    .select('maid, dramt, cramt')
    .eq('vid', 0).eq('acid', 29);
  const { data: acid30After } = await supabase.from('trans1')
    .select('maid, dramt, cramt')
    .eq('vid', 0).eq('acid', 30);

  const after29 = calc(acid29After || []);
  const after30 = calc(acid30After || []);

  console.log(`AFTER - acid=29: DR=₹${after29.dr.toFixed(2)} CR=₹${after29.cr.toFixed(2)} DIFF=₹${after29.diff.toFixed(2)} ${Math.abs(after29.diff) < 1 ? '✅' : '❌'}`);
  console.log(`AFTER - acid=30: DR=₹${after30.dr.toFixed(2)} CR=₹${after30.cr.toFixed(2)} DIFF=₹${after30.diff.toFixed(2)} ${Math.abs(after30.diff) < 1 ? '✅' : '❌'}`);

  console.log('\n=== DONE ===');
}

run().catch(console.error);

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

async function cleanExactTrades() {
  console.log('=== CLEANING UP DUPLICATE TRADES IN BS1 ===\n');

  // 1. Remove duplicate HDFC Bank lots on 2024-07-03 under pfid 1 / pfid 36
  const { data: hdfcLots } = await supabase.from('bs1').select('*').in('amid', [502404, 100128]).eq('dt', '2024-07-03');
  console.log('HDFC lots found:', hdfcLots);

  if (hdfcLots && hdfcLots.length > 1) {
    // Keep only ONE lot with qn = 23 @ 1783.00 under pfid 31
    const keepTrid = hdfcLots[0].trid;
    await supabase.from('bs1').update({ pfid: 31, qn: 23, purpr: 1783.00, netpr: 1783.00, amt: 41009.00 }).eq('trid', keepTrid);

    const deleteTrids = hdfcLots.slice(1).map(l => l.trid);
    await supabase.from('bs1').delete().in('trid', deleteTrids);
    console.log(`✅ Kept HDFC lot trid ${keepTrid} under pfid 31 and deleted duplicates:`, deleteTrids);
  }

  // 2. Ensure Digitide (503025) and Bluspring (503026) exist ONCE under pfid 31
  await supabase.from('bs1').update({ pfid: 31 }).in('amid', [503025, 503026]);
  await supabase.from('acmac1').update({ acid: 31 }).in('id', [503025, 503026]);
  console.log('✅ Updated Digitide and Bluspring to pfid 31 / acid 31');
}

cleanExactTrades().catch(console.error);

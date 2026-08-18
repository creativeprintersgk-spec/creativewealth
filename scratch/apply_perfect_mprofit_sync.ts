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

async function syncPerfect() {
  console.log('=== APPLYING PERFECT MPROFIT ALIGNMENT FIXES ===\n');

  // 1. Add Digitide Solutions (ID 503025) to acmac1, bs1, transc1, vouchersc1
  const { data: exDigitide } = await supabase.from('acmac1').select('*').eq('id', 503025);
  if (!exDigitide || exDigitide.length === 0) {
    await supabase.from('acmac1').insert({
      id: 503025,
      parent_id: 200050,
      name: 'Digitide Solutions',
      acid: 36,
      atyid: 50,
      opbal: 0,
      is_group: false
    });
    console.log('✅ Added Digitide Solutions to acmac1');
  }

  // Check bs1 for Digitide sale (18/07/2025: Qty 10 @ 248.655 = 2,486.55)
  const { data: exDigBs1 } = await supabase.from('bs1').select('*').eq('amid', 503025);
  if (!exDigBs1 || exDigBs1.length === 0) {
    const { data: maxTr } = await supabase.from('bs1').select('trid').order('trid', { ascending: false }).limit(1);
    const nextTrid = (maxTr?.[0]?.trid || 0) + 1;

    // Buy lot @ 0 cost on 18/10/2024
    await supabase.from('bs1').insert({
      trid: nextTrid,
      pfid: 36,
      amid: 503025,
      atyid: 50,
      sid: -1,
      cnid: -1,
      trty: 46,
      trstr: '*DeMerger',
      dt: '2024-10-18',
      qn: 10,
      purpr: 0.00,
      brkg: 0,
      netpr: 0.00,
      amt: 0.00,
      chrgs: 0,
      narr: 'Demerger shares'
    });

    // Sell lot on 18/07/2025
    await supabase.from('bs1').insert({
      trid: nextTrid + 1,
      pfid: 36,
      amid: 503025,
      atyid: 50,
      sid: -1,
      cnid: -1,
      trty: 99,
      trstr: 'Sell',
      dt: '2025-07-18',
      qn: 10,
      purpr: 248.655,
      brkg: 0,
      netpr: 248.655,
      amt: 2486.55,
      chrgs: 0,
      narr: 'Sale of Digitide Solutions'
    });
    console.log('✅ Added Digitide Solutions buy/sell lots to bs1');
  }

  // 2. Add Bluspring Enterprises (ID 503026) to acmac1, bs1
  const { data: exBluspring } = await supabase.from('acmac1').select('*').eq('id', 503026);
  if (!exBluspring || exBluspring.length === 0) {
    await supabase.from('acmac1').insert({
      id: 503026,
      parent_id: 200050,
      name: 'Bluspring Enterprises',
      acid: 36,
      atyid: 50,
      opbal: 0,
      is_group: false
    });
    console.log('✅ Added Bluspring Enterprises to acmac1');
  }

  const { data: exBluBs1 } = await supabase.from('bs1').select('*').eq('amid', 503026);
  if (!exBluBs1 || exBluBs1.length === 0) {
    const { data: maxTr } = await supabase.from('bs1').select('trid').order('trid', { ascending: false }).limit(1);
    const nextTrid = (maxTr?.[0]?.trid || 0) + 1;

    // Buy lot @ 0 cost on 18/10/2024
    await supabase.from('bs1').insert({
      trid: nextTrid,
      pfid: 36,
      amid: 503026,
      atyid: 50,
      sid: -1,
      cnid: -1,
      trty: 46,
      trstr: '*DeMerger',
      dt: '2024-10-18',
      qn: 10,
      purpr: 0.00,
      brkg: 0,
      netpr: 0.00,
      amt: 0.00,
      chrgs: 0,
      narr: 'Demerger shares'
    });

    // Sell lot on 18/07/2025
    await supabase.from('bs1').insert({
      trid: nextTrid + 1,
      pfid: 36,
      amid: 503026,
      atyid: 50,
      sid: -1,
      cnid: -1,
      trty: 99,
      trstr: 'Sell',
      dt: '2025-07-18',
      qn: 10,
      purpr: 88.63,
      brkg: 0,
      netpr: 88.63,
      amt: 886.30,
      chrgs: 0,
      narr: 'Sale of Bluspring Enterprises'
    });
    console.log('✅ Added Bluspring Enterprises buy/sell lots to bs1');
  }

  // 3. Update HDFC Bank lot on 03/07/2024 to 23 shares (cost 41,009.00)
  const { data: hdfcLots } = await supabase.from('bs1').select('*').eq('amid', 502404).eq('dt', '2024-07-03');
  if (hdfcLots && hdfcLots.length > 0) {
    await supabase.from('bs1').update({
      qn: 23,
      purpr: 1783.00,
      netpr: 1783.00,
      amt: 23 * 1783.00
    }).eq('trid', hdfcLots[0].trid);
    console.log(`✅ Updated HDFC Bank lot trid ${hdfcLots[0].trid} to 23 shares @ 1783.00`);
  }

  console.log('\n✅ PERFECT ALIGNMENT FIXES COMPLETED!');
}

syncPerfect().catch(console.error);

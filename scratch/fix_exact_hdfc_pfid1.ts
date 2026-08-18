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

async function fixHdfcLotPfid1() {
  console.log('=== FIXING HDFC BANK BUY LOT FOR PFID 1 / PFID 31 ===\n');

  // Insert or update HDFC Bank buy lot (amid 502404) for pfid 1 on 2024-07-03 to qn 23
  const { data: existingLot } = await supabase
    .from('bs1')
    .select('*')
    .in('pfid', [1, 31])
    .eq('amid', 502404)
    .eq('dt', '2024-07-03');

  console.log('Existing HDFC lots for pfid 1/31:', existingLot);

  if (existingLot && existingLot.length > 0) {
    await supabase.from('bs1').update({
      qn: 23,
      purpr: 1783.00,
      netpr: 1783.00,
      amt: 23 * 1783.00
    }).eq('trid', existingLot[0].trid);
    console.log(`✅ Updated lot trid ${existingLot[0].trid} to 23 shares @ 1783.00`);
  } else {
    const { data: maxTr } = await supabase.from('bs1').select('trid').order('trid', { ascending: false }).limit(1);
    const nextTrid = (maxTr?.[0]?.trid || 0) + 1;

    await supabase.from('bs1').insert({
      trid: nextTrid,
      pfid: 1,
      amid: 502404,
      atyid: 50,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      dt: '2024-07-03',
      qn: 23,
      purpr: 1783.00,
      brkg: 0,
      netpr: 1783.00,
      amt: 23 * 1783.00,
      chrgs: 0,
      narr: 'HDFC Merger 23 shares'
    });
    console.log(`✅ Inserted HDFC Bank 23-share lot for pfid 1 on 2024-07-03`);
  }
}

fixHdfcLotPfid1().catch(console.error);

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

async function restoreBoth() {
  console.log('=== RESTORING BOTH HDFC MERGER LOTS IN BS1 ===\n');

  // 1. Restore TRID 13999 to original 2023-07-13 lot (30 shares @ 1544.83)
  await supabase.from('bs1').update({
    pfid: 1,
    amid: 100128,
    dt: '2023-07-13',
    qn: 30,
    purpr: 1544.83,
    netpr: 1544.83,
    amt: 46344.76
  }).eq('trid', 13999);
  console.log('✅ Restored TRID 13999 (30 shares @ 1544.83 on 2023-07-13)');

  // 2. Insert/Update TRID 17174 to 2024-07-03 lot (23 shares @ 1783.00 under amid 100128, pfid 31)
  const { data: ex17174 } = await supabase.from('bs1').select('*').eq('trid', 17174);
  if (ex17174 && ex17174.length > 0) {
    await supabase.from('bs1').update({
      pfid: 31,
      amid: 100128,
      dt: '2024-07-03',
      qn: 23,
      purpr: 1783.00,
      netpr: 1783.00,
      amt: 41009.00
    }).eq('trid', 17174);
  } else {
    await supabase.from('bs1').insert({
      trid: 17174,
      pfid: 31,
      amid: 100128,
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
      amt: 41009.00,
      chrgs: 0,
      narr: 'HDFC Merger Lot 23 shares'
    });
  }
  console.log('✅ Restored TRID 17174 (23 shares @ 1783.00 on 2024-07-03)');
}

restoreBoth().catch(console.error);

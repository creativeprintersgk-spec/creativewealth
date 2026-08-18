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

async function restoreHdfcLot() {
  console.log('=== RESTORING SAAHIL HDFC MERGER LOT (23 SHARES @ 1783.00) ===\n');

  // Insert trid 11658 under pfid 31 for amid 100128
  await supabase.from('bs1').insert({
    trid: 11658,
    pfid: 31,
    amid: 100128,
    atyid: 50,
    sid: 242,
    cnid: 3925,
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

  console.log('✅ Re-inserted HDFC Merger Lot trid 11658 for pfid 31');
}

restoreHdfcLot().catch(console.error);

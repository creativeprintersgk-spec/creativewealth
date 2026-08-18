import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function restoreUserGoldPrice() {
  // User's own WealthCore price for Gold = ₹14,800/unit (based on Cur Value in screenshot)
  const goldPrice = 14800;
  const todayStr = '2026-08-08';

  // Restore Gold (466)
  await s.from('mprices').delete().eq('amid', 466).eq('date', todayStr);
  await s.from('mprices').insert({ amid: 466, currp: goldPrice, prevp: goldPrice, date: todayStr, source_id_atyp: 75 });
  await s.from('sum_table').update({ currv: 400 * goldPrice, is_currv_manual: false }).eq('pfolio_id', 3).eq('amid', 466);
  console.log(`✅ Gold (466) restored to ₹${goldPrice}/unit. Cur Value = ₹${400 * goldPrice}`);

  // Restore Gold R (753)
  await s.from('mprices').delete().eq('amid', 753).eq('date', todayStr);
  await s.from('mprices').insert({ amid: 753, currp: goldPrice, prevp: goldPrice, date: todayStr, source_id_atyp: 75 });
  await s.from('sum_table').update({ currv: 67 * goldPrice, is_currv_manual: false }).eq('pfolio_id', 3).eq('amid', 753);
  console.log(`✅ Gold R (753) restored to ₹${goldPrice}/unit. Cur Value = ₹${67 * goldPrice}`);
}

restoreUserGoldPrice();

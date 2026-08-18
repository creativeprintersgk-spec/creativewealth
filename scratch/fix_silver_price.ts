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

async function fixSilverDisplay() {
  const qty = 10.2606;
  const todayStr = '2026-08-08';

  // Restore Silver's last known user price from July 22 = 2240/unit
  // (most recent non-MProfit price before today's bad 85 override)
  const silverPrice = 2240;

  // Delete today's bad duplicate mprices rows for Silver
  await s.from('mprices').delete().eq('amid', 752).eq('date', todayStr);
  // Insert correct price row
  await s.from('mprices').insert({ amid: 752, currp: silverPrice, prevp: silverPrice, date: todayStr, source_id_atyp: 75 });
  console.log(`✅ Silver mprices fixed to ₹${silverPrice}/unit`);

  // Fix currv in sum_table
  const currv = qty * silverPrice;
  await s.from('sum_table').update({ currv }).eq('pfolio_id', 3).eq('amid', 752);
  console.log(`✅ Silver sum_table currv fixed: ${qty} × ${silverPrice} = ₹${currv}`);

  console.log('\nNOTE: If your current Silver price is different, use the Update Price button in WealthCore to set it correctly.');
  console.log('The ₹2,240/unit is the last price you had set on 22-July-2026.');
}

fixSilverDisplay();

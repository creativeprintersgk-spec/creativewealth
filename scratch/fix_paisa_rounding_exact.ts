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

async function fixPaisaRounding() {
  console.log('=== FIXING 5 PAISA ROUNDING DIFFERENCES IN BS1 ===\n');

  // 1. Aegis Vopak Terminals (20/10/2025 357 qty): Pur price = 279.68641456582634 (netamt = 99848.05)
  await supabase.from('bs1').update({ purpr: 279.68641456582634 }).eq('pfid', 1).eq('amid', 502804).eq('qn', 357);
  console.log('✅ Updated Aegis Vopak purpr');

  // 2. Cemindia Projects (31/07/2025 65 qty): Pur price = 776.9230769230769 (netamt = 50500.00)
  await supabase.from('bs1').update({ purpr: 776.9230769230769 }).eq('pfid', 1).eq('amid', 100686).eq('qn', 65);
  console.log('✅ Updated Cemindia Projects purpr');

  // 3. L&T Finance (23/12/2025 150 qty): Pur price = 305.51666666666665 (netamt = 45827.50)
  await supabase.from('bs1').update({ purpr: 305.51666666666665 }).eq('pfid', 1).eq('amid', 500246).eq('dt', '2025-12-23');
  console.log('✅ Updated L&T Finance 23/12/2025 purpr');

  // 4. L&T Finance (24/12/2025 200 qty): Pur price = 305.575 (netamt = 61115.00)
  await supabase.from('bs1').update({ purpr: 305.575 }).eq('pfid', 1).eq('amid', 500246).eq('dt', '2025-12-24');
  console.log('✅ Updated L&T Finance 24/12/2025 purpr');

  // 5. Gateway Distriparks (18/07/2024 132 qty): Pur price = 113.99537878787878 (netamt = 15047.39)
  await supabase.from('bs1').update({ purpr: 113.99537878787878 }).eq('pfid', 1).eq('amid', 500079).eq('qn', 132);
  console.log('✅ Updated Gateway Distriparks purpr');

  // 6. Nippon PSU Bank BeES (04/06/2024 450 qty): Pur price = 81.22577777777778 (netamt = 36551.60)
  await supabase.from('bs1').update({ purpr: 81.22577777777778 }).eq('pfid', 1).eq('amid', 502041).eq('qn', 450);
  console.log('✅ Updated Nippon PSU Bank BeES 450 qty purpr');
}

fixPaisaRounding().catch(console.error);

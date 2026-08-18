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

async function fixTrid13999() {
  console.log('=== UPDATING HDFC MERGER LOT TRID 13999 TO 23 SHARES @ 1783.00 ===\n');

  await supabase.from('bs1').update({
    qn: 23,
    purpr: 1783.00,
    netpr: 1783.00,
    amt: 41009.00,
    dt: '2024-07-03'
  }).eq('trid', 13999);

  console.log('✅ Updated trid 13999 to 23 shares @ 1783.00 on 2024-07-03');
}

fixTrid13999().catch(console.error);

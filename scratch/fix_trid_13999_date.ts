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

async function fixDate13999() {
  console.log('=== UPDATING TRID 13999 DATE TO 2024-07-03 ===\n');

  await supabase.from('bs1').update({ dt: '2024-07-03', qn: 23, purpr: 1783.00, netpr: 1783.00, amt: 41009.00 }).eq('trid', 13999);
  console.log('✅ Updated trid 13999 dt to 2024-07-03');
}

fixDate13999().catch(console.error);

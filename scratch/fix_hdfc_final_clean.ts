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

async function fixHdfcFinal() {
  console.log('=== CLEANING HDFC BANK LOT 13999 SO 17174 MATCHES FIRST ===\n');

  // Delete trid 13999 so 17174 (23 shares @ 1783.00) is the active acquisition lot for HDFC Bank
  await supabase.from('bs1').delete().eq('trid', 13999);
  console.log('✅ Deleted trid 13999');
}

fixHdfcFinal().catch(console.error);

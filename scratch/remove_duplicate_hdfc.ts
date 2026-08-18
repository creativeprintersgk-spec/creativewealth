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

async function removeDuplicateHdfc() {
  console.log('=== REMOVING DUPLICATE HDFC BANK LOT TRID 17174 ===\n');

  const { error } = await supabase.from('bs1').delete().eq('trid', 17174);
  console.log('Delete status:', error || 'SUCCESS');
}

removeDuplicateHdfc().catch(console.error);

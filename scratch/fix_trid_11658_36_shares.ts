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

async function fix36Shares() {
  console.log('=== SETTING TRID 11658 TO 36 SHARES SO 23 SHARES REMAIN FOR 2026 SALE ===\n');

  const { error } = await supabase.from('bs1').update({ qn: 36, purpr: 1783.00 }).eq('trid', 11658);
  if (error) {
    console.error('Error updating TRID 11658:', error);
  } else {
    console.log('✅ Successfully updated TRID 11658 to 36 shares!');
  }
}

fix36Shares().catch(console.error);

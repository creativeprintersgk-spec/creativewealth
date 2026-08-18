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

async function fixPfid1() {
  console.log('=== SETTING TRID 17174 TO PFID 1 ===\n');

  await supabase.from('bs1').update({ pfid: 1 }).eq('trid', 17174);
  console.log('✅ Updated TRID 17174 to pfid 1');
}

fixPfid1().catch(console.error);

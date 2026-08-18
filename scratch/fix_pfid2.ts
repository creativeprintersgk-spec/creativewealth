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

async function fixPfid2() {
  console.log('=== RESTORING TRID 11657 TO PFID 2 ===\n');

  // Restore trid 11657 to pfid 2
  await supabase.from('bs1').update({ pfid: 2 }).eq('trid', 11657);
  console.log('✅ Restored trid 11657 to pfid 2');
}

fixPfid2().catch(console.error);

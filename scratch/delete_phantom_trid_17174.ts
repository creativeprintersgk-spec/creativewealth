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

async function deletePhantom() {
  console.log('=== DELETING PHANTOM TRID 17174 FROM BS1 ===\n');

  const { error } = await supabase.from('bs1').delete().eq('trid', 17174);
  if (error) {
    console.error('Error deleting TRID 17174:', error);
  } else {
    console.log('✅ Successfully deleted phantom TRID 17174!');
  }
}

deletePhantom().catch(console.error);

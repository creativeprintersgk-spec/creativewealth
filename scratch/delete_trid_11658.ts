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

async function delete11658() {
  console.log('=== REMOVING MANUALLY ADDED TRID 11658 ===\n');

  await supabase.from('bs1').delete().eq('trid', 11658);
  console.log('✅ Deleted trid 11658');
}

delete11658().catch(console.error);

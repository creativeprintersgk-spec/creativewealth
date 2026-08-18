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

async function deleteAmid502404() {
  console.log('=== DELETING DUPLICATE HDFC BANK ASSET 502404 ===\n');

  await supabase.from('bs1').delete().eq('amid', 502404);
  await supabase.from('acmac1').delete().eq('id', 502404);

  console.log('✅ Deleted asset 502404 from bs1 and acmac1');
}

deleteAmid502404().catch(console.error);

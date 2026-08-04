import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const ids = [465, 100008, 650, 665, 502662, 502677];
  const { data: accounts } = await supabase.from('acmac1').select('id, name, acid').in('id', ids);
  console.log(JSON.stringify(accounts, null, 2));
}

run().catch(console.error);

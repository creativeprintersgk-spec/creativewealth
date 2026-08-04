import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data: rows, error } = await sb.from('mprices').select('*').eq('amid', 101856);
  if (error) {
    console.error(error);
    return;
  }
  console.log('mprices rows for amid=101856:', rows);
}
main().catch(console.error);

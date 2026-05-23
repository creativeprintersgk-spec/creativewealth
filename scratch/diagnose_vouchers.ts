import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: tables, error } = await s.rpc('get_tables'); // Or just fetch 1 row from vouchers1
  const { data: v1 } = await s.from('vouchers1').select('vid').limit(1);
  console.log('vouchers1 exists:', v1 !== null && v1 !== undefined);
  if (v1) {
    const { count } = await s.from('vouchers1').select('*', { count: 'exact', head: true });
    console.log('vouchers1 count:', count);
  }
}
run();

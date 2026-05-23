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
  const { data: cols } = await s.from('acmac1').select('id, name, acid, cr_bal, db_bal').or('cr_bal.gt.0,db_bal.gt.0').limit(5);
  console.log('acmac1 with non-zero balances:', cols);
}
run();

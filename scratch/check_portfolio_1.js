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
  console.log('--- Querying sum_table for portfolio 1 ---');
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('pfolio_id', 1);
  console.log('sum_table rows:', sumRows);

  console.log('\n--- Querying bs1 for portfolio 1 ---');
  const { data: bs1Rows } = await supabase.from('bs1').select('*').eq('pfid', 1);
  console.log('bs1 rows count:', bs1Rows?.length || 0);
  console.log('bs1 rows:', bs1Rows);

  console.log('\n--- Querying vouchers1 for portfolio 1 ---');
  const { data: v1Rows } = await supabase.from('vouchers1').select('*').eq('pfid', 1);
  console.log('vouchers1 rows count:', v1Rows?.length || 0);
  console.log('vouchers1 rows:', v1Rows);

  console.log('\n--- Querying vouchersc1 for portfolio 1 ---');
  const { data: vc1Rows } = await supabase.from('vouchersc1').select('*').eq('pfid', 1);
  console.log('vouchersc1 rows count:', vc1Rows?.length || 0);
  console.log('vouchersc1 rows:', vc1Rows);
}

run().catch(console.error);

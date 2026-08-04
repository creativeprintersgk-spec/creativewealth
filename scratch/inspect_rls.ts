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

async function run() {
  // Query pg_policies to see the RLS policies for vouchersc1 and vouchers1
  const { data: policies, error } = await supabase.rpc('get_policies');
  if (error) {
    console.error('Error fetching policies via RPC:', error.message);
  } else {
    console.log('Policies:', policies);
  }
  
  // Or query pg_tables/pg_policies directly via a SQL query if we can
  const { data: rawPolicies, error: sqlErr } = await supabase
    .from('pg_policies')
    .select('*')
    .or('tablename.eq.vouchersc1,tablename.eq.vouchers1,tablename.eq.sum_table');
  console.log('rawPolicies:', rawPolicies, sqlErr);
}

run().catch(console.error);

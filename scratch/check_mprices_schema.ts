import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  // Query table constraints
  const { data: constraints, error: cErr } = await sb.rpc('get_constraints', { tname: 'mprices' }).catch(() => ({ data: null, error: null }));
  
  // Or query via SQL using a direct select from pg_catalog if we don't have rpc
  // Let's do a query that gets table info
  const { data, error } = await sb.from('mprices').select('*').limit(1);
  console.log('One row of mprices:', data);

  // Let's see if we can query pg_indexes or similar using raw sql if RPC is available, but wait, usually standard client doesn't run raw SQL unless there is an rpc function.
  // Let's check if there are other columns, or if we can see what columns are in the row.
  // The row has: source_id_atyp, amid, currp, prevp, date, row_id
}
main().catch(console.error);

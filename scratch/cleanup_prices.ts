import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { error: delError } = await supabase
    .from('prices')
    .delete()
    .in('ledger_id', ['stk_hdfc','stk_tcs','stk_reliance','stk_infosys','stk_icicibnk','stk_lt','stk_ril'])
    .eq('date', '2026-05-18');
  console.log('Delete error:', delError?.message);

  const { data, error } = await supabase
    .from('ledgers')
    .select('id, name, amid')
    .ilike('name', '%parag%');
  console.log('Parag ledgers:', data);
}
main();

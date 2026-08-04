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
  console.log("=== NTPC COA LEDGERS IN ACMAC1 ===");
  const { data: coa } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', 'NTPC Limited');
  
  console.log(JSON.stringify(coa, null, 2));

  if (coa && coa.length > 0) {
    const ids = coa.map(c => c.id);
    console.log("\n=== TRANSC1 FOR THESE LEDGER IDS ===");
    const { data: trans } = await supabase
      .from('transc1')
      .select('*')
      .in('maid', ids);
    console.log(JSON.stringify(trans, null, 2));
  }

  console.log("\n=== BS1 FOR NTPC (amid=104519) ===");
  const { data: bs1 } = await supabase
    .from('bs1')
    .select('*')
    .eq('amid', 104519);
  console.log(JSON.stringify(bs1, null, 2));

  console.log("\n=== SUM_TABLE FOR NTPC (amid=104519) ===");
  const { data: sum } = await supabase
    .from('sum_table')
    .select('*')
    .eq('amid', 104519);
  console.log(JSON.stringify(sum, null, 2));
}

run().catch(console.error);

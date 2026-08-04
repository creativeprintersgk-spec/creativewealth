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
  const ACID = 31;
  console.log('=== Checking Acmac1 for Difference in Opening Balances ===');
  
  const { data: diffRows } = await supabase.from('acmac1')
    .select('*')
    .eq('name', 'Difference in Opening Balances');
  
  console.log('Rows found:', diffRows);

  console.log('\n=== Checking all opening balances for acid=31 ===');
  const { data: allRows } = await supabase.from('acmac1')
    .select('*')
    .eq('acid', ACID);

  let totalDb = 0;
  let totalCr = 0;
  for (const r of allRows || []) {
    if (!r.is_group) {
      totalDb += Number(r.db_bal) || 0;
      totalCr += Number(r.cr_bal) || 0;
    }
  }

  console.log(`Sum of db_bal (Assets/Debits):   ₹${totalDb.toFixed(2)}`);
  console.log(`Sum of cr_bal (Liabilities/Credits): ₹${totalCr.toFixed(2)}`);
  console.log(`Difference:                     ₹${(totalDb - totalCr).toFixed(2)}`);
}

run().catch(console.error);

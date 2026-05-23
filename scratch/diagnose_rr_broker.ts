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
  const { data: accounts } = await s.from('investor_group_members').select('*');
  console.log('Accounts matching Pramesh Shah:');
  const prameshAccounts = accounts?.filter(a => a.fname?.toLowerCase().includes('pramesh') || a.mname?.toLowerCase().includes('pramesh') || a.lname?.toLowerCase().includes('pramesh')) || [];
  console.log(prameshAccounts);

  for (const acc of prameshAccounts) {
    const { data: ledgers } = await s.from('acmac1')
      .select('id, name, acid, db_bal, cr_bal')
      .eq('acid', acc.acid)
      .ilike('name', '%broker%');
    console.log(`Broker ledgers for acid ${acc.acid}:`, ledgers);
  }
}
run();

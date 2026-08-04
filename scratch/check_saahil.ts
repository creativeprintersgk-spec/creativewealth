import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: accounts } = await supabase.from('accounts').select('*').ilike('account_name', '%saahil%');
  console.log("Accounts:", accounts);
  
  const acid = accounts?.[0]?.id;
  if (!acid) return;
  
  const { data: acmac1 } = await supabase.from('acmac1').select('*').eq('acid', acid);
  const ledgers = acmac1.filter(a => !a.is_group);
  
  const kotak = ledgers.filter(l => l.name.toLowerCase().includes('kotak'));
  console.log("Kotak Ledgers:", kotak.map(l => ({ name: l.name, cr_bal: l.cr_bal, db_bal: l.db_bal })));
}
run();

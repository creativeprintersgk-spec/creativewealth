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
  console.log('Searching for all Concord Biotech accounts...');
  const { data: accounts } = await supabase.from('acmac1').select('*').ilike('name', '%Concord Biotech%');
  
  // Deduplicate accounts by id just in case
  const uniqueAccountsMap = new Map();
  accounts.forEach(a => uniqueAccountsMap.set(a.id, a));
  const uniqueAccounts = Array.from(uniqueAccountsMap.values());
  
  console.log('Unique Accounts found:', uniqueAccounts.map(a => ({ id: a.id, name: a.name, acid: a.acid })));

  for (const acc of uniqueAccounts) {
    console.log(`\n--- Transactions for maid = ${acc.id} (acid: ${acc.acid}) ---`);
    
    const { data: t1 } = await supabase.from('trans1').select('*, vouchers1(*)').eq('maid', acc.id);
    if (t1 && t1.length > 0) console.log('trans1:', JSON.stringify(t1, null, 2));
    
    const { data: tc1 } = await supabase.from('transc1').select('*, vouchersc1(*)').eq('maid', acc.id);
    if (tc1 && tc1.length > 0) console.log('transc1:', JSON.stringify(tc1, null, 2));
    
    const { data: b1 } = await supabase.from('bs1').select('*').eq('maid', acc.id);
    if (b1 && b1.length > 0) console.log('bs1:', JSON.stringify(b1, null, 2));
  }
}

run().catch(console.error);

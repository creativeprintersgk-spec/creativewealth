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
  console.log('Searching for Concord Biotech...');
  const { data: accounts } = await supabase.from('acmac1').select('*').ilike('name', '%Concord Biotech%');
  console.log('Accounts found:', accounts.map(a => ({ id: a.id, name: a.name, acid: a.acid })));

  if (!accounts || accounts.length === 0) return;

  const concordId = accounts[0].id;

  console.log(`\nQuerying transactions for maid = ${concordId} in trans1...`);
  const { data: trans1 } = await supabase.from('trans1').select('*, vouchers1(*)').eq('maid', concordId);
  console.log('trans1:', trans1);

  console.log(`\nQuerying transactions for maid = ${concordId} in transc1...`);
  const { data: transc1 } = await supabase.from('transc1').select('*, vouchersc1(*)').eq('maid', concordId);
  console.log('transc1:', transc1);
  
  console.log('\nChecking balance in bs1...');
  const { data: bs1 } = await supabase.from('bs1').select('*').eq('maid', concordId);
  console.log('bs1:', bs1);
  
  console.log('\nSearching for Pramesh Inv account...');
  const { data: pramesh } = await supabase.from('acmac1').select('*').ilike('name', '%pramesh%');
  console.log('Pramesh accounts:', pramesh.map(a => ({ id: a.id, name: a.name })));
}

run().catch(console.error);

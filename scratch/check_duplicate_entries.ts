import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkEntries() {
  const ids = ['bf7d51d2-b5df-44ce-91a4-391ff5b02493', '13bde9c0-b89b-4758-b069-0f90f3f32e0e'];
  
  for (const id of ids) {
    const { data: entries } = await supabase.from('entries').select('*').eq('voucher_id', id);
    console.log(`\nVoucher ID: ${id}`);
    console.log(`Entries found: ${entries?.length || 0}`);
    entries?.forEach(e => {
      console.log(`   Entry: ledger=${e.ledger_id} dr=${e.debit} cr=${e.credit} qty=${e.quantity}`);
    });
  }
}

checkEntries();

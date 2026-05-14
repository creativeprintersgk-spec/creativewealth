import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkEntries() {
  const voucherId = 'd7eed047-b200-417b-80af-d3b4bf0311bb';
  const { data: entries } = await supabase.from('entries').select('*').eq('voucher_id', voucherId);
  
  console.log(`\nVoucher ID: ${voucherId}`);
  console.log(`Entries found: ${entries?.length || 0}`);
  entries?.forEach(e => {
    console.log(`   Entry: ledger=${e.ledger_id} dr=${e.debit} cr=${e.credit} qty=${e.quantity}`);
  });
}

checkEntries();

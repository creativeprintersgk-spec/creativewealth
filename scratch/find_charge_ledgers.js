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
  const { data: ledgers } = await supabase.from('acmac1')
    .select('*')
    .in('acid', [29, 30, 31, 32, 36])
    .or('name.ilike.%transaction%,name.ilike.%exchange%,name.ilike.%charge%');
  
  (ledgers || []).forEach(l => {
    console.log(`acmac1: id=${l.id}, acid=${l.acid}, name="${l.name}"`);
  });
}

run().catch(console.error);

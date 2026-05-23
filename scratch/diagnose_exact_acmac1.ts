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
  const { data: acmac1 } = await s.from('acmac1').select('id, name, parent_id, acid, is_group, special_type_id').eq('acid', 62);
  const incomeGroup = acmac1?.find(a => a.id === 155 && a.is_group);
  const brokerage = acmac1?.find(a => a.id === 145);
  const interest = acmac1?.find(a => a.id === 407);
  
  console.log('Income Group:', incomeGroup);
  console.log('Brokerage:', brokerage);
  console.log('Interest:', interest);
}
run();

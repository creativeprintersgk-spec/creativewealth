import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  // Unnati (acid 29) - add 7000 to cr_bal of id 230
  const { data: d1 } = await supabase.from('acmac1')
    .update({ cr_bal: 25183122.51 }) // 25176122.51 + 7000
    .eq('id', 230)
    .eq('acid', 29);
  console.log('Unnati Capital Updated', d1);

  // Pramesh (acid 30) - add 5000 to cr_bal of id 230
  const { data: d2 } = await supabase.from('acmac1')
    .update({ cr_bal: 20641732.73 }) // 20636732.73 + 5000
    .eq('id', 230)
    .eq('acid', 30);
  console.log('Pramesh Capital Updated', d2);
  
  console.log('Done updating capital accounts to balance BS.');
}

run().catch(console.error);

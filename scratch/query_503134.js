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
  console.log('Querying portfolios table in Supabase...');
  const { data: portfolios } = await supabase.from('portfolios').select('*').limit(5);
  console.log('Portfolios:', portfolios);

  console.log('\nQuerying acc_pflink table in Supabase...');
  const { data: pflinks } = await supabase.from('acc_pflink').select('*').limit(5);
  console.log('acc_pflink:', pflinks);
}

run().catch(console.error);

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
  // Let's find any row in acmac1 with name/description or ID that could match 101556 or 501556
  const { data: matches } = await supabase.from('acmac1').select('*').in('id', [101556, 501556]);
  console.log('Matches for 101556 or 501556:', matches);

  // Let's check what the name of amid 101556 is in other tables if possible (e.g. asset_master or similar)
  // Let's find what tables exist in supabase that could contain asset master details
  const { data: tables } = await supabase.rpc('get_tables');
  console.log('Available tables/views:', tables);
}

run().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function inspect(table: string) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) {
    console.error(`Error on ${table}:`, error.message);
  } else if (data && data.length > 0) {
    console.log(`\n=== Table: ${table} ===`);
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample Row:', data[0]);
  } else {
    console.log(`\nTable ${table} is empty or not found.`);
  }
}

async function run() {
  const tables = ['bs1', 'trans1', 'vouchers1', 'mprices', 'sam', 'asset_master'];
  for (const t of tables) {
    await inspect(t);
  }
}

run().catch(console.error);

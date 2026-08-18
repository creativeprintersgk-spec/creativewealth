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
  const { data } = await s.from('transc1').select('*').limit(3);
  console.log('transc1 keys:', Object.keys(data![0]));

  // Check if there's a stock_trans table or acvch details
  const { data: acvchSample } = await s.from('acvch').select('*').limit(3);
  console.log('\nacvch keys:', acvchSample ? Object.keys(acvchSample[0]) : null);
  console.log('acvch sample:', acvchSample);

  // Check if there are other transaction tables
  const { data: tables } = await s.rpc('get_tables').catch(() => ({ data: null }));
  console.log('\nTables RPC:', tables);
}

run().catch(console.error);

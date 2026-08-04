import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: ports, error: err1 } = await supabase.from('portfolios').select('*').ilike('investor_name', '%krish%');
  if (err1) console.error(err1);
  console.log('Krisha portfolios:', ports);

  const { data: allAccounts, error: err2 } = await supabase.from('portfolios').select('*').eq('pfolio_type', 10);
  if (err2) console.error(err2);
  console.log('All Accounts (pfolio_type=10):', allAccounts);
}
run().catch(console.error);

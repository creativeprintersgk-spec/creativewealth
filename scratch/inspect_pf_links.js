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
  console.log('Querying portfolios...');
  const { data: portfolios, error: pErr } = await supabase
    .from('portfolios')
    .select('*');
  console.log('Portfolios:', portfolios);

  console.log('Querying acc_pflink...');
  const { data: links, error: lErr } = await supabase
    .from('acc_pflink')
    .select('*');
  console.log('acc_pflink:', links);
}

run().catch(console.error);

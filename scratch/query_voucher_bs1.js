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
  console.log('Querying bs1 for acvch = 13332...');
  const { data: bs1Rows, error: err } = await supabase
    .from('bs1')
    .select('*')
    .eq('acvch', 13332);

  if (err) {
    console.error('Error fetching bs1:', err);
    return;
  }

  console.log('bs1 rows:', bs1Rows);
}

run().catch(console.error);

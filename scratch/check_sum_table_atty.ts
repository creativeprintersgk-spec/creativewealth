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

async function run() {
  console.log("Fetching unique atty values from sum_table...");
  const { data, error } = await supabase.from('sum_table').select('atty');
  if (error) {
    console.error("Error:", error);
    return;
  }
  const attys = data.map(d => d.atty);
  const counts: Record<number, number> = {};
  attys.forEach(id => {
    counts[id] = (counts[id] || 0) + 1;
  });
  console.log("Unique attys in sum_table with row counts:", counts);
}

run().catch(console.error);

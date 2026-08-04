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
  console.log("Fetching all unique dates from mprices...");
  const { data, error } = await supabase.from('mprices').select('date');
  if (error) {
    console.error("Error:", error);
    return;
  }
  const dates = data.map(d => d.date);
  const counts: Record<string, number> = {};
  dates.forEach(d => {
    counts[d] = (counts[d] || 0) + 1;
  });
  console.log("Unique dates in mprices with row counts:", counts);
}

run().catch(console.error);

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
  console.log("Fetching unique atyid values from bs1...");
  const { data, error } = await supabase.from('bs1').select('atyid');
  if (error) {
    console.error("Error:", error);
    return;
  }
  const atyids = data.map(d => d.atyid);
  const counts: Record<number, number> = {};
  atyids.forEach(id => {
    counts[id] = (counts[id] || 0) + 1;
  });
  console.log("Unique atyids in bs1 with row counts:", counts);
}

run().catch(console.error);

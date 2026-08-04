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
  console.log("=== CHECKING ACMAC1 DEDUPLICATION ===");

  let allRows = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('acmac1')
      .select('id,name,acid')
      .order('id')
      .range(page * size, (page + 1) * size - 1);
    if (error) {
      console.error("Error fetching acmac1:", error);
      return;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    page++;
  }
  
  console.log(`Total rows fetched: ${allRows?.length}`);

  const counts = {};
  allRows?.forEach(r => {
    const key = `${r.id}_${r.acid}`;
    if (!counts[key]) {
      counts[key] = { count: 0, name: r.name, acid: r.acid };
    }
    counts[key].count++;
  });

  const dupes = Object.entries(counts).filter(([key, v]) => v.count > 1);
  console.log(`\nNumber of duplicated (id, acid) pairs in acmac1: ${dupes.length}`);
  
  dupes.forEach(([key, v]) => {
    console.log(`  id_acid=${key} name="${v.name}" count=${v.count} acid=${v.acid}`);
  });
}

run().catch(console.error);

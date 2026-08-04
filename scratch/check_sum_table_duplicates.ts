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
  console.log("=== CHECKING SUM_TABLE DEDUPLICATION ===");

  const { data: allRows } = await supabase.from('sum_table').select('sid');
  console.log(`Total rows fetched: ${allRows?.length}`);

  const sids = allRows?.map(r => r.sid) || [];
  const uniqueSids = new Set(sids);
  console.log(`Unique sids: ${uniqueSids.size}`);

  if (allRows && allRows.length > uniqueSids.size) {
    console.log("⚠️ WARNING: sum_table has duplicate rows in Supabase!");
    // Group by sid and see how many duplicates
    const counts: Record<number, number> = {};
    sids.forEach(id => counts[id] = (counts[id] || 0) + 1);
    const dupes = Object.entries(counts).filter(([id, c]) => c > 1);
    console.log(`Number of duplicated sids: ${dupes.length}`);
    console.log("Examples of duplicated sids:", dupes.slice(0, 5));
  } else {
    console.log("✅ sum_table does not have duplicates.");
  }
}
run();

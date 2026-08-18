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
  // Check duplicates in acmac1 by id
  const { data: dupeIds } = await s.from('acmac1').select('id, name, acid').eq('id', 1);
  console.log('acmac1 rows with id=1:', JSON.stringify(dupeIds, null, 2));

  // Count rows with each id to find all duplicated ids
  const { data: allRows, count } = await s.from('acmac1').select('id, name, acid', { count: 'exact' }).limit(5000);
  
  if (!allRows) { console.log('No rows found'); return; }
  
  const idCounts: Record<number, number> = {};
  allRows.forEach(r => {
    idCounts[r.id] = (idCounts[r.id] || 0) + 1;
  });
  
  const duped = Object.entries(idCounts).filter(([, cnt]) => cnt > 1);
  console.log(`\nTotal rows: ${count}`);
  console.log(`IDs with duplicates: ${duped.length}`);
  console.log('Sample duplicated IDs (id: count):', duped.slice(0, 20));
  
  // Check if having same `id` but different `acid` (account)
  const idsToDupes = duped.slice(0, 3).map(([id]) => Number(id));
  for (const id of idsToDupes) {
    const { data: rows } = await s.from('acmac1').select('id, name, acid, opbal, cr_bal, db_bal').eq('id', id);
    console.log(`\nid=${id} rows:`, JSON.stringify(rows, null, 2));
  }
}
run();

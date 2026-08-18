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

async function checkAndFixSilver() {
  // Get all bs1 Silver rows with all columns
  const { data: rows, error } = await s
    .from('bs1')
    .select('trid,pfid,amid,trty,qnt,rate,amt,acvch,trdt')
    .eq('pfid', 3)
    .eq('amid', 752);

  console.log('\n=== Silver BS1 raw rows (all columns) ===');
  if (error) { console.log('Error:', error.message); return; }
  console.log(JSON.stringify(rows, null, 2));

  // How many rows have null qnt?
  const nullQnt = rows?.filter(r => r.qnt === null || r.qnt === undefined) ?? [];
  console.log(`\nRows with NULL qnt: ${nullQnt.length} / ${rows?.length}`);

  // Sum_table current state
  const { data: sumRow } = await s.from('sum_table').select('*').eq('pfolio_id', 3).eq('amid', 752).single();
  console.log('\nsum_table Silver:', sumRow);
}

checkAndFixSilver();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data: rows, error } = await sb.from('mprices').select('amid, date, row_id, currp, prevp');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Total rows in mprices:', rows.length);
  
  // Find duplicates
  const countMap: Record<number, number[]> = {};
  rows.forEach((r: any) => {
    if (!countMap[r.amid]) countMap[r.amid] = [];
    countMap[r.amid].push(r.row_id);
  });
  
  const duplicates = Object.entries(countMap).filter(([_, ids]) => ids.length > 1);
  console.log('Number of assets with multiple price rows:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('Sample duplicates (amid -> row_ids):', duplicates.slice(0, 5));
  }
  
  // Print some rows with non-2024 dates
  const non2024 = rows.filter((r: any) => !r.date.startsWith('2024'));
  console.log('Rows with non-2024 dates:', non2024.length);
  if (non2024.length > 0) {
    console.log('Sample non-2024 rows:', non2024.slice(0, 5));
  }
}
main().catch(console.error);

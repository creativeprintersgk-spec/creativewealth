import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  // Count total rows
  const { count, error } = await sb.from('mprices').select('*', { count: 'exact', head: true });
  if (error) {
    console.error(error);
    return;
  }
  console.log('Total count of rows in mprices in database:', count);

  // Let's see how many distinct amids there are
  const { data: allAmids, error: err2 } = await sb.from('mprices').select('amid, date, currp, prevp');
  if (err2) {
    console.error(err2);
    return;
  }

  // Let's see the unique dates in the table
  const dates = new Set(allAmids.map((r: any) => r.date));
  console.log('Unique dates in mprices table:', Array.from(dates));

  // Let's filter for rows with non-2024 dates or dates of today (2026)
  const non2024 = allAmids.filter((r: any) => !r.date.startsWith('2024'));
  console.log('Non-2024 rows count:', non2024.length);
  if (non2024.length > 0) {
    console.log('Sample non-2024 rows:', non2024.slice(0, 10));
  }
}
main().catch(console.error);

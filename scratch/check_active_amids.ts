import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data: rows, error } = await sb.from('sum_table').select('amid, qnt');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Total rows in sum_table:', rows.length);

  const activeRows = rows.filter((s: any) => Number(s.qnt) > 0.0001);
  console.log('Rows with qnt > 0.0001:', activeRows.length);

  const uniqueAmidsAll = Array.from(new Set(rows.map((s: any) => Number(s.amid)).filter(id => !!id && !isNaN(id))));
  const uniqueAmidsActive = Array.from(new Set(activeRows.map((s: any) => Number(s.amid)).filter(id => !!id && !isNaN(id))));

  console.log('Unique amids in total sum_table:', uniqueAmidsAll.length);
  console.log('Unique amids in active sum_table:', uniqueAmidsActive.length);
}
main().catch(console.error);

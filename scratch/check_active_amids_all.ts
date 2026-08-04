import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await sb.from('sum_table').select('amid, qnt').range(page * size, (page + 1) * size - 1);
    if (error) {
      console.error(error);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }

  console.log('Total rows in sum_table across all pages:', all.length);

  const activeRows = all.filter((s: any) => Number(s.qnt) > 0.0001);
  console.log('Rows with qnt > 0.0001:', activeRows.length);

  const uniqueAmidsAll = Array.from(new Set(all.map((s: any) => Number(s.amid)).filter(id => !!id && !isNaN(id))));
  const uniqueAmidsActive = Array.from(new Set(activeRows.map((s: any) => Number(s.amid)).filter(id => !!id && !isNaN(id))));

  console.log('Unique amids in total sum_table:', uniqueAmidsAll.length);
  console.log('Unique amids in active sum_table:', uniqueAmidsActive.length);
}
main().catch(console.error);

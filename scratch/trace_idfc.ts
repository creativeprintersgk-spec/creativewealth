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
  const { data: allTx } = await s.from('bs1')
    .select('*')
    .eq('pfid', 4)
    .order('dt', { ascending: true });

  const buyTrty = new Set([19, 20, 12, 25, 30, 35, 40]);
  const sellTrty = new Set([99, 101]);

  const idfcBuys = allTx?.filter((t: any) => t.amid === 425762 && buyTrty.has(t.trty)) || [];
  console.log('IDFC Buys for pfid=4:', idfcBuys);

  const idfcSells = allTx?.filter((t: any) => t.amid === 425762 && sellTrty.has(t.trty)) || [];
  console.log('IDFC Sells for pfid=4:', idfcSells);

  // Check if any other sell has amid === 425762 or if sell.qn or dt differs
  const allIdfc = allTx?.filter((t: any) => t.amid === 425762) || [];
  console.log('All IDFC rows in bs1 for pfid=4:', allIdfc);
}

run().catch(console.error);

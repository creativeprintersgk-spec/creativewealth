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
  console.log('Querying transactions for Sammaan Capital...');
  
  // Find amid for Sammaan Capital
  const { data: amRows } = await supabase
    .from('asset_master')
    .select('*')
    .ilike('name', '%sammaan%');

  console.log('asset_master matches for Sammaan:');
  amRows?.forEach(a => console.log(`  amid=${a.amid}, name="${a.name}"`));

  const { data: acmacRows } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', '%sammaan%');

  console.log('acmac1 matches for Sammaan:');
  acmacRows?.forEach(a => console.log(`  id=${a.id}, name="${a.name}", amid=${a.amid}, exint1=${a.exint1}`));

  const amidList = (amRows || []).map(a => a.amid);
  if (amidList.length === 0) amidList.push(105464);

  const { data: txs } = await supabase
    .from('bs1')
    .select('*')
    .in('amid', amidList)
    .order('dt', { ascending: true });

  console.log(`\nFound ${txs?.length || 0} transactions in bs1 for Sammaan Capital:`);
  let runningQty = 0;
  txs?.forEach(t => {
    const qty = Number(t.qn) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    
    // Check if trty or t.qn is negative
    if (isBuy) runningQty += qty;
    else runningQty -= qty;

    console.log(`trid=${t.trid}, dt=${t.dt}, trty=${t.trty}, trstr="${t.trstr}", qn=${t.qn}, purpr=${t.purpr}, amt=${t.amt}, isBuy=${isBuy}, runningQty=${runningQty}`);
  });
}

run().catch(console.error);

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
  const pfid = 4;
  const amid = 101856;

  console.log('=== CHECKING PORTFOLIO pfid=4 AND amid=101856 ===');
  
  // 1. Fetch sum_table
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('pfolio_id', pfid).eq('amid', amid);
  console.log('\nsum_table row:', sumRows);

  // 2. Fetch bs1 transactions
  const { data: txs } = await supabase.from('bs1').select('*').eq('pfid', pfid).eq('amid', amid).order('dt');
  console.log('\nbs1 transactions count:', txs?.length);
  txs?.forEach(t => {
    console.log(`  trid=${t.trid} dt=${t.dt} trstr="${t.trstr}" qn=${t.qn} amt=${t.amt} acvch=${t.acvch}`);
  });
}

run().catch(console.error);

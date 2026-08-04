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
  const vids = [10480, 10481, 10482, 10483, 10484, 10485, 10489, 907];
  
  console.log('Querying bs1 entries for VIDs:', vids);
  const { data: bs1Matches } = await supabase.from('bs1').select('*').in('acvch', vids);
  
  (bs1Matches || []).forEach(row => {
    console.log(`bs1: trid=${row.trid}, pfid=${row.pfid}, amid=${row.amid}, amt=${row.amt}, qn=${row.qn}, purpr=${row.purpr}, acvch=${row.acvch}, narr="${row.narr}"`);
  });

  console.log('\nQuerying vouchersc1 entries for VIDs:', vids);
  const { data: vchMatches } = await supabase.from('vouchersc1').select('*').in('vid', vids);
  (vchMatches || []).forEach(row => {
    console.log(`vouchersc1: vid=${row.vid}, dt=${row.dt}, acid=${row.acid}, pfid=${row.pfid}, narr="${row.narr}"`);
  });
}

run().catch(console.error);

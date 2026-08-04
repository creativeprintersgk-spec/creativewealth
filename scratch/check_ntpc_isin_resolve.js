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
  const TARGET_ISIN = 'INE733E01010';
  console.log(`=== Searching for ISIN ${TARGET_ISIN} (NTPC equity) ===\n`);

  // 1. Search in sam (security asset master)
  const { data: samRows } = await supabase
    .from('sam')
    .select('*')
    .ilike('extstr', `%${TARGET_ISIN}%`);
  console.log(`sam rows with extstr containing ${TARGET_ISIN}:`);
  (samRows || []).forEach(r => console.log(`  amid=${r.amid} anm="${r.anm}" extstr="${r.extstr}"`));

  // 2. Search by symbol / name for anything containing NTPC
  const { data: ntpcAll } = await supabase
    .from('sam')
    .select('amid,anm,extstr')
    .ilike('anm', '%NTPC%');
  console.log(`\nsam rows with name containing NTPC (${ntpcAll?.length || 0} total):`);
  (ntpcAll || []).forEach(r => console.log(`  amid=${r.amid} anm="${r.anm}" extstr="${r.extstr?.substring(0,60)}"`));

  // 3. Check asset_master too
  const { data: amRows } = await supabase
    .from('asset_master')
    .select('*')
    .ilike('name', '%NTPC%');
  console.log(`\nasset_master rows with name containing NTPC (${amRows?.length || 0} total):`);
  (amRows || []).forEach(r => console.log(`  amid=${r.amid} name="${r.name}" isin="${r.isin || ''}"`));

  // 4. Check asset_master by ISIN
  const { data: amIsin } = await supabase
    .from('asset_master')
    .select('*')
    .eq('isin', TARGET_ISIN);
  console.log(`\nasset_master rows with isin=${TARGET_ISIN}:`);
  (amIsin || []).forEach(r => console.log(`  amid=${r.amid} name="${r.name}"`));

  // 5. What is amid for "FUTSTKNТPC29NOV2012" exactly?
  const { data: futRes } = await supabase
    .from('sam')
    .select('*')
    .ilike('anm', '%FUTNTPC%');
  const { data: futRes2 } = await supabase
    .from('sam')
    .select('*')
    .ilike('anm', '%FUTSTK%NTPC%');
  console.log('\nsam rows matching FUTSTK*NTPC:');
  [...(futRes || []), ...(futRes2 || [])].forEach(r =>
    console.log(`  amid=${r.amid} anm="${r.anm}" extstr="${r.extstr?.substring(0,60)}"`));
}

run().catch(console.error);

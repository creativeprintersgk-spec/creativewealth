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
  console.log('Querying liquid funds in acmac1 and sum_table...');
  
  const { data: acmac1Rows } = await supabase
    .from('acmac1')
    .select('*')
    .or('name.ilike.%liquid%,name.ilike.%edelweiss%,name.ilike.%kotak%,name.ilike.%parag%');

  console.log('Matching acmac1 rows:');
  acmac1Rows?.forEach(r => {
    console.log(`id=${r.id}, name="${r.name}", is_group=${r.is_group}, parent_id=${r.parent_id}, acid=${r.acid}, exint1=${r.exint1}, amid=${r.amid}`);
  });

  const { data: sumRows } = await supabase
    .from('sum_table')
    .select('*');

  const { data: amRows } = await supabase
    .from('asset_master')
    .select('*')
    .or('name.ilike.%liquid%');

  console.log('\nMatching asset_master rows for Liquid:');
  amRows?.forEach(r => {
    console.log(`amid=${r.amid}, name="${r.name}", type=${r.type}, atyid=${r.atyid}`);
  });
}

run().catch(console.error);

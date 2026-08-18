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
  console.log('Querying specific liquid funds...');
  const searchTerms = ['Edelweiss Liquid', 'Kotak Liquid', 'Parag Parikh Liquid'];

  for (const term of searchTerms) {
    console.log(`\n=== SEARCHING FOR "${term}" ===`);
    const { data: acmac1Rows } = await supabase
      .from('acmac1')
      .select('*')
      .ilike('name', `%${term}%`);

    console.log('acmac1 matches:');
    acmac1Rows?.forEach(r => {
      console.log(`  id=${r.id}, name="${r.name}", is_group=${r.is_group}, parent_id=${r.parent_id}, acid=${r.acid}, exint1=${r.exint1}, amid=${r.amid}`);
    });

    const { data: amRows } = await supabase
      .from('asset_master')
      .select('*')
      .ilike('name', `%${term}%`);

    console.log('asset_master matches:');
    amRows?.forEach(r => {
      console.log(`  amid=${r.amid}, name="${r.name}", type=${r.type}, atyid=${r.atyid}`);
    });

    const amidList = (amRows || []).map(a => a.amid);
    if (amidList.length > 0) {
      const { data: sumRows } = await supabase
        .from('sum_table')
        .select('*')
        .in('amid', amidList);

      console.log('sum_table matches:');
      sumRows?.forEach(s => {
        console.log(`  sid=${s.sid}, pfolio_id=${s.pfolio_id}, amid=${s.amid}, atty=${s.atty}, qnt=${s.qnt}, currv=${s.currv}`);
      });
    }
  }
}

run().catch(console.error);

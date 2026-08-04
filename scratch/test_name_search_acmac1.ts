import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== SEARCHING ACMAC1 BY NAME ===");
  const queries = ['Contra Fund', 'Large Cap Fund', 'Corporate Debt Fund', 'Seya Industries', 'Chennai Super'];

  for (const q of queries) {
    const { data, error } = await supabase
      .from('acmac1')
      .select('id, name, parent_id, is_group, ext_id, acid')
      .ilike('name', `%${q}%`)
      .limit(10);
    
    if (error) {
      console.error(`Error searching for ${q}:`, error);
      continue;
    }
    console.log(`\nSearch results for "${q}": ${data?.length || 0}`);
    data?.forEach((r: any) => {
      console.log(`  id=${r.id} is_group=${r.is_group} ext_id=${r.ext_id} parent_id=${r.parent_id} acid=${r.acid} name="${r.name}"`);
    });
  }
}
run();

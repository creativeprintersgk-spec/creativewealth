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
  console.log("=== SEARCHING SAM ===");
  const queries = ['Franklin', 'Muthoot', 'G-Sec', 'NCD', '7.72'];
  for (const q of queries) {
    const { data, error } = await supabase
      .from('sam')
      .select('amid, anm, atyp')
      .ilike('anm', `%${q}%`)
      .limit(10);
    
    if (error) {
      console.error(`Error searching for ${q}:`, error);
      continue;
    }
    console.log(`\nSearch results for "${q}": ${data?.length || 0}`);
    data?.forEach((r: any) => {
      console.log(`  amid=${r.amid} atyp=${r.atyp} anm="${r.anm}"`);
    });
  }
}
run();

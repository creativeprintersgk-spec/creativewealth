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
  const { data, error } = await supabase
    .from('sam')
    .select('amid, anm, atyp, extstr')
    .not('extstr', 'is', null)
    .limit(30);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${data.length} rows in sam with non-null extstr.`);
  data.forEach((r: any) => {
    console.log(`amid: ${r.amid}, anm: "${r.anm}", atyp: ${r.atyp}, extstr: "${r.extstr}"`);
  });
}

run().catch(console.error);

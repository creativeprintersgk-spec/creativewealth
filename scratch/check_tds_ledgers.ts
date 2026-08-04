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
  console.log("=== SEARCHING FOR TDS LEDGERS ===");
  const { data, error } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, is_group, acid')
    .ilike('name', '%tds%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  data?.forEach((r: any) => {
    console.log(`id=${r.id} name="${r.name}" parent_id=${r.parent_id} is_group=${r.is_group} acid=${r.acid}`);
  });
}
run();

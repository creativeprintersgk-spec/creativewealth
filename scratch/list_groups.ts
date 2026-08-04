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
  console.log("=== LISTING ALL GROUPS IN ACMAC1 ===");
  const { data, error } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, special_type_id, acid')
    .eq('is_group', true);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const groups = data || [];
  console.log(`Found ${groups.length} groups.`);
  
  // Print unique groups by name and ID
  const seen = new Set();
  groups.forEach((r: any) => {
    const key = `${r.id}_${r.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`id=${r.id} name="${r.name}" parent_id=${r.parent_id} special_type_id=${r.special_type_id} acid=${r.acid}`);
    }
  });
}

run();

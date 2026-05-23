import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: acmac1 } = await s.from('acmac1').select('id, name, parent_id, special_type_id').eq('is_group', true);
  if (!acmac1) return;
  
  const typeMap = new Map();
  for (const a of acmac1) {
    if (a.special_type_id && !typeMap.has(a.special_type_id)) {
      typeMap.set(a.special_type_id, a.name);
    }
  }
  
  console.log('Special Type IDs for Groups:');
  for (const [id, name] of typeMap.entries()) {
    console.log(`Type ${id}: ${name}`);
  }
}
run();

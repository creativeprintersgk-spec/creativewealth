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
  const { data: grp } = await s.from('acmac1').select('id, name, parent_id, is_group').in('id', [155, 160]);
  console.log('Groups:', grp);
  
  const { data: root } = await s.from('acmac1').select('id, name, parent_id, is_group').in('id', [2, 3, 4, 5]); // usually standard roots
  console.log('Roots:', root);
}
run();

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
  const { data: grp } = await s.from('acmac1').select('id, name, parent_id, is_group, acid, special_type_id').eq('id', 145).eq('acid', 62);
  console.log('ID 145:', grp);
}
run();

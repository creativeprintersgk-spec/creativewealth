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

async function findLt() {
  const { data: lt } = await s
    .from('acmac1')
    .select('id, name, acid, is_group, parent_id, cr_bal, db_bal')
    .or('name.ilike.%L&T%,name.ilike.%LT%');
  console.log('L&T entries in ACMAC1:', lt);
}
findLt();

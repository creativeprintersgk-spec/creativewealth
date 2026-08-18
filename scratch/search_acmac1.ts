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

async function searchAcmac1() {
  console.log('=== SEARCHING ACMAC1 FOR L&T AND NIPPON ===');

  const { data: lt } = await s
    .from('acmac1')
    .select('id, name, acid, is_group, parent_id, is_it_ledger')
    .or('name.ilike.%L&T%,name.ilike.%LT%');
  console.log('L&T in ACMAC1:', lt);

  const { data: nippon } = await s
    .from('acmac1')
    .select('id, name, acid, is_group, parent_id, is_it_ledger')
    .ilike('name', '%Nippon%');
  console.log('Nippon in ACMAC1:', nippon);

  const { data: multi } = await s
    .from('acmac1')
    .select('id, name, acid, is_group, parent_id, is_it_ledger')
    .ilike('name', '%Multi Asset%');
  console.log('Multi Asset in ACMAC1:', multi);
}
searchAcmac1();

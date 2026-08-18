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
  // Check if large maid values (500000+) appear in acmac1
  const { data } = await s.from('acmac1').select('id,name,acid,is_group,special_type_id').gt('id', 100000).limit(5);
  console.log('acmac1 id>100000:', JSON.stringify(data, null, 2));
  
  const { count } = await s.from('acmac1').select('*', { count: 'exact', head: true }).gt('id', 100000);
  console.log('Count of acmac1 id>100000:', count);
  
  // check id=502791 specifically
  const { data: d } = await s.from('acmac1').select('*').eq('id', 502791);
  console.log('acmac1 id=502791:', JSON.stringify(d, null, 2));
  
  // Also check the SAM table
  const { count: samCount } = await s.from('sam').select('*', { count: 'exact', head: true });
  console.log('\nSAM table count:', samCount);
  const { data: samSample } = await s.from('sam').select('*').limit(3);
  console.log('SAM sample:', JSON.stringify(samSample, null, 2));
}
run();

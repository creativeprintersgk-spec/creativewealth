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
  const { data: pfs } = await s.from('portfolios').select('id, pfname, acid');
  console.log('Portfolios:');
  pfs?.filter(p => p.pfname.toLowerCase().includes('pramesh')).forEach(p => console.log(p));
  
  const { data: acmac1 } = await s.from('acmac1').select('id, name, acid, db_bal, cr_bal').ilike('name', 'Pramesh%');
  console.log('Acmac1 names:');
  acmac1?.forEach(a => console.log(a));
}
run();

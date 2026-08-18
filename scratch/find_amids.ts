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
  console.log('=== FINDING AMIDs FOR TARGET ASSETS ===');

  const names = [
    'Mayur', 'Organic', 'Oil Country', 'Lloyds', 'Uttam', 'UP POWER'
  ];

  for (const n of names) {
    const { data: sam } = await s.from('sam').select('amid, anm, atyp').ilike('anm', `%${n}%`);
    console.log(`SAM matches for "${n}":`, sam);
    const { data: acmac1 } = await s.from('acmac1').select('id, name').ilike('name', `%${n}%`);
    console.log(`ACMAC1 matches for "${n}":`, acmac1?.map(x => ({ id: x.id, name: x.name })));
  }
}
run();

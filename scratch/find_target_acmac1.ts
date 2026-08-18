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
  console.log('=== SEARCHING ALL ACMAC1 RECORDS FOR TARGET NAMES ===');

  const { data: acmac1 } = await s.from('acmac1').select('id, name, acid');
  
  const targets = ['mayur', 'organic', 'oil country', 'lloyds', 'uttam', 'up power'];

  for (const item of acmac1 || []) {
    const lname = item.name.toLowerCase();
    for (const t of targets) {
      if (lname.includes(t)) {
        console.log(`FOUND IN ACMAC1 -> ID: ${item.id} | Name: ${item.name} | acid: ${item.acid}`);
      }
    }
  }

  console.log('\n=== SEARCHING ALL SAM RECORDS FOR TARGET NAMES ===');
  const { data: sam } = await s.from('sam').select('amid, anm, atyp');
  for (const item of sam || []) {
    const lname = (item.anm || '').toLowerCase();
    for (const t of targets) {
      if (lname.includes(t)) {
        console.log(`FOUND IN SAM -> AMID: ${item.amid} | Name: ${item.anm} | atyp: ${item.atyp}`);
      }
    }
  }
}
run();

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
  console.log('=== Checking amid=104471 (Canara Bank) in bs1 ===\n');

  const { data: rows } = await s.from('bs1')
    .select('*')
    .eq('amid', 104471)
    .order('dt', { ascending: true });

  console.log(`Found ${rows?.length} transactions for amid=104471:`);
  rows?.forEach((r: any) => {
    console.log(`  trid=${r.trid}, pfid=${r.pfid}, dt=${r.dt}, trty=${r.trty}, atyid=${r.atyid}, qn=${r.qn}, amt=${r.amt}`);
  });

  // Check SAM for 104471
  const { data: sam } = await s.from('sam').select('amid, anm, atyid').eq('amid', 104471);
  console.log('SAM info for 104471:', sam);

  // Check SAM for 105063
  const { data: sam2 } = await s.from('sam').select('amid, anm, atyid').eq('amid', 105063);
  console.log('SAM info for 105063:', sam2);

  // Check BOI Flexi Cap Fund
  const { data: boiSam } = await s.from('sam').select('amid, anm, atyid').ilike('anm', '%Flexi Cap%');
  console.log('Flexi Cap SAM rows:', boiSam);
}

run().catch(console.error);

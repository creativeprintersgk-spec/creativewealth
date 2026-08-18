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
  console.log('=== Checking NTPC NCD & IDFC NCD transactions for pfid=4 ===\n');

  // amid=425762 (IDFC Bank NCD)
  const { data: idfcTx } = await s.from('bs1')
    .select('*')
    .eq('pfid', 4)
    .eq('amid', 425762)
    .order('dt', { ascending: true });

  console.log('IDFC NCD (amid=425762) transactions for pfid=4:');
  idfcTx?.forEach((r: any) => {
    console.log(`  trid=${r.trid}, dt=${r.dt}, trty=${r.trty}, qn=${r.qn}, amt=${r.amt}`);
  });

  // Find amid for NTPC NCD N7 8.49% 25/03/2025
  const { data: ntpcSam } = await s.from('sam')
    .select('amid, anm')
    .ilike('anm', '%NTPC NCD%');
  console.log('\nNTPC NCD SAM rows:', ntpcSam);

  if (ntpcSam && ntpcSam.length > 0) {
    const ntpcAmids = ntpcSam.map(a => a.amid);
    const { data: ntpcTx } = await s.from('bs1')
      .select('*')
      .eq('pfid', 4)
      .in('amid', ntpcAmids)
      .order('dt', { ascending: true });
    
    console.log('\nNTPC NCD transactions for pfid=4:');
    ntpcTx?.forEach((r: any) => {
      console.log(`  amid=${r.amid}, trid=${r.trid}, dt=${r.dt}, trty=${r.trty}, qn=${r.qn}, amt=${r.amt}`);
    });
  }
}

run().catch(console.error);

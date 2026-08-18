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
  console.log('=== Canara Bank (Asset Search) ===\n');

  // Find SAM rows for Canara Bank
  const { data: canaraSam } = await s.from('sam')
    .select('amid, anm, atyid')
    .ilike('anm', '%Canara Bank%');
  console.log('Canara Bank SAM entries:', canaraSam);

  if (canaraSam && canaraSam.length > 0) {
    const amids = canaraSam.map(a => a.amid);
    const { data: txs } = await s.from('bs1')
      .select('*')
      .in('amid', amids)
      .order('dt', { ascending: true });

    console.log(`\nFound ${txs?.length} total transactions for Canara Bank across all portfolios:`);
    txs?.forEach((r: any) => {
      console.log(`  trid=${r.trid}, pfid=${r.pfid}, dt=${r.dt}, trty=${r.trty}, atyid=${r.atyid}, qn=${r.qn}, amt=${r.amt}`);
    });
  }

  console.log('\n=== Bank of India Flexi Cap Fund ===\n');
  const { data: boiSam } = await s.from('sam')
    .select('amid, anm, atyid')
    .ilike('anm', '%Bank of India Flexi Cap%');
  console.log('BOI Flexi Cap SAM entries:', boiSam);
}

run().catch(console.error);

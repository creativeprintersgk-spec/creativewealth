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
  console.log('=== Searching for Canara Bank across tables ===\n');

  // Search sam
  const { data: samRows } = await s.from('sam').select('amid, anm').limit(5000);
  const canaraSam = samRows?.filter((r: any) => r.anm && r.anm.toLowerCase().includes('canara'));
  console.log('sam matches:', canaraSam);

  // Search asset_master
  const { data: amRows } = await s.from('asset_master').select('amid, name').limit(5000);
  const canaraAm = amRows?.filter((r: any) => r.name && r.name.toLowerCase().includes('canara'));
  console.log('asset_master matches:', canaraAm);

  // Search acmac1
  const { data: acmacRows } = await s.from('acmac1').select('id, name, atyid').limit(5000);
  const canaraAcmac = acmacRows?.filter((r: any) => r.name && r.name.toLowerCase().includes('canara'));
  console.log('acmac1 matches:', canaraAcmac);

  if (canaraSam && canaraSam.length > 0) {
    const amids = canaraSam.map(a => a.amid);
    const { data: txs } = await s.from('bs1')
      .select('*')
      .in('amid', amids)
      .order('dt', { ascending: true });

    console.log(`\nFound ${txs?.length} total transactions for Canara Bank:`);
    txs?.forEach((r: any) => {
      console.log(`  trid=${r.trid}, pfid=${r.pfid}, dt=${r.dt}, trty=${r.trty}, atyid=${r.atyid}, qn=${r.qn}, amt=${r.amt}`);
    });
  }
}

run().catch(console.error);

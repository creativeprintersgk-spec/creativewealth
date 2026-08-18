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

async function findHoldings() {
  console.log('=== FINDING ALL HOLDINGS & ASSET NAMES IN DB ===');

  const { data: sumRows } = await s.from('sum_table').select('amid, qnt, amtinv, pfolio_id').gt('qnt', 0);
  console.log('Total active sum_table rows:', sumRows?.length);

  const amids = Array.from(new Set(sumRows?.map(r => r.amid)));
  
  const { data: samRows } = await s.from('sam').select('amid, anm, atyp').in('amid', amids);
  const samMap = new Map(samRows?.map(a => [a.amid, a]));

  const { data: acmac1Rows } = await s.from('acmac1').select('id, name').in('id', amids);
  const acmac1Map = new Map(acmac1Rows?.map(a => [a.id, a]));

  for (const r of sumRows || []) {
    const samAsset = samMap.get(r.amid);
    const acmac1Asset = acmac1Map.get(r.amid);
    const name = samAsset?.anm || acmac1Asset?.name || `UNKNOWN (#${r.amid})`;
    console.log(`PF: ${r.pfolio_id}`.padEnd(8), `AMID: ${r.amid}`.padEnd(10), `Name: ${name}`.padEnd(60), `Qty: ${r.qnt}`);
  }
}
findHoldings();

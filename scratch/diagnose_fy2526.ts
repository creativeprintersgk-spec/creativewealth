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
  console.log('=== Checking all Sells in FY 2025-26 (2025-04-01 to 2026-03-31) ===\n');

  const { data: sells } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .in('trty', [99, 101])
    .gte('dt', '2025-04-01')
    .lte('dt', '2026-03-31')
    .order('dt', { ascending: true });

  console.log(`Found ${sells?.length} sells in FY 2025-26:`);

  // Get all amids
  const amids = [...new Set(sells?.map(r => r.amid))];
  
  // Fetch asset names from sam
  const { data: samRows } = await s.from('sam')
    .select('amid, anm, atyid')
    .in('amid', amids);

  const samMap = new Map(samRows?.map(r => [r.amid, r]));

  sells?.forEach((r: any) => {
    const sam = samMap.get(r.amid);
    console.log(`  dt=${r.dt}, pfid=${r.pfid}, amid=${r.amid}, name="${sam?.anm}", atyid=${r.atyid} (sam.atyid=${sam?.atyid}), qn=${r.qn}, amt=${r.amt}`);
  });
}

run().catch(console.error);

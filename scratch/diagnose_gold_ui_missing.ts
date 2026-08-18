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

async function checkGetHoldings3() {
  console.log('=== DIAGNOSING getHoldings FOR PORTFOLIO 3 (x old shares) ===');

  // Load state exactly like logic.ts
  const { data: sumTable } = await s.from('sum_table').select('*').eq('pfolio_id', 3);
  const { data: sam } = await s.from('sam').select('*');
  const { data: acmac1 } = await s.from('acmac1').select('*');

  const assetNameMap: Record<number, string> = {};
  sam?.forEach(a => assetNameMap[a.amid] = a.anm);
  acmac1?.forEach(a => { if (!assetNameMap[a.id]) assetNameMap[a.id] = a.name; });

  console.log('Total sum_table rows for Portfolio 3:', sumTable?.length);

  const activeRows = sumTable?.filter(r => Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01);
  console.log('Active rows (qnt > 0 or currv > 0):', activeRows?.length);

  for (const r of activeRows || []) {
    const name = assetNameMap[r.amid] || `Asset #${r.amid}`;
    console.log(`AMID: ${r.amid}`.padEnd(10), `Name: ${name}`.padEnd(45), `Qty: ${r.qnt}`.padEnd(12), `atty: ${r.atty}`, `currv: ${r.currv}`);
  }
}
checkGetHoldings3();

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

async function checkHoldingAssets() {
  const { data: sumRows } = await s
    .from('sum_table')
    .select('sid, amid, qnt, amtinv, currv, pfolio_id')
    .gt('qnt', 0);

  if (!sumRows || sumRows.length === 0) return;

  const amids = Array.from(new Set(sumRows.map(r => r.amid)));
  
  // Fetch SAM in batches of 100
  const samList: any[] = [];
  for (let i = 0; i < amids.length; i += 100) {
    const batch = amids.slice(i, i + 100);
    const { data: samBatch } = await s
      .from('sam')
      .select('amid, anm, atyp, isr, alias, exint1, extstr')
      .in('amid', batch);
    if (samBatch) samList.push(...samBatch);
  }

  const samMap = new Map(samList.map(a => [a.amid, a]));

  const { data: prices } = await s.from('mprices').select('*').in('amid', amids);
  const priceMap = new Map();
  prices?.forEach(p => {
    const existing = priceMap.get(p.amid);
    if (!existing || p.date > existing.date) {
      priceMap.set(p.amid, p);
    }
  });

  console.log('\n--- ALL ACTIVE HOLDINGS IN PORTFOLIOS ---');
  for (const r of sumRows) {
    const asset = samMap.get(r.amid);
    const pr = priceMap.get(r.amid);
    const name = asset?.anm || 'UNKNOWN';
    if (name.toLowerCase().includes('l&t') || name.toLowerCase().includes('nippon') || name.toLowerCase().includes('multi asset') || name.toLowerCase().includes('finance')) {
      console.log(`>>> TARGET MATCH: PF ${r.pfolio_id} | AMID ${r.amid} | Name: ${name} | Qty: ${r.qnt} | Price: ${pr?.currp} | Date: ${pr?.date}`);
    }
  }

  console.log('\n--- PRINTING ALL NIPPON OR L&T ASSETS IN SAM ---');
  const { data: allSam } = await s.from('sam').select('amid, anm, atyp, isr, alias, exint1, extstr');
  if (allSam) {
    for (const a of allSam) {
      const name = a.anm || '';
      if (name.toLowerCase().includes('l&t') || name.toLowerCase().includes('nippon') || name.toLowerCase().includes('multi asset')) {
        const pr = priceMap.get(a.amid);
        console.log(`SAM AMID ${a.amid} | Name: ${name} | atyp: ${a.atyp} | alias: ${a.alias} | exint1: ${a.exint1} | Price: ${pr?.currp} | Date: ${pr?.date}`);
      }
    }
  }
}
checkHoldingAssets();

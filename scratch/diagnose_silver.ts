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

async function diagnoseSilver() {
  // Find Silver assets in sam
  const { data: samSilver } = await s.from('sam').select('*').ilike('anm', '%silver%');
  console.log('\n=== SAM Silver entries ===');
  samSilver?.forEach(r => console.log(`  amid=${r.amid}, name="${r.anm}", atyid=${r.atyid}`));

  const silverAmids = samSilver?.map(r => r.amid) ?? [];
  if (silverAmids.length === 0) { console.log('No Silver assets found in sam!'); return; }

  // Check bs1 for Silver in Portfolio 3
  for (const amid of silverAmids) {
    const { data: bs1 } = await s.from('bs1').select('*').eq('pfid', 3).eq('amid', amid).order('trid');
    const asset = samSilver?.find(s => s.amid === amid);
    console.log(`\n=== BS1 for ${asset?.anm} (amid=${amid}) in Portfolio 3 ===`);
    if (!bs1 || bs1.length === 0) {
      console.log('  ❌ NO BS1 ROWS — entry is MISSING from bs1!');
    } else {
      bs1.forEach(r => console.log(`  trid=${r.trid}, trty=${r.trty}, qty=${r.qnt}, rate=${r.rate}, amt=${r.amt}, acvch=${r.acvch}`));
      const buys = bs1.filter(r => r.trty === 20).reduce((s, r) => s + Number(r.qnt), 0);
      const sells = bs1.filter(r => r.trty === 99).reduce((s, r) => s + Number(r.qnt), 0);
      console.log(`  Net Qty (buys - sells): ${buys} - ${sells} = ${buys - sells}`);
    }

    // Check sum_table
    const { data: sumRow } = await s.from('sum_table').select('*').eq('pfolio_id', 3).eq('amid', amid).single();
    console.log(`  sum_table: qnt=${sumRow?.qnt}, amtinv=${sumRow?.amtinv}, currv=${sumRow?.currv}`);

    // Check mprices
    const { data: prices } = await s.from('mprices').select('*').eq('amid', amid).order('date', { ascending: false }).limit(3);
    console.log(`  mprices (latest 3):`, prices?.map(p => `date=${p.date}, currp=${p.currp}, prevp=${p.prevp}`));
  }
}

diagnoseSilver();

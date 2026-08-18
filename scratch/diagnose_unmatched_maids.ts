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
  // Get all unique maids used in trans1
  const { data: allT1 } = await s.from('trans1').select('maid,dramt,cramt,acid');
  
  // Get all acmac1 ledger IDs
  const { data: allAcmac1 } = await s.from('acmac1').select('id,acid,name').eq('is_group', false);
  const acmac1Set = new Set(allAcmac1?.map((r: any) => `${r.id}_${r.acid}`) || []);
  const acmac1IdSet = new Set(allAcmac1?.map((r: any) => r.id) || []);
  
  // Find trans1 maids that have NO matching acmac1 ledger
  const unmatchedMaids = new Map<number, { dr: number; cr: number; acid: number }>();
  let matchedDr = 0, matchedCr = 0, unmatchedDr = 0, unmatchedCr = 0;
  
  allT1?.forEach((r: any) => {
    const maid = r.maid;
    const hasMatch = acmac1IdSet.has(maid);
    if (hasMatch) {
      matchedDr += Number(r.dramt) || 0;
      matchedCr += Number(r.cramt) || 0;
    } else {
      unmatchedDr += Number(r.dramt) || 0;
      unmatchedCr += Number(r.cramt) || 0;
      const existing = unmatchedMaids.get(maid) || { dr: 0, cr: 0, acid: r.acid };
      existing.dr += Number(r.dramt) || 0;
      existing.cr += Number(r.cramt) || 0;
      unmatchedMaids.set(maid, existing);
    }
  });
  
  console.log(`Matched entries: DR=${matchedDr.toFixed(2)}, CR=${matchedCr.toFixed(2)}`);
  console.log(`Unmatched entries: DR=${unmatchedDr.toFixed(2)}, CR=${unmatchedCr.toFixed(2)}`);
  console.log(`\nUnmatched maids (${unmatchedMaids.size}):`);
  
  const sorted = [...unmatchedMaids.entries()].sort((a, b) => (b[1].dr + b[1].cr) - (a[1].dr + a[1].cr));
  for (const [maid, { dr, cr, acid }] of sorted.slice(0, 20)) {
    console.log(`  maid=${maid} (acid=${acid}): DR=${dr.toFixed(2)}, CR=${cr.toFixed(2)}`);
  }
  
  // What are these unmatched maid values? Check acmac1 without acid filter
  console.log('\nLooking up top unmatched maids in acmac1 (any acid):');
  for (const [maid] of sorted.slice(0, 5)) {
    const { data } = await s.from('acmac1').select('id,name,acid').eq('id', maid);
    console.log(`  maid=${maid}:`, data?.map((r: any) => `${r.name} (acid=${r.acid})`).join(', ') || 'NOT IN acmac1');
  }
}
run();

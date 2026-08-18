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
  // Fetch ALL acmac1 ledgers using pagination
  let allAcmac1: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await s
      .from('acmac1')
      .select('id,acid,name,is_group')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching acmac1:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allAcmac1 = allAcmac1.concat(data);
    page++;
  }

  const acmac1IdSet = new Set(allAcmac1.filter(r => !r.is_group).map(r => r.id));
  console.log(`Total ledgers in acmac1: ${acmac1IdSet.size}`);

  // Fetch ALL trans1
  let allT1: any[] = [];
  page = 0;
  while (true) {
    const { data, error } = await s
      .from('trans1')
      .select('maid,dramt,cramt,acid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching trans1:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allT1 = allT1.concat(data);
    page++;
  }
  console.log(`Total entries in trans1: ${allT1.length}`);

  let matchedDr = 0, matchedCr = 0, unmatchedDr = 0, unmatchedCr = 0;
  const unmatchedMaids = new Map<number, { dr: number; cr: number; acid: number }>();

  allT1.forEach((r: any) => {
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

  console.log(`Matched entries: DR=${matchedDr.toFixed(2)}, CR=${matchedCr.toFixed(2)}, Diff=${(matchedDr - matchedCr).toFixed(2)}`);
  console.log(`Unmatched entries: DR=${unmatchedDr.toFixed(2)}, CR=${unmatchedCr.toFixed(2)}, Diff=${(unmatchedDr - unmatchedCr).toFixed(2)}`);
  console.log(`Total trans1 DR: ${(matchedDr + unmatchedDr).toFixed(2)}, Total trans1 CR: ${(matchedCr + unmatchedCr).toFixed(2)}, Diff=${((matchedDr + unmatchedDr) - (matchedCr + unmatchedCr)).toFixed(2)}`);
  console.log(`Number of unmatched maids: ${unmatchedMaids.size}`);

  const sorted = [...unmatchedMaids.entries()].sort((a, b) => (b[1].dr + b[1].cr) - (a[1].dr + a[1].cr));
  for (const [maid, { dr, cr, acid }] of sorted.slice(0, 20)) {
    console.log(`  maid=${maid} (acid=${acid}): DR=${dr.toFixed(2)}, CR=${cr.toFixed(2)}`);
    // Lookup in allAcmac1 (any is_group)
    const matches = allAcmac1.filter(r => r.id === maid);
    console.log(`    Matches in acmac1: ${matches.map(m => `${m.name} (acid=${m.acid}, is_group=${m.is_group})`).join(', ')}`);
  }
}
run();

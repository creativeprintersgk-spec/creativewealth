import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function fetchAll(tableName: string) {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from(tableName).select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log('Fetching all sum_table and bs1 rows from Supabase...');
  const sumRows = await fetchAll('sum_table');
  const bsRows = await fetchAll('bs1');

  const bsByPf = new Map<number, Set<number>>();
  bsRows.forEach(b => {
    const pf = Number(b.pfid);
    if (!bsByPf.has(pf)) bsByPf.set(pf, new Set());
    const set = bsByPf.get(pf)!;
    if (b.sid) set.add(Number(b.sid));
    if (b.amid) set.add(Number(b.amid));
  });

  const phantomSids: number[] = [];
  sumRows.forEach(s => {
    const pf = Number(s.pfolio_id);
    const hasQty = Math.abs(Number(s.qnt)) > 0.0001;
    const hasCurrv = Math.abs(Number(s.currv)) > 0.01;
    const hasInv = Math.abs(Number(s.amtinv)) > 0.01;
    const pfBs = bsByPf.get(pf);
    const hasBs = pfBs ? (pfBs.has(Number(s.sid)) || pfBs.has(Number(s.amid))) : false;

    // Pure ghost record: 0 quantity, 0 value, 0 investment AND 0 transactions in bs1!
    if (!hasQty && !hasCurrv && !hasInv && !hasBs) {
      phantomSids.push(Number(s.sid));
    }
  });

  console.log(`Found ${phantomSids.length} pure phantom rows remaining out of ${sumRows.length} total sum_table rows.`);
  if (phantomSids.length > 0) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < phantomSids.length; i += CHUNK_SIZE) {
      const chunk = phantomSids.slice(i, i + CHUNK_SIZE);
      const { error: delErr } = await supabase.from('sum_table').delete().in('sid', chunk);
      if (delErr) {
        console.error('Error deleting chunk:', delErr);
      } else {
        console.log(`Deleted chunk ${i / CHUNK_SIZE + 1} (${chunk.length} rows)`);
      }
    }
    console.log('✅ Final phantom rows cleanup completed successfully!');
  } else {
    console.log('✅ No phantom rows remain! sum_table is 100% clean.');
  }
}

main().catch(console.error);

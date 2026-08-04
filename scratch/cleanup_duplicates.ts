import { supabase } from '../src/supabase';

function normalizeLedgerName(name: string): string {
  return name
    .replace(/\s*\([\d\/\s\-]+\)/g, '') // strip folio suffix like (91044592504 / 0)
    .replace(/[\s\-]+/g, ' ')           // normalize multiple spaces and dashes
    .toLowerCase()
    .trim();
}

async function main() {
  console.log("Fetching all ledger definitions from acmac1 in pages (stably sorted by id, acid)...");
  let ledgers: any[] = [];
  let page = 0;
  const size = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('acmac1')
      .select('*')
      .order('id')
      .order('acid')
      .range(page * size, (page + 1) * size - 1);
      
    if (error) {
      console.error(`Error loading page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    
    ledgers = ledgers.concat(data);
    console.log(`Loaded ${ledgers.length} ledgers...`);
    if (data.length < size) break;
    page++;
  }
  
  console.log(`Loaded total ${ledgers.length} ledgers. De-duplicating in-memory rows first...`);
  
  // De-duplicate any actual identical rows in memory (using id and acid combination)
  const uniqueLedgersMap = new Map<string, any>();
  for (const l of ledgers) {
    const key = `${l.id}_${l.acid}`;
    uniqueLedgersMap.set(key, l);
  }
  const uniqueLedgers = Array.from(uniqueLedgersMap.values());
  console.log(`De-duplicated to ${uniqueLedgers.length} unique in-memory ledgers. Grouping by account ID and normalized name...`);
  
  // Group by acid and normalized name
  const groups: Record<string, any[]> = {};
  for (const l of uniqueLedgers) {
    if (l.is_group) continue; // skip groups
    
    const key = `${l.acid}_${normalizeLedgerName(l.name)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }
  
  let totalMerged = 0;
  
  for (const [key, list] of Object.entries(groups)) {
    if (list.length <= 1) continue;
    
    console.log(`\nFound duplicate group for key "${key}":`);
    list.forEach(l => console.log(`  - ID: ${l.id}, Name: "${l.name}", Acid: ${l.acid}`));
    
    // Choose primary ledger: prefer name that has '(' (the original folio ledger), else smallest ID
    const primary = list.find(l => l.name.includes('(')) || list.reduce((min, l) => l.id < min.id ? l : min, list[0]);
    const duplicates = list.filter(l => l.id !== primary.id);
    
    console.log(`Selected PRIMARY: ID: ${primary.id}, Name: "${primary.name}"`);
    console.log(`DUPLICATES to merge: ${duplicates.map(d => d.id).join(', ')}`);
    
    for (const dup of duplicates) {
      console.log(`Merging duplicate ledger ID ${dup.id} into primary ID ${primary.id}...`);
      
      // Update trans1
      const { data: t1Rows, error: t1Err } = await supabase
        .from('trans1')
        .update({ maid: primary.id })
        .eq('maid', dup.id)
        .select('transid');
      if (t1Err) console.error(`  Error updating trans1 for ${dup.id}:`, t1Err.message);
      else console.log(`  Updated ${t1Rows?.length || 0} entries in trans1`);
      
      // Update transc1
      const { data: tc1Rows, error: tc1Err } = await supabase
        .from('transc1')
        .update({ maid: primary.id })
        .eq('maid', dup.id)
        .select('transid');
      if (tc1Err) console.error(`  Error updating transc1 for ${dup.id}:`, tc1Err.message);
      else console.log(`  Updated ${tc1Rows?.length || 0} entries in transc1`);
      
      // Update bs1
      const { data: bs1Rows, error: bs1Err } = await supabase
        .from('bs1')
        .update({ amid: primary.id })
        .eq('amid', dup.id)
        .select('trid');
      if (bs1Err) console.error(`  Error updating bs1 for ${dup.id}:`, bs1Err.message);
      else console.log(`  Updated ${bs1Rows?.length || 0} entries in bs1`);
      
      // Update sum_table
      const { data: sumRows, error: sumErr } = await supabase
        .from('sum_table')
        .update({ amid: primary.id })
        .eq('amid', dup.id)
        .select('sid');
      if (sumErr) console.error(`  Error updating sum_table for ${dup.id}:`, sumErr.message);
      else console.log(`  Updated ${sumRows?.length || 0} entries in sum_table`);
      
      // Delete duplicate ledger from acmac1
      const { error: delErr } = await supabase
        .from('acmac1')
        .delete()
        .eq('id', dup.id);
      if (delErr) console.error(`  Error deleting ledger ${dup.id}:`, delErr.message);
      else console.log(`  Deleted duplicate ledger ${dup.id} from acmac1`);
      
      totalMerged++;
    }
  }
  
  console.log(`\nCleanup complete! Merged and deleted ${totalMerged} duplicate ledgers.`);
}

main().catch(console.error);

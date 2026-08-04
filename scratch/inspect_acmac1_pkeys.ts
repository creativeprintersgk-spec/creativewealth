import { supabase } from '../src/supabase';

async function main() {
  console.log("Checking for duplicate IDs in acmac1...");
  
  const { data, error } = await supabase
    .rpc('get_duplicate_ids_acmac1'); // wait, if there's no RPC, we can just fetch IDs
    
  // Since there is no RPC, let's select ID and count them using a group by query
  // Wait, Supabase JS client doesn't support grouping directly without RPC,
  // but we can fetch all IDs paginated and do it in memory.
  
  let ids: number[] = [];
  let page = 0;
  const size = 1000;
  
  while (true) {
    const { data: pageData, error: pageErr } = await supabase
      .from('acmac1')
      .select('id')
      .order('id')
      .range(page * size, (page + 1) * size - 1);
      
    if (pageErr) {
      console.error("Error loading page:", pageErr.message);
      break;
    }
    if (!pageData || pageData.length === 0) break;
    
    ids = ids.concat(pageData.map((r: any) => r.id));
    if (pageData.length < size) break;
    page++;
  }
  
  console.log(`Loaded ${ids.length} IDs.`);
  
  const counts: Record<number, number> = {};
  for (const id of ids) {
    counts[id] = (counts[id] || 0) + 1;
  }
  
  const duplicates = Object.entries(counts).filter(([_, count]) => count > 1);
  console.log(`Found ${duplicates.length} duplicate IDs:`);
  duplicates.slice(0, 10).forEach(([id, count]) => {
    console.log(`  ID: ${id}, Count: ${count}`);
  });
}

main().catch(console.error);

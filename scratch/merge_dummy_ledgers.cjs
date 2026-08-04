const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Starting cleanup of duplicate dummy ledgers...');

  let mergedCount = 0;
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    const { data: dummyLedgers, error: fetchErr } = await supabase
      .from('acmac1')
      .select('*')
      .gte('id', 500000)
      .range(offset, offset + 999);

    if (fetchErr || !dummyLedgers || dummyLedgers.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${dummyLedgers.length} ledgers...`);

    for (const dummy of dummyLedgers) {
      let { data: originals } = await supabase
        .from('acmac1')
        .select('*')
        .ilike('name', dummy.name)
        .lt('id', 500000);

      if (originals && originals.length > 0) {
        let target = originals.find(o => o.acid === dummy.acid) || originals[0];
        console.log(`[MERGE_ID_LESS] Merging "${dummy.name}" (${dummy.id}) -> ${target.id}`);
        await supabase.from('transc1').update({ maid: target.id }).eq('maid', dummy.id);
        await supabase.from('trans1').update({ maid: target.id }).eq('maid', dummy.id);
        await supabase.from('acmac1').delete().eq('id', dummy.id);
        mergedCount++;
      } else {
        // Also check if there's a smaller dummy ID for the same name!
        let { data: smallerDummies } = await supabase
          .from('acmac1')
          .select('*')
          .ilike('name', dummy.name)
          .lt('id', dummy.id)
          .gte('id', 500000);

        if (smallerDummies && smallerDummies.length > 0) {
           let target = smallerDummies.find(o => o.acid === dummy.acid) || smallerDummies[0];
           console.log(`[MERGE_DUMMY] Merging "${dummy.name}" (${dummy.id}) -> ${target.id}`);
           await supabase.from('transc1').update({ maid: target.id }).eq('maid', dummy.id);
           await supabase.from('trans1').update({ maid: target.id }).eq('maid', dummy.id);
           await supabase.from('acmac1').delete().eq('id', dummy.id);
           mergedCount++;
        }
      }
    }
    offset += 1000;
  }

  console.log(`\nCleanup complete! Merged ${mergedCount} duplicate ledgers.`);
}

run().catch(console.error);

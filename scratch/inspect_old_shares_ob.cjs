const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const targets = [{ acid: 29, name: 'Pramesh R Shah' }, { acid: 30, name: 'Unnati Shah' }];
  console.log('Target Accounts:', targets);

  for (const acc of targets) {
    const { data: ledgers, error } = await supabase.from('acmac1').select('maid, name').eq('acid', acc.acid).ilike('name', '%old share%');
    console.log(`\nLedgers for ${acc.name}:`, ledgers, error);

    for (const l of (ledgers || [])) {
      const { data: entries } = await supabase.from('acvch1')
        .select('*')
        .eq('acid', acc.acid)
        .eq('maid', l.maid)
        .eq('type', 11);
      console.log(`Opening Balance Entries for ${acc.name} - ${l.name}:`, entries);
    }
  }
}

run();

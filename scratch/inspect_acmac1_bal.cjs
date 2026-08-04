const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: ledgers } = await supabase.from('acmac1')
    .select('id, name, acid, db_bal, cr_bal')
    .in('id', [66, 27]); // maid 66 (Pramesh) and 27 (Unnati)

  console.log('Ledgers in acmac1:', ledgers);
}

run();

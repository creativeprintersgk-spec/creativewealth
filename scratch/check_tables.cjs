const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const tryTables = ['families', 'fammac1', 'accounts', 'acc_mast', 'portfolios', 'acmac1', 'acc_pflink'];
  const res = [];
  for (const t of tryTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      res.push(`${t}: error - ${error.message}`);
    } else {
      res.push(`${t}: exists (${data.length} rows)`);
    }
  }
  fs.writeFileSync('scratch/tables.txt', res.join('\n'));
  console.log('Wrote to scratch/tables.txt');
}

run();

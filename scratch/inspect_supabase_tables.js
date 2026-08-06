const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const tables = [
  'portfolios',
  'investor_group_members',
  'acc_pflink',
  'acmac1',
  'bs1',
  'sum_table',
  'vouchersc1',
  'vouchers1',
  'transc1',
  'trans1',
  'mprices'
];

async function run() {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}' error:`, error.message);
    } else {
      console.log(`Table '${table}':`, data && data.length > 0 ? Object.keys(data[0]) : '(empty)');
    }
  }
}
run();

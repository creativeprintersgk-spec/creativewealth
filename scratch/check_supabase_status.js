const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

async function checkTables() {
  console.log("Checking Supabase tables status...\n");
  const tables = ['asset_master', 'ledgers', 'prices', 'pms_portfolios', 'pms_transactions', 'pms_tax_lots', 'families', 'groups', 'accounts'];
  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table '${table}': ERROR (${error.message})`);
    } else {
      console.log(`Table '${table}': EXISTS, Rows: ${count}`);
    }
  }
}
checkTables();

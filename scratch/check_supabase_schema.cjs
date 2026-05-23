const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

async function checkSchema() {
  console.log("Fetching Supabase Schema...\n");
  
  try {
    // We can't directly query information_schema with anon key usually,
    // so let's just query a single row from each table to see the columns returned!
    const supabase = createClient(url, key);
    const tables = ['groups', 'families', 'pms_portfolios', 'accounts', 'capital_gains_summary', 'pms_transactions'];
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table '${table}': ERROR (${error.message})`);
      } else {
        const columns = data && data.length > 0 ? Object.keys(data[0]) : "No rows, cannot infer columns. Attempting dummy insert...";
        if (data && data.length > 0) {
           console.log(`Table '${table}': EXISTS. Columns: ${columns.join(', ')}`);
        } else {
           // If 0 rows, we don't know the columns from a select.
           console.log(`Table '${table}': EXISTS but is empty.`);
        }
      }
    }
  } catch(e) {
    console.error(e);
  }
}
checkSchema();

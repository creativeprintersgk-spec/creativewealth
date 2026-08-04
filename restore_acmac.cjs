const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const s = createClient('https://ajjeoijjsklgkioxqkrb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI');

async function run() {
  const csvText = fs.readFileSync('scratch/mprofit_csv/ACMAC1.csv', 'utf8');
  const parsed = Papa.parse(csvText, { header: false });
  let count = 0;
  for (const row of parsed.data) {
    if (row.length < 2) continue;
    const id = Number(row[0]);
    const name = row[1];
    if (id > 0 && name) {
      await s.from('acmac1').update({ name }).eq('id', id);
      count++;
      if (count % 100 === 0) console.log('Restored ' + count + ' acmac1 rows...');
    }
  }
  console.log('Finished restoring ' + count + ' acmac1 rows to original CSV values.');
}
run();

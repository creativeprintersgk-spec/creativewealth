const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const s = createClient('https://ajjeoijjsklgkioxqkrb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI');

async function run() {
  const csvText = fs.readFileSync('scratch/mprofit_csv/SumTable.csv', 'utf8');
  const parsed = Papa.parse(csvText, { header: false });
  let count = 0;
  for (const row of parsed.data) {
    if (row.length < 9) continue;
    const sid = Number(row[0]);
    const pfid = Number(row[1]);
    const amid = Number(row[4]);
    const qnt = Number(row[6]) || 0;
    const amtinv = Number(row[8]) || 0;
    if (sid > 0 && !isNaN(pfid) && !isNaN(amid)) {
      await s.from('sum_table').update({ qnt, amtinv }).eq('sid', sid);
      count++;
      if (count % 100 === 0) console.log('Restored ' + count + ' rows...');
    }
  }
  console.log('Finished restoring ' + count + ' rows to original CSV values.');
}
run();

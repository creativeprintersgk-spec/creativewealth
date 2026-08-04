const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('https://ajjeoijjsklgkioxqkrb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI');

async function run() {
  console.log('Fetching ledgers...');
  const { data: acmac1 } = await supabase.from('acmac1').select('id, acid, amid, name, grp, asset_type').in('grp', [12, 10, 11]);
  
  if (!acmac1) {
    console.log("No ledgers found.");
    return;
  }
  
  console.log(`Found ${acmac1.length} ledgers. Filtering those without valid AMID...`);
  
  const amids = acmac1.map(a => a.amid).filter(x => x);
  const { data: amidsInSam } = await supabase.from('asset_master').select('amid, isin').in('amid', amids);
  
  const validAmids = new Set((amidsInSam || []).filter(a => a.isin).map(a => a.amid));
  
  const ledgersToMap = acmac1.filter(a => !validAmids.has(a.amid));
  console.log(`${ledgersToMap.length} ledgers need mapping.`);
  
  let csv = 'Local Ledger ID,Old Name,Proposed New Name,Proposed ISIN,Proposed AMID,Confidence\n';
  
  for (let i = 0; i < ledgersToMap.length; i++) {
    const ledger = ledgersToMap[i];
    console.log(`Mapping ${i + 1}/${ledgersToMap.length}: ${ledger.name}`);
    
    // Attempt search
    // Just split by space and take first two words for better fuzzy match
    const parts = ledger.name.split(' ');
    const searchWord = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
    
    const { data: matches } = await supabase
      .from('asset_master')
      .select('amid, name, isin')
      .ilike('name', `%${searchWord}%`)
      .limit(3);
      
    if (matches && matches.length > 0) {
      // Find best match (exact or first)
      let best = matches.find(m => m.name.toLowerCase() === ledger.name.toLowerCase()) || matches[0];
      const confidence = best.name.toLowerCase() === ledger.name.toLowerCase() ? 'High' : 'Medium';
      csv += `"${ledger.id}","${ledger.name}","${best.name}","${best.isin || ''}","${best.amid}","${confidence}"\n`;
    } else {
      csv += `"${ledger.id}","${ledger.name}","","","","Low"\n`;
    }
  }
  
  fs.writeFileSync('scratch/mprofit_mapping_proposals.csv', csv);
  console.log('Done! Wrote to scratch/mprofit_mapping_proposals.csv');
}

run();

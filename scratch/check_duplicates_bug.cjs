const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Users/Admin/Desktop/wealthcore-clean/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bs1, error } = await supabase.from('bs1').select('*').limit(5000);
  if (error) { console.error(error); return; }
  
  const dates = ['2026-05-13', '2026-05-14', '2026-05-05'];
  
  const relevantBs1 = bs1.filter(b => b.dt && dates.some(d => b.dt.startsWith(d)));
  
  console.log("Matching BS1 entries for the dates:");
  relevantBs1.forEach(b => {
    console.log(`ID: ${b.trid}, PFID: ${b.pfid}, AMID: ${b.amid}, DT: ${b.dt}, AMT: ${b.amt}, QN: ${b.qn}, TRTY: ${b.trty}, STR: ${b.trstr}`);
  });
  
  // Also get asset master names for these amids
  const amids = [...new Set(relevantBs1.map(b => b.amid))];
  const { data: am } = await supabase.from('asset_master').select('amid, name, isin').in('amid', amids);
  console.log("\nAsset Master:");
  am.forEach(a => console.log(`AMID: ${a.amid}, NAME: ${a.name}, ISIN: ${a.isin}`));
}

check();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Users/Admin/Desktop/wealthcore-clean/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bs1, error } = await supabase.from('bs1').select('*').limit(5000);
  if (error) { console.error(error); return; }
  
  const dates = ['2020-05-05', '2026-05-13', '2026-05-14', '2026-05-05'];
  const relevantBs1 = bs1.filter(b => b.dt && dates.some(d => b.dt.startsWith(d)));
  
  console.log("Found BS1 count:", relevantBs1.length);
  
  const { data: acmac1 } = await supabase.from('acmac1').select('id, name');
  const assetNameMap = {};
  acmac1.forEach(a => assetNameMap[a.id] = a.name);
  
  // Test case
  const t = {
    date: '2020-05-05',
    fundName: 'Bandhan Liquid Fund - Direct Plan - Growth',
    amount: 99995.00,
    units: 29.834,
    isin: ''
  };
  
  for (const b of relevantBs1) {
      if (b.amid !== 503144 && b.amid !== 503134) continue;
      
      const bName = (assetNameMap[b.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tName = (t.fundName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bNameParts = (assetNameMap[b.amid] || '').toLowerCase().split(/[\s\-]+/).filter(w => w.length > 2);
      const tNameParts = (t.fundName || '').toLowerCase().split(/[\s\-]+/).filter(w => w.length > 2);
      let sharedWords = 0;
      for (const w of tNameParts) {
         if (bNameParts.includes(w)) sharedWords++;
      }
      const matchName = sharedWords >= 2 || (!!tName && !!bName && (bName.includes(tName) || tName.includes(bName)));

      const bNetAmt = Number(b.amt || b.camt || 0) - Number(b.chrgs || 0);
      const matchAmt = Math.abs(bNetAmt - t.amount) < 1 || Math.abs(Number(b.amt || b.camt || 0) - t.amount) < 1;

      const matchUnits = Math.abs(Number(b.qn || b.qty || 0) - t.units) < 0.001;

      console.log(`Checking vs BS1 ${b.trid} (DT: ${b.dt}, AMT: ${b.amt}, QN: ${b.qn})`);
      console.log(`  matchName: ${matchName} (sharedWords: ${sharedWords})`);
      console.log(`  matchAmt: ${matchAmt} (b.amt=${b.amt}, bNetAmt=${bNetAmt}, t.amount=${t.amount})`);
      console.log(`  matchUnits: ${matchUnits} (b.qn=${b.qn}, t.units=${t.units})`);
  }
}

check();

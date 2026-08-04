import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: ledgers, error: err1 } = await supabase.from('acmac1').select('id, name, parent_id, ext_id').eq('parent_id', 200050);
  if (err1) console.error(err1);
  const { data: assets, error: err2 } = await supabase.from('asset_master').select('name, asset_type');
  if (err2) console.error(err2);
  
  if (!assets) return;
  const assetMap = {};
  assets.forEach(a => {
    if (a.name) assetMap[a.name.toLowerCase().trim()] = a.asset_type;
  });
  
  // also map basic keywords
  for (const l of ledgers) {
    let assetType = null;
    const lName = l.name.toLowerCase().trim();
    if (assetMap[lName]) {
      assetType = assetMap[lName];
    } else {
      // Find partial match
      const matchedAsset = assets.find(a => a.name && lName.includes(a.name.toLowerCase().trim()));
      if (matchedAsset) assetType = matchedAsset.asset_type;
      
      if (!assetType) {
        if (lName.includes('liquid') || lName.includes('debt')) assetType = 61;
        else if (lName.includes('fund') || lName.includes('etf')) assetType = 60;
      }
    }
    
    if (assetType === 60) {
      console.log('Moving ' + l.name + ' from Stocks to MF(Equity)');
      await supabase.from('acmac1').update({ parent_id: 200061 }).eq('id', l.id);
    } else if (assetType === 61) {
      console.log('Moving ' + l.name + ' from Stocks to MF(Debt)');
      await supabase.from('acmac1').update({ parent_id: 200062 }).eq('id', l.id);
    } else if (assetType === 62) {
      console.log('Moving ETF ' + l.name + ' from Stocks to MF(Equity)');
      await supabase.from('acmac1').update({ parent_id: 200061 }).eq('id', l.id);
    }
  }
  console.log('Done fixing parent_ids');
}
run();

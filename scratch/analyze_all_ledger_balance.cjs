const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: ledgers } = await supabase.from('acmac1')
    .select('id, name, acid, db_bal, cr_bal, is_group')
    .eq('acid', 31)
    .eq('is_group', 0); // 31 is Saahil Shah (from earlier)

  const { data: trans1 } = await supabase.from('trans1').select('maid, cramt, dramt, vid').eq('acid', 31);
  const { data: transc1 } = await supabase.from('transc1').select('maid, cramt, dramt, vid').eq('acid', 31);

  const t1Map = new Map(), t1_noVid0_Map = new Map();
  for (let e of trans1) {
    t1Map.set(e.maid, (t1Map.get(e.maid) || 0) + (e.dramt || 0) - (e.cramt || 0));
    if (e.vid !== 0) {
      t1_noVid0_Map.set(e.maid, (t1_noVid0_Map.get(e.maid) || 0) + (e.dramt || 0) - (e.cramt || 0));
    }
  }

  const tc1Map = new Map();
  for (let e of transc1) {
    tc1Map.set(e.maid, (tc1Map.get(e.maid) || 0) + (e.dramt || 0) - (e.cramt || 0));
  }

  console.log('--- DIFFERENCES (Saahil) ---');
  let diffCount = 0;
  for (let l of ledgers) {
    const logicBal = (l.db_bal - l.cr_bal) + (t1_noVid0_Map.get(l.id) || 0) + (tc1Map.get(l.id) || 0);
    const bsBal = (t1Map.get(l.id) || 0) + (tc1Map.get(l.id) || 0);
    if (Math.abs(logicBal - bsBal) > 0.01) {
      console.log(`Ledger ${l.id} (${l.name}): Logic=${logicBal.toFixed(2)}, BS=${bsBal.toFixed(2)} | ACMAC1 OB=${l.db_bal - l.cr_bal}, Trans1_Vid0=${(t1Map.get(l.id) || 0) - (t1_noVid0_Map.get(l.id) || 0)}`);
      diffCount++;
    }
  }
  console.log(`Total differences: ${diffCount}`);
}

run();

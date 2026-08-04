const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Let's pick a bank ledger for Pramesh
  const { data: bankLedgers } = await supabase.from('acmac1')
    .select('id, name, acid, db_bal, cr_bal')
    .eq('acid', 30)
    .ilike('name', '%Bank%')
    .limit(1);

  if (!bankLedgers || bankLedgers.length === 0) return;
  const l = bankLedgers[0];
  console.log('Ledger:', l);

  const { data: trans1 } = await supabase.from('trans1')
    .select('cramt, dramt, dt, vid')
    .eq('maid', l.id)
    .eq('acid', l.acid);
    
  const { data: transc1 } = await supabase.from('transc1')
    .select('cramt, dramt, dt, vid')
    .eq('maid', l.id)
    .eq('acid', l.acid);

  console.log(`Trans1 count: ${trans1.length}, TransC1 count: ${transc1.length}`);

  let sumTrans1Dr = 0, sumTrans1Cr = 0;
  let sumTrans1Dr_noVid0 = 0, sumTrans1Cr_noVid0 = 0;
  for (let e of trans1) {
    sumTrans1Dr += Number(e.dramt) || 0;
    sumTrans1Cr += Number(e.cramt) || 0;
    if (e.vid !== 0) {
      sumTrans1Dr_noVid0 += Number(e.dramt) || 0;
      sumTrans1Cr_noVid0 += Number(e.cramt) || 0;
    }
  }

  let sumTransC1Dr = 0, sumTransC1Cr = 0;
  for (let e of transc1) {
    sumTransC1Dr += Number(e.dramt) || 0;
    sumTransC1Cr += Number(e.cramt) || 0;
  }

  console.log('--- SUMMARIES ---');
  console.log(`ACMAC1 (OB): ${l.db_bal - l.cr_bal}`);
  console.log(`Trans1 All: ${(sumTrans1Dr - sumTrans1Cr).toFixed(2)}`);
  console.log(`Trans1 NoVid0: ${(sumTrans1Dr_noVid0 - sumTrans1Cr_noVid0).toFixed(2)}`);
  console.log(`TransC1 All: ${(sumTransC1Dr - sumTransC1Cr).toFixed(2)}`);
  
  console.log(`\nLogic.ts Ledger Balance = ACMAC1 + Trans1_NoVid0 + TransC1: ${(l.db_bal - l.cr_bal + sumTrans1Dr_noVid0 - sumTrans1Cr_noVid0 + sumTransC1Dr - sumTransC1Cr).toFixed(2)}`);
  console.log(`BalanceSheet.ts Balance = Trans1_All + TransC1: ${(sumTrans1Dr - sumTrans1Cr + sumTransC1Dr - sumTransC1Cr).toFixed(2)}`);
}

run();

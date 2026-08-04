require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: acmac1 } = await s.from('acmac1').select('*');
  const { data: transc1 } = await s.from('transc1').select('*');
  const { data: trans1 } = await s.from('trans1').select('*');
  const { data: portfolios } = await s.from('portfolios').select('id, investor_name');

  const acmac1Map = new Map();
  acmac1.forEach(a => {
    let list = acmac1Map.get(a.id);
    if(!list) { list = []; acmac1Map.set(a.id, list); }
    list.push(a);
  });

  const transC1ByMaid = new Map(), trans1ByMaid = new Map();
  transc1.forEach(t => {
    let list = transC1ByMaid.get(t.maid);
    if(!list) { list = []; transC1ByMaid.set(t.maid, list); }
    list.push(t);
  });
  trans1.forEach(t => {
    let list = trans1ByMaid.get(t.maid);
    if(!list) { list = []; trans1ByMaid.set(t.maid, list); }
    list.push(t);
  });

  function getLedgerBalance(lid, acidNum) {
    const rawC1 = transC1ByMaid.get(lid) || [];
    const raw1 = trans1ByMaid.get(lid) || [];
    const entries = [...rawC1.filter(e => !acidNum || e.acid === acidNum), ...raw1.filter(e => !acidNum || e.acid === acidNum)];
    
    let openingBalance = 0;
    const ledgerList = acmac1Map.get(lid) || [];
    const ledgerObj = ledgerList.find(a => !acidNum || a.acid === acidNum) || ledgerList[0];
    if (ledgerObj) {
      openingBalance = (ledgerObj.db_bal || 0) - (ledgerObj.cr_bal || 0);
    }
    
    let running = openingBalance;
    entries.forEach(e => {
       running += (e.dramt || 0) - (e.cramt || 0);
    });
    return running;
  }

  for (const pf of portfolios) {
    const acidNum = pf.id;
    const ledgers = acmac1.filter(a => !a.is_group && (!acidNum || a.acid === acidNum));
    
    let totalDebit = 0, totalCredit = 0;
    ledgers.forEach(l => {
       const bal = getLedgerBalance(l.id, acidNum);
       if (Math.abs(bal) < 0.001) return;
       if (bal > 0) totalDebit += bal;
       if (bal < 0) totalCredit += Math.abs(bal);
    });
    
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      console.log(`❌ OUT OF BALANCE! ${pf.investor_name} (ID ${acidNum}): Diff = ${diff.toFixed(2)}`);
    } else {
      console.log(`✅ Balanced: ${pf.investor_name} (ID ${acidNum})`);
    }
  }
}

run();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ajjeoijjsklgkioxqkrb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI');

async function fixAll() {
  console.log("Fetching all bs1...");
  // Fetch in loop to get all pages if > 1000
  let allBs1 = [];
  let from = 0;
  let to = 999;
  while (true) {
    const { data: bs1Page, error } = await supabase.from('bs1')
      .select('pfid, amid, qn, amt, trty, dt, trid')
      .not('pfid', 'is', null)
      .not('amid', 'is', null)
      .range(from, to);
    if (error) throw error;
    allBs1 = allBs1.concat(bs1Page);
    if (bs1Page.length < 1000) break;
    from += 1000;
    to += 1000;
  }
  
  console.log(`Fetched ${allBs1.length} bs1 rows`);
  
  console.log("Fetching all sum_table...");
  let allSumTable = [];
  from = 0;
  to = 999;
  while (true) {
    const { data: sumPage, error } = await supabase.from('sum_table')
      .select('sid, pfolio_id, amid, qnt, amtinv')
      .range(from, to);
    if (error) throw error;
    allSumTable = allSumTable.concat(sumPage);
    if (sumPage.length < 1000) break;
    from += 1000;
    to += 1000;
  }

  console.log(`Fetched ${allSumTable.length} sum_table rows`);

  const groups = {};
  for (const t of allBs1) {
    const key = `${t.pfid}_${t.amid}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const trueHoldings = {};
  for (const key of Object.keys(groups)) {
    const txs = groups[key].sort((a, b) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trid) - Number(b.trid)));
    let qty = 0;
    let amtInvested = 0;
    
    for (const t of txs) {
      const q = Number(t.qn) || 0;
      const amt = Number(t.amt) || 0;
      const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
      
      if (isBuy) {
        qty += q;
        amtInvested += amt;
      } else {
        const prevQty = qty;
        qty -= q;
        if (prevQty > 0) {
          amtInvested -= (q / prevQty) * amtInvested;
        } else {
          amtInvested -= amt;
        }
      }
    }
    
    if (qty <= 0.0001) {
      qty = 0;
      amtInvested = 0;
    }
    if (amtInvested < 0) amtInvested = 0;
    trueHoldings[key] = { qty, amtInvested };
  }

  const updates = [];
  
  for (const s of allSumTable) {
    const key = `${s.pfolio_id}_${s.amid}`;
    const truth = trueHoldings[key] || { qty: 0, amtInvested: 0 };
    
    const diffQty = Math.abs(Number(s.qnt) - truth.qty) > 0.01;
    const diffAmt = Math.abs(Number(s.amtinv) - truth.amtInvested) > 0.01;
    
    if (diffQty || diffAmt) {
      updates.push({
        sid: s.sid,
        pfolio_id: s.pfolio_id,
        amid: s.amid,
        old_qnt: s.qnt,
        old_amtinv: s.amtinv,
        new_qnt: truth.qty,
        new_amtinv: truth.amtInvested
      });
    }
  }

  console.log(`Found ${updates.length} sum_table rows to fix!`);
  
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(u => {
      console.log(`Fixing pfid=${u.pfolio_id} amid=${u.amid}: Qnt ${u.old_qnt}->${u.new_qnt}, AmtInv ${u.old_amtinv}->${u.new_amtinv}`);
      return supabase.from('sum_table').update({ qnt: u.new_qnt, amtinv: u.new_amtinv }).eq('sid', u.sid);
    }));
  }
  console.log("Done!");
}
fixAll();

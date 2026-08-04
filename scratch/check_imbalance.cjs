const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function check() {
  const { data: groups } = await supabase.from('acma1').select('*');
  const { data: ledgers } = await supabase.from('acmac1').select('*');
  const { data: entries } = await supabase.from('trtran1').select('*');
  
  // 1. Check if DB is balanced
  let totalDbDr = 0;
  let totalDbCr = 0;
  const unbalancedVouchers = {};
  entries.forEach(e => {
    totalDbDr += (e.debit || 0);
    totalDbCr += (e.credit || 0);
    if (!unbalancedVouchers[e.trdet_id]) unbalancedVouchers[e.trdet_id] = { dr: 0, cr: 0 };
    unbalancedVouchers[e.trdet_id].dr += (e.debit || 0);
    unbalancedVouchers[e.trdet_id].cr += (e.credit || 0);
  });
  
  console.log(`DB Totals: DR=${totalDbDr.toFixed(2)}, CR=${totalDbCr.toFixed(2)}, Diff=${(totalDbDr - totalDbCr).toFixed(2)}`);
  
  let hasUnbalanced = false;
  for (const vid in unbalancedVouchers) {
    const v = unbalancedVouchers[vid];
    if (Math.abs(v.dr - v.cr) > 0.01) {
      console.log(`Voucher ${vid} is unbalanced! DR=${v.dr}, CR=${v.cr}`);
      hasUnbalanced = true;
    }
  }
  if (!hasUnbalanced) console.log("All vouchers in DB are perfectly balanced.");

  // 2. Check getGroupType logic
  const getGroupType = (groupId) => {
    let current = groups.find(g => String(g.id) === String(groupId));
    while (current) {
      if (current.type) return current.type;
      current = groups.find(g => String(g.id) === String(current.parent));
    }
    return "ASSET";
  };
  
  let totalAssets = 0;
  let totalLiab = 0;
  
  let missingLedgers = 0;
  let missingLedgerBalanceDr = 0;
  let missingLedgerBalanceCr = 0;
  
  entries.forEach(e => {
    const l = ledgers.find(l => String(l.id) === String(e.ledger_id));
    if (!l) {
      missingLedgers++;
      missingLedgerBalanceDr += (e.debit || 0);
      missingLedgerBalanceCr += (e.credit || 0);
      return;
    }
    
    const type = getGroupType(l.parent_id);
    if (type === "ASSET") {
      totalAssets += (e.debit || 0) - (e.credit || 0);
    } else {
      totalLiab += (e.credit || 0) - (e.debit || 0);
    }
  });
  
  console.log(`Report Totals: Assets=${totalAssets.toFixed(2)}, Liab=${totalLiab.toFixed(2)}, Diff=${(totalAssets - totalLiab).toFixed(2)}`);
  console.log(`Missing Ledgers in entries: count=${missingLedgers}, DR=${missingLedgerBalanceDr.toFixed(2)}, CR=${missingLedgerBalanceCr.toFixed(2)}`);
}

check().catch(console.error);

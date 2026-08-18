const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function getAllRows(table, filterCol, filterVal) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (filterCol && filterVal !== undefined) q = q.eq(filterCol, filterVal);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function runBalanceSheetSimulation() {
  const accountId = 31; // Saahil Shah
  const endDate = '2027-03-31';

  // 1. Fetch groups & ledgers for acid=31
  const allAcmac = await getAllRows('acmac1', 'acid', accountId);
  const groups = allAcmac.filter(a => a.is_group);
  const ledgers = allAcmac.filter(a => !a.is_group);

  // 2. Fetch vouchers & transc1 / trans1
  const vouchersC1 = await getAllRows('vouchersc1', 'acid', accountId);
  const vouchers1 = await getAllRows('vouchers1', 'acid', accountId);
  const vouchers = [...vouchersC1, ...vouchers1];
  const voucherMap = {};
  vouchers.forEach(v => { voucherMap[v.vid] = v; });

  const tc1 = await getAllRows('transc1', 'acid', accountId);
  const t1 = await getAllRows('trans1', 'acid', accountId);
  const allEntries = [...tc1, ...t1];

  console.log(`Groups: ${groups.length}, Ledgers: ${ledgers.length}, Vouchers: ${vouchers.length}, Entries: ${allEntries.length}`);

  // Build group map
  const groupMap = {};
  groups.forEach(g => {
    groupMap[String(g.id)] = { id: String(g.id), name: g.name, parent: g.parent_id ? String(g.parent_id) : null, ledgers: [], children: [] };
  });

  const getGroupType = (groupId) => {
    let current = groups.find(g => String(g.id) === String(groupId));
    while (current) {
      if (current.special_type_id === 100 || current.special_type_id === 150 || current.name.toLowerCase().includes('asset') || current.id === 50 || current.id === 200050 || current.parent_id === 50) return 'ASSET';
      if (current.special_type_id === 200 || current.name.toLowerCase().includes('liabilit') || current.name.toLowerCase().includes('capital') || current.id === 70 || current.id === 60 || current.id === 80) return 'LIABILITY';
      if (current.parent_id) {
        current = groups.find(g => String(g.id) === String(current.parent_id));
      } else {
        break;
      }
    }
    // Check known root groups in acmac1
    const gid = Number(groupId);
    if (gid === 50 || gid === 55 || gid === 60 || gid === 75 || gid === 200050 || gid === 200061) return 'ASSET';
    return 'LIABILITY';
  };

  // Calculate balance per ledger
  const calcLedgerBal = (l) => {
    let dr = Number(l.db_bal) || 0;
    let cr = Number(l.cr_bal) || 0;
    allEntries.forEach(e => {
      if (String(e.maid) === String(l.id)) {
        dr += Number(e.dramt) || 0;
        cr += Number(e.cramt) || 0;
      }
    });
    return { dr, cr, net: dr - cr };
  };

  // Group ledgers by parent_id
  let totalAsset = 0;
  let totalLiability = 0;
  const unmappedLedgers = [];

  ledgers.forEach(l => {
    const bal = calcLedgerBal(l);
    const parentKey = String(l.parent_id);
    const grp = groupMap[parentKey];
    if (!grp) {
      unmappedLedgers.push({ ledger: l, bal });
      return;
    }
    const type = getGroupType(parentKey);
    if (type === 'ASSET') {
      totalAsset += (bal.dr - bal.cr);
    } else {
      totalLiability += (bal.cr - bal.dr);
    }
  });

  console.log(`\nUnmapped Ledgers without valid group in acid=31: ${unmappedLedgers.length}`);
  unmappedLedgers.forEach(u => {
    console.log(`  id=${u.ledger.id} name="${u.ledger.name}" parent_id=${u.ledger.parent_id} DR=${u.bal.dr} CR=${u.bal.cr} NET=${u.bal.net}`);
  });

  // Let's check Canara Bank ledger:
  const canbk = ledgers.filter(l => l.name.toLowerCase().includes('canara'));
  console.log('\nCanara Bank ledgers in acid=31:');
  canbk.forEach(c => {
    const b = calcLedgerBal(c);
    console.log(`  id=${c.id} name="${c.name}" parent_id=${c.parent_id} groupExists=${!!groupMap[String(c.parent_id)]} DR=${b.dr} CR=${b.cr} NET=${b.net}`);
  });

  // Check all CN stock ledgers and their balances:
  console.log('\n--- All CN Stock Ledgers in acid=31 ---');
  const cnNames = [
    'Aditya Birla Sun Life AMC Limited', 'Anand Rathi Wealth Limited', 'Aurobindo Pharma',
    'Bank of India', 'Bharat Heavy Electricals Limited', 'Bharat Petroleum Corporation Limited',
    'Canara Bank', 'Coal India Limited', 'General Insurance Corporation of India',
    'HFCL Limited', 'Hindustan Petroleum Corporation Limited', 'Indus Towers Limited',
    'Indian Oil Corporation Limited', 'Motherson Sumi Wiring India Limited',
    'The New India Assurance Company Limited', 'Nexus Select Trust',
    'Oil & Natural Gas Corporation Limited', 'REC Limited', 'R R Kabel Limited', 'Wipro Limited'
  ];

  for (const name of cnNames) {
    const matched = ledgers.filter(l => l.name === name);
    matched.forEach(m => {
      const b = calcLedgerBal(m);
      console.log(`  id=${m.id} "${m.name}" parent_id=${m.parent_id} grp=${groupMap[String(m.parent_id)]?.name} DR=${b.dr} CR=${b.cr} NET=${b.net}`);
    });
  }

  // Check which transc1 rows in voucher 15623 point to ledgers
  console.log('\n--- Voucher 15623 lines & their target ledgers ---');
  const v15623 = allEntries.filter(e => e.vid === 15623);
  v15623.forEach(e => {
    const l = ledgers.find(x => String(x.id) === String(e.maid));
    const grp = l ? groupMap[String(l.parent_id)] : null;
    console.log(`  transid=${e.transid} maid=${e.maid} dramt=${e.dramt} cramt=${e.cramt} -> ledger="${l?.name}" grp="${grp?.name}" (parent=${l?.parent_id})`);
  });
}

runBalanceSheetSimulation().catch(console.error);

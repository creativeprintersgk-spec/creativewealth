import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function safeFetchAll(table: string) {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(page * size, (page + 1) * size - 1);
    if (error) { console.error(`Error fetching ${table}:`, error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  const [acmac1, vouchers1, vouchersC1, trans1, transC1, accPflink, sam] = await Promise.all([
    safeFetchAll('acmac1'),
    safeFetchAll('vouchers1'),
    safeFetchAll('vouchersc1'),
    safeFetchAll('trans1'),
    safeFetchAll('transc1'),
    safeFetchAll('acc_pflink'),
    safeFetchAll('sam')
  ]);

  console.log(`Fetched from Supabase: acmac1=${acmac1.length}, vouchers1=${vouchers1.length}, vouchersC1=${vouchersC1.length}, trans1=${trans1.length}, transC1=${transC1.length}`);

  const acid = '29';
  const endDate = '2026-03-31';

  const samMap: Record<number, string> = {};
  sam.forEach((s: any) => { samMap[s.amid] = s.anm; });

  const portfolioIds = accPflink.filter((l: any) => String(l.acid) === acid).map((l: any) => String(l.pfid));
  console.log('Unnati (acid 29) Portfolio IDs:', portfolioIds);

  const groups = acmac1.filter((a: any) => a.is_group && String(a.acid) === acid).map((a: any) => ({
    id: String(a.id),
    name: a.name,
    parent: a.parent_id ? String(a.parent_id) : undefined,
    specialTypeId: a.special_type_id
  }));

  const ledgers = acmac1.filter((a: any) => !a.is_group && String(a.acid) === acid).map((a: any) => ({
    id: String(a.id),
    name: a.name,
    groupId: String(a.parent_id),
    openingBalance: 0,
    openingType: 'DR'
  }));

  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { ...v, _src: 'c', portfolioId: v.pfid ? String(v.pfid) : undefined, accountId: v.acid ? String(v.acid) : undefined }; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { ...v, _src: 't', portfolioId: v.pfid ? String(v.pfid) : undefined, accountId: v.acid ? String(v.acid) : undefined }; });

  const entries: any[] = [
    ...transC1.map((e: any) => ({ ...e, voucherId: `c_${e.vid}`, ledgerId: String(e.maid), accountId: e.acid ? String(e.acid) : undefined, debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, date: e.dt || '' })),
    ...trans1.map((e: any) => ({ ...e, voucherId: `t_${e.vid}`, ledgerId: String(e.maid), accountId: e.acid ? String(e.acid) : undefined, debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, date: e.dt || '' }))
  ];

  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.specialTypeId === 250 || current.specialTypeId === 275 || current.id === '1' || current.id === '64' || current.id === '65') return 'LIABILITY';
      if (current.specialTypeId === 150 || current.id === '2' || current.id === '45' || current.id === '50' || current.id === '55' || current.id === '60') return 'ASSET';
      if (current.id === '155' || current.id === '180') return 'INCOME';
      if (current.id === '160' || current.id === '170' || current.id === '171' || current.id === '175') return 'EXPENSE';
      current = groups.find((g: any) => g.id === current.parent);
    }
    return 'ASSET';
  };

  const calcLedgerBal = (ledger: any, groupType: string): number => {
    let debit = 0;
    let credit = 0;
    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(ledger.id)) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        if (!isOpeningBalance && entryDate > endDate) return;

        if (acid) {
          const belongsToAccount =
            (entryAcid === acid) ||
            (entryPfid && portfolioIds.includes(entryPfid));
          if (!belongsToAccount) return;
        }

        debit += e.debit || 0;
        credit += e.credit || 0;
      }
    });
    return groupType === 'ASSET' ? debit - credit : credit - debit;
  };

  const groupMap: Record<string, any> = {};
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
  });

  const seenLids = new Set<string>();
  const ledgersToInclude: any[] = [];

  ledgers.forEach((l: any) => {
    seenLids.add(String(l.id));
    ledgersToInclude.push(l);
  });

  // Add security ledgers
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    if (!isOpeningBalance && entryDate > endDate) return;

    const belongsToAccount = !acid ||
      (entryAcid === acid) ||
      (entryPfid && portfolioIds.includes(entryPfid));

    if (belongsToAccount && !seenLids.has(String(e.ledgerId))) {
      seenLids.add(String(e.ledgerId));
      const lidNum = Number(e.ledgerId);
      const name = samMap[lidNum] || `Asset ${e.ledgerId}`;
      ledgersToInclude.push({
        id: String(e.ledgerId),
        name,
        groupId: lidNum >= 100000 ? '50' : '50',
        openingBalance: 0,
        openingType: 'DR'
      });
    }
  });

  ledgersToInclude.forEach((l: any) => {
    let targetGroup = String(l.groupId);
    if (!groupMap[targetGroup]) {
      targetGroup = '50';
    }
    const type = getGroupType(targetGroup);
    const bal = calcLedgerBal(l, type);
    if (Math.abs(bal) > 0.01) {
      if (groupMap[targetGroup]) {
        groupMap[targetGroup].ledgers.push({ ...l, balance: bal, groupType: type });
      }
    }
  });

  // Build tree
  const tree: any[] = [];
  Object.values(groupMap).forEach((g: any) => {
    if (g.parent && groupMap[g.parent]) {
      groupMap[g.parent].children.push(g);
    } else {
      tree.push(g);
    }
  });

  const calcGroupBalance = (group: any): number => {
    let bal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0);
    group.children.forEach((child: any) => { bal += calcGroupBalance(child); });
    group.balance = bal;
    return bal;
  };
  tree.forEach(g => calcGroupBalance(g));

  const assets = tree.filter(g => getGroupType(g.id) === 'ASSET');
  const liabilities = tree.filter(g => getGroupType(g.id) !== 'ASSET');

  const totalAssets = assets.reduce((s, g) => s + g.balance, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);

  console.log('\n=== RESULTS FOR UNNATI SHAH ===');
  console.log(`Total Assets: ₹${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ₹${totalLiabilities.toFixed(2)}`);
  console.log(`Difference: ₹${(totalAssets - totalLiabilities).toFixed(2)}`);

  console.log('\n--- ASSET GROUPS BREAKDOWN ---');
  function printGroup(g: any, indent = 0) {
    const pad = ' '.repeat(indent);
    console.log(`${pad}> Group "${g.name}" (ID: ${g.id}): ₹${g.balance.toFixed(2)}`);
    g.ledgers.forEach((l: any) => {
      console.log(`${pad}   - Ledger "${l.name}" (ID: ${l.id}): ₹${l.balance.toFixed(2)}`);
    });
    g.children.forEach((c: any) => printGroup(c, indent + 3));
  }
  assets.forEach(g => printGroup(g));

  console.log('\n--- LIABILITY GROUPS BREAKDOWN ---');
  liabilities.forEach(g => printGroup(g));
}

run();

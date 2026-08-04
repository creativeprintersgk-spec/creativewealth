/**
 * Find exactly which ledger causes the ₹663 difference for Krisha (acid=32)
 * by simulating the exact same balanceSheet.ts logic.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Mirror the EXACT getGroupType logic from logic.ts
function getGroupType(st: number): string {
  if ([150, 40, 50, 125].includes(st)) return 'ASSET';
  if ([250, 275, 276].includes(st)) return 'LIABILITY';
  if (st === 280) return 'INCOME';
  if (st === 290) return 'EXPENSE';
  return 'ASSET'; // fallback
}

async function safeFetch(table: string, max = 100000): Promise<any[]> {
  const pkMap: Record<string, string> = {
    transc1: 'transid', trans1: 'transid', vouchersc1: 'vid', vouchers1: 'vid', acmac1: 'id', acc_pflink: 'pfid'
  };
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (all.length < max) {
    const { data, error } = await supabase.from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
    if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  console.log('=== KRISHA ₹663 EXACT SIMULATION ===\n');

  const KRISHA_ACID = 32;
  const END_DATE = '2027-03-31'; // FY 2026-2027 end

  const [acmac1All, pflinks, vouchersC1, vouchers1, transc1All, trans1All] = await Promise.all([
    safeFetch('acmac1'), safeFetch('acc_pflink'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'),
    safeFetch('transc1'), safeFetch('trans1')
  ]);

  // === Simulate getStoredGroups(KRISHA_ACID) ===
  const krishaGroups = acmac1All
    .filter((a: any) => a.is_group && Number(a.acid) === KRISHA_ACID)
    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      parent: a.parent_id ? String(a.parent_id) : undefined,
      type: getGroupType(a.special_type_id || 150),
      acid: a.acid,
      specialTypeId: a.special_type_id,
      special_type_id: a.special_type_id
    }));

  // === Simulate getStoredLedgers(KRISHA_ACID) ===
  const krishaLedgers = acmac1All
    .filter((a: any) => !a.is_group && Number(a.acid) === KRISHA_ACID)
    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      acid: a.acid
    }));

  // === Simulate voucher map ===
  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { ...v, id: `c_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { ...v, id: `t_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });

  // === Simulate getStoredEntries() ===
  const entries = [
    ...transc1All.map((e: any) => ({
      id: `c_${e.transid}`, voucherId: `c_${e.vid}`, ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0,
      accountId: e.acid ? String(e.acid) : undefined,
      quantity: Number(e.qty) || 0, price: Number(e.rate) || 0
    })),
    ...trans1All.map((e: any) => ({
      id: `t_${e.transid}`, voucherId: `t_${e.vid}`, ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0,
      accountId: e.acid ? String(e.acid) : undefined,
      quantity: 0, price: 0
    }))
  ];

  // Krisha portfolios
  const krishaPfids = pflinks.filter((l: any) => Number(l.acid) === KRISHA_ACID).map((l: any) => String(l.pfid));
  const accountId = String(KRISHA_ACID);

  // === Simulate balanceSheet.ts getGroupType ===
  const groupMap: Record<string, any> = {};
  krishaGroups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
  });

  const getGroupTypeSim = (groupId: string): string => {
    let current: any = krishaGroups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = krishaGroups.find((g: any) => g.id === current.parent);
    }
    return 'ASSET';
  };

  // === Simulate calcLedgerBal ===
  const calcLedgerBal = (ledger: any, groupType: string): number => {
    let debit = 0, credit = 0;
    entries.forEach((e: any) => {
      if (e.ledgerId === ledger.id) {
        const v = voucherMap[e.voucherId];
        const entryDate = v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;
        
        if (entryDate && entryDate <= END_DATE) {
          const belongsToAccount = (entryAcid === accountId) || (entryPfid && krishaPfids.includes(entryPfid));
          if (!belongsToAccount) return;
          debit += e.debit || 0;
          credit += e.credit || 0;
        }
      }
    });
    return groupType === 'ASSET' ? debit - credit : credit - debit;
  };

  // === Attach ledgers to groups ===
  let ledgersWithNoGroup = 0;
  krishaLedgers.forEach((l: any) => {
    if (!groupMap[l.groupId]) { ledgersWithNoGroup++; return; }
    const type = getGroupTypeSim(l.groupId);
    const bal = calcLedgerBal(l, type);
    if (Math.abs(bal) > 0.01) {
      groupMap[l.groupId].ledgers.push({ ...l, balance: bal, groupType: type });
    }
  });

  if (ledgersWithNoGroup > 0) {
    console.log(`⚠️ ${ledgersWithNoGroup} ledgers have no matching group in Krisha's acmac1`);
  }

  // === Build tree ===
  const tree: any[] = [];
  Object.values(groupMap).forEach((g: any) => {
    if (g.parent && groupMap[g.parent]) {
      groupMap[g.parent].children.push(g);
    } else {
      tree.push(g);
    }
  });

  // === Calc group balances ===
  const calcGroupBalance = (group: any): number => {
    let bal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0);
    group.children.forEach((child: any) => { bal += calcGroupBalance(child); });
    group.balance = bal;
    return bal;
  };
  tree.forEach(g => calcGroupBalance(g));

  // === Split assets/liabilities ===
  const assets = tree.filter(g => getGroupTypeSim(g.id) === 'ASSET');
  const liabilities = tree.filter(g => getGroupTypeSim(g.id) !== 'ASSET');
  const totalAssets = assets.reduce((s, g) => s + g.balance, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);

  console.log(`Total Assets:      ₹${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ₹${totalLiabilities.toFixed(2)}`);
  console.log(`Difference (A - L): ₹${(totalAssets - totalLiabilities).toFixed(2)}`);

  // === Show group breakdown ===
  console.log('\n--- ASSET groups ---');
  assets.forEach(g => {
    if (Math.abs(g.balance) > 0.01) {
      console.log(`  [${g.name}] (specialTypeId=${g.specialTypeId}) = ₹${g.balance.toFixed(2)}`);
    }
  });

  console.log('\n--- LIABILITY/INCOME/EXPENSE groups ---');
  liabilities.forEach(g => {
    if (Math.abs(g.balance) > 0.01) {
      console.log(`  [${g.name}] (specialTypeId=${g.specialTypeId} → type=${g.type}) = ₹${g.balance.toFixed(2)}`);
    }
  });

  // === Check for special_type_id values causing wrong classification ===
  console.log('\n--- Groups with unusual special_type_id values ---');
  const stidCounts: Record<number, { count: number, names: string[] }> = {};
  krishaGroups.forEach((g: any) => {
    const st = g.special_type_id || 0;
    if (!stidCounts[st]) stidCounts[st] = { count: 0, names: [] };
    stidCounts[st].count++;
    if (stidCounts[st].names.length < 3) stidCounts[st].names.push(g.name);
  });
  Object.entries(stidCounts).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([st, info]) => {
    console.log(`  special_type_id=${st}: ${info.count} groups (${info.names.join(', ')}...) → type=${getGroupType(Number(st))}`);
  });
}

run().catch(console.error);

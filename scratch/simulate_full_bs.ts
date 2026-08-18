import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// We replicate getBalanceSheet logic here in Node.js
async function run() {
  const pageSize = 1000;

  // 1. Fetch all required tables with pagination
  let allAcmac1: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await s.from('acmac1').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allAcmac1 = allAcmac1.concat(data);
    page++;
  }

  let allTrans1: any[] = [];
  page = 0;
  while (true) {
    const { data } = await s.from('trans1').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allTrans1 = allTrans1.concat(data);
    page++;
  }

  let allTransC1: any[] = [];
  page = 0;
  while (true) {
    const { data } = await s.from('transc1').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allTransC1 = allTransC1.concat(data);
    page++;
  }

  let allVouchers1: any[] = [];
  page = 0;
  while (true) {
    const { data } = await s.from('vouchers1').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allVouchers1 = allVouchers1.concat(data);
    page++;
  }

  let allVouchersC1: any[] = [];
  page = 0;
  while (true) {
    const { data } = await s.from('vouchersc1').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allVouchersC1 = allVouchersC1.concat(data);
    page++;
  }

  let allPortfolios: any[] = [];
  page = 0;
  while (true) {
    const { data } = await s.from('portfolios').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allPortfolios = allPortfolios.concat(data);
    page++;
  }

  let allAccPflink: any[] = [];
  page = 0;
  while (true) {
    const { data } = await s.from('acc_pflink').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allAccPflink = allAccPflink.concat(data);
    page++;
  }

  console.log('Loaded data counts:');
  console.log(`- acmac1: ${allAcmac1.length}`);
  console.log(`- trans1: ${allTrans1.length}`);
  console.log(`- transc1: ${allTransC1.length}`);
  console.log(`- vouchers1: ${allVouchers1.length}`);
  console.log(`- vouchersc1: ${allVouchersC1.length}`);
  console.log(`- portfolios: ${allPortfolios.length}`);
  console.log(`- accPflink: ${allAccPflink.length}`);

  // 2. Define frontend logic equivalents
  const getStoredPortfolios = () => {
    return allPortfolios
      .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
      .map(p => {
        const link = allAccPflink.find((l: any) => l.pfid === p.id);
        const accountId = link ? String(link.acid) : null;
        return {
          ...p,
          id: String(p.id),
          portfolioName: p.investor_name || p.full_name || `Portfolio ${p.id}`,
          accountId,
        };
      });
  };

  const getStoredGroups = (acid?: string | number) => {
    const acidNum = acid ? Number(acid) : null;
    return allAcmac1
      .filter((a: any) => a.is_group && (!acidNum || a.acid === acidNum))
      .map((a: any) => ({
        id: String(a.id),
        name: a.name,
        parent: a.parent_id ? String(a.parent_id) : undefined,
        specialTypeId: a.special_type_id,
        acid: a.acid
      }));
  };

  const getStoredLedgers = (acid?: string | number) => {
    const acidNum = acid ? Number(acid) : null;
    return allAcmac1
      .filter((a: any) => !a.is_group && (!acidNum || a.acid === acidNum))
      .map((a: any) => {
        const db = Number(a.db_bal) || 0;
        const cr = Number(a.cr_bal) || 0;
        return {
          id: String(a.id),
          name: a.name,
          groupId: String(a.parent_id),
          openingBalance: Math.abs(db - cr),
          openingType: db >= cr ? 'DR' as const : 'CR' as const,
          acid: a.acid
        };
      });
  };

  const getStoredEntries = () => {
    const c1 = allTransC1.map((e: any) => ({
      id: `c_${e.transid}`,
      voucherId: `c_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      date: e.dt || '',
      accountId: e.acid ? String(e.acid) : undefined,
    }));
    const t1 = allTrans1.map((e: any) => ({
      id: `t_${e.transid}`,
      voucherId: `t_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      date: e.dt || '',
      accountId: e.acid ? String(e.acid) : undefined,
    }));
    return [...c1, ...t1];
  };

  const getStoredVouchers = () => {
    return [
      ...allVouchersC1.map(v => ({ ...v, _src: 'c' })),
      ...allVouchers1.map(v => ({ ...v, _src: 't' }))
    ].map((v: any) => ({
      id: `${v._src || 'v'}_${v.vid}`,
      date: v.dt || '',
      type: String(v.vtyp || 'journal'),
      narration: v.narr || '',
      accountId: v.acid ? String(v.acid) : undefined,
      portfolioId: v.pfolio_id
    }));
  };

  // Replicate getBalanceSheet logic
  const calculateBS = (accountId?: string) => {
    const groups = getStoredGroups(accountId);
    const ledgers = getStoredLedgers(accountId);
    const entries = getStoredEntries();
    const vouchers = getStoredVouchers();

    const getGroupType = (groupId: string): string => {
      let current: any = groups.find((g: any) => g.id === groupId);
      while (current) {
        if (current.specialTypeId === 150) return "ASSET";
        if (current.specialTypeId === 250) return "LIABILITY";
        if (current.specialTypeId === 350) return "INCOME";
        if (current.specialTypeId === 450) return "EXPENSE";
        current = groups.find((g: any) => g.id === current.parent);
      }
      return "ASSET";
    };

    const voucherMap: Record<string, any> = {};
    vouchers.forEach((v: any) => voucherMap[v.id] = v);

    const allPortfolios = getStoredPortfolios();
    const portfolioIds = accountId
      ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
      : null;

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
          const dateOk = isOpeningBalance || entryDate <= '2027-03-31'; // use FY end

          if (dateOk) {
            if (accountId) {
              const belongsToAccount =
                (entryAcid === accountId) ||
                (entryPfid && portfolioIds?.includes(Number(entryPfid)));
              if (!belongsToAccount) return;
            }
            debit  += e.debit  || 0;
            credit += e.credit || 0;
          }
        }
      });
      return groupType === "ASSET" ? debit - credit : credit - debit;
    };

    const groupMap: Record<string, any> = {};
    groups.forEach((g: any) => {
      groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
    });

    const ledgerIdsInEntries = new Set<string>();
    entries.forEach((e: any) => {
      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
      const dateOk = isOpeningBalance || entryDate <= '2027-03-31';

      if (dateOk) {
        if (accountId) {
          const belongsToAccount =
            (entryAcid === accountId) ||
            (entryPfid && portfolioIds?.includes(Number(entryPfid)));
          if (belongsToAccount) {
            ledgerIdsInEntries.add(e.ledgerId);
          }
        } else {
          ledgerIdsInEntries.add(e.ledgerId);
        }
      }
    });

    const existingLedgerIds = new Set(ledgers.map((l: any) => l.id));
    const missingLedgerIds = Array.from(ledgerIdsInEntries).filter(id => !existingLedgerIds.has(id));

    if (missingLedgerIds.length > 0) {
      const allLedgers = getStoredLedgers();
      missingLedgerIds.forEach(id => {
        const globalLedger = allLedgers.find((l: any) => String(l.id) === String(id));
        if (globalLedger) {
          ledgers.push(globalLedger);
        } else {
          ledgers.push({
            id: id,
            name: `Unassigned Ledger (${id})`,
            groupId: 'suspense_virtual',
            acid: accountId ? Number(accountId) : 31
          } as any);
        }
      });
    }

    if (!groupMap['suspense_virtual']) {
      groupMap['suspense_virtual'] = { 
        id: 'suspense_virtual', 
        name: 'Suspense / Unassigned', 
        specialTypeId: 250, 
        balance: 0, 
        children: [], 
        ledgers: [] 
      };
    }

    ledgers.forEach((l: any) => {
      let targetGroup = l.groupId;
      if (!groupMap[targetGroup]) {
        targetGroup = 'suspense_virtual';
      }
      const type = getGroupType(targetGroup);
      const bal = calcLedgerBal(l, type);
      groupMap[targetGroup].ledgers.push({ ...l, balance: bal, groupType: type });
    });

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

    const assets      = tree.filter(g => getGroupType(g.id) === "ASSET");
    const liabilities = tree.filter(g => getGroupType(g.id) !== "ASSET");

    const totalAssets      = assets.reduce((s, g) => s + g.balance, 0);
    const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);

    return {
      totalAssets,
      totalLiabilities,
      diff: totalAssets - totalLiabilities,
      missingLedgerIds,
      ledgersCount: ledgers.length,
      groupsCount: groups.length
    };
  };

  // Run for all active accounts in acmac1
  const activeAcids = [30, 32, 36, 61];
  activeAcids.forEach(acid => {
    const res = calculateBS(String(acid));
    console.log(`\nAccount ID: ${acid}`);
    console.log(`- Ledgers count: ${res.ledgersCount}, Groups count: ${res.groupsCount}`);
    console.log(`- Total Assets: ${res.totalAssets.toFixed(2)}`);
    console.log(`- Total Liabilities: ${res.totalLiabilities.toFixed(2)}`);
    console.log(`- Discrepancy: ${res.diff.toFixed(2)}`);
    console.log(`- Missing Ledger IDs count: ${res.missingLedgerIds.length}`);
    if (res.missingLedgerIds.length > 0) {
      console.log(`  Sample missing ledger IDs: ${res.missingLedgerIds.slice(0, 10).join(', ')}`);
    }
  });
}
run();

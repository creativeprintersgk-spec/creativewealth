import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function safeFetch(table, max = 50000) {
  try {
    let all = [];
    const pkMap = {
      bs1: 'trid',
      transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
      acmac1: 'id', sam: 'amid', asset_master: 'amid',
      sum_table: 'sid', mprices: 'amid',
      scnote1: 'cnid'
    };
    let page = 0;
    const size = 1000;
    while (all.length < max) {
      const { data, error } = await supabase
        .from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
      if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      page++;
    }
    return all;
  } catch (e) {
    console.warn(`⚠️ ${table}:`, e);
    return [];
  }
}

async function run() {
  const accountId = '31'; // Saahil Shah A/c
  
  const [portfolios, igm, accPflink, acmac1,
         bs1, sumTable, vouchersC1, vouchers1, transC1, trans1, mprices, scnote1] = await Promise.all([
    safeFetch('portfolios'), safeFetch('investor_group_members'),
    safeFetch('acc_pflink'), safeFetch('acmac1'),
    safeFetch('bs1'), safeFetch('sum_table'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'), safeFetch('transc1'), safeFetch('trans1'), safeFetch('mprices'),
    safeFetch('scnote1'),
  ]);

  const uniqueAcmac1 = [];
  const seenAcmac = new Set();
  for (const a of acmac1) {
    if (a.name === 'Difference in Opening Balances') continue;
    const key = `${a.id}_${a.acid}_${a.is_group}_${a.parent_id}_${a.name}_${a.special_type_id}`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      uniqueAcmac1.push(a);
    }
  }

  const state = {
    portfolios,
    igm,
    accPflink,
    acmac1: uniqueAcmac1,
    vouchersC1: vouchersC1.map(v => ({ ...v, _src: 'c' })),
    vouchers1: vouchers1.map(v => ({ ...v, _src: 't' })),
    transC1: transC1.map(e => ({ ...e, _src: 'c' })),
    trans1: trans1.map(e => ({ ...e, _src: 't' })),
  };

  const getStoredGroupsLocal = (acid) => {
    const acidNum = acid ? Number(acid) : null;
    return state.acmac1
      .filter((a) => a.is_group && (!acidNum || a.acid === acidNum))
      .map((a) => ({
        id: String(a.id),
        name: a.name,
        parent: a.parent_id ? String(a.parent_id) : undefined,
        type: getGroupType(a.special_type_id || 150),
        acid: a.acid,
        specialTypeId: a.special_type_id
      }));
  };

  const getStoredLedgersLocal = (acid) => {
    const parsed = acid && acid !== 'undefined' ? Number(acid) : null;
    const acidNum = parsed && !isNaN(parsed) ? parsed : null;
    return state.acmac1
      .filter((a) => !a.is_group && (!acidNum || a.acid === acidNum))
      .map((a) => ({
        id: String(a.id),
        name: a.name,
        groupId: String(a.parent_id),
        openingBalance: 0,
        openingType: 'DR',
        currentBalance: 0,
        currentType: 'DR',
        amid: a.id >= 100000 ? a.id : undefined,
        acid: a.acid
      }));
  };

  function getGroupType(st) {
    if ([150, 40, 50, 125].includes(st)) return 'ASSET';
    if ([250, 275, 276].includes(st)) return 'LIABILITY';
    if (st === 280) return 'INCOME';
    if (st === 290) return 'EXPENSE';
    return 'ASSET';
  }

  const getStoredEntriesLocal = () => {
    return [...state.transC1, ...state.trans1].map((e) => ({
      id: `${e._src}_${e.transid}`,
      voucherId: `${e._src}_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      date: e.dt || '',
      accountId: e.acid ? String(e.acid) : undefined,
    }));
  };

  const getStoredVouchersLocal = () => {
    return [...state.vouchersC1, ...state.vouchers1].map((v) => ({
      id: `${v._src}_${v.vid}`,
      date: v.dt || '',
      type: String(v.vtyp || 'journal'),
      narration: v.narr || '',
      voucherNo: `V-${v.vid}`,
      portfolioId: v.pfid ? String(v.pfid) : undefined,
      accountId: v.acid ? String(v.acid) : undefined,
    }));
  };

  const getStoredPortfoliosLocal = () => {
    return state.portfolios
      .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
      .map(p => {
        const link = state.accPflink.find((l) => l.pfid === p.id);
        const accountId = link ? String(link.acid) : null;
        return {
          ...p,
          id: String(p.id),
          portfolioName: p.investor_name || p.full_name || `Portfolio ${p.id}`,
          accountId
        };
      });
  };

  const groups  = getStoredGroupsLocal(accountId);
  const ledgers = getStoredLedgersLocal(accountId);
  const entries = getStoredEntriesLocal();
  const vouchers = getStoredVouchersLocal();

  const getGroupTypeLocal = (groupId) => {
    let current = groups.find((g) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find((g) => g.id === current.parent);
    }
    return "ASSET";
  };

  const voucherMap = {};
  vouchers.forEach((v) => voucherMap[v.id] = v);

  const allPortfolios = getStoredPortfoliosLocal();
  const portfolioIds = accountId
    ? allPortfolios.filter((p) => p.accountId === accountId).map((p) => p.id)
    : null;

  const calcLedgerBal = (ledger, groupType, endDate) => {
    let debit = 0, credit = 0;
    entries.forEach((e) => {
      if (e.ledgerId === ledger.id) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        const dateOk = isOpeningBalance || entryDate <= endDate;

        if (dateOk) {
          if (accountId) {
            const belongsToAccount =
              (entryAcid === accountId) ||
              (entryPfid && portfolioIds?.includes(entryPfid));
            if (!belongsToAccount) return;
          }
          debit  += e.debit  || 0;
          credit += e.credit || 0;
        }
      }
    });
    return groupType === "ASSET" ? debit - credit : credit - debit;
  };

  const fyears = [
    '2019-03-31',
    '2020-03-31',
    '2021-03-31',
    '2022-03-31',
    '2023-03-31',
    '2024-03-31',
    '2025-03-31',
    '2026-03-31',
    '2027-03-31'
  ];

  console.log('\n=== Checking Balance Sheet Difference over the years ===');
  fyears.forEach(endDate => {
    // Reset group maps and tree for this specific end date
    const groupMap = {};
    groups.forEach((g) => {
      groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
    });

    const activeLedgers = [];
    ledgers.forEach(l => {
      const globalLedger = ledgers.find(ld => ld.id === l.id);
      if (globalLedger) activeLedgers.push(globalLedger);
    });

    activeLedgers.forEach((l) => {
      if (!groupMap[l.groupId]) return;
      const type = getGroupTypeLocal(l.groupId);
      const bal = calcLedgerBal(l, type, endDate);
      const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal;
      groupMap[l.groupId].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type });
    });

    const tree = [];
    Object.values(groupMap).forEach((g) => {
      if (g.parent && groupMap[g.parent]) {
        groupMap[g.parent].children.push(g);
      } else {
        tree.push(g);
      }
    });

    const calcGroupBalance = (group) => {
      let bal = group.ledgers.reduce((s, l) => s + l.balance, 0);
      group.children.forEach((child) => { bal += calcGroupBalance(child); });
      group.balance = bal;
      return bal;
    };
    tree.forEach(g => calcGroupBalance(g));

    const assets      = tree.filter(g => getGroupTypeLocal(g.id) === "ASSET");
    const liabilities = tree.filter(g => getGroupTypeLocal(g.id) !== "ASSET");

    const totalAssets      = assets.reduce((s, g) => s + g.balance, 0);
    const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);
    const diff = totalAssets - totalLiabilities;

    console.log(`As of ${endDate}: Assets=₹${totalAssets.toFixed(2)}, Liab=₹${totalLiabilities.toFixed(2)}, Diff=₹${diff.toFixed(2)}`);
  });
}

run().catch(console.error);

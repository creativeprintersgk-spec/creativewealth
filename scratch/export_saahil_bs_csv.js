import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
      bs1: 'trid', transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
      acmac1: 'id', sam: 'amid', asset_master: 'amid',
      sum_table: 'sid', mprices: 'amid', scnote1: 'cnid'
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
  const accountId = '31';
  const endDate = '2027-03-31';

  const [portfolios, igm, accPflink, acmac1,
         vouchersC1, vouchers1, transC1, trans1] = await Promise.all([
    safeFetch('portfolios'), safeFetch('investor_group_members'),
    safeFetch('acc_pflink'), safeFetch('acmac1'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'), safeFetch('transc1'), safeFetch('trans1'),
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
    portfolios, accPflink, acmac1: uniqueAcmac1,
    vouchersC1: vouchersC1.map(v => ({ ...v, _src: 'c' })),
    vouchers1: vouchers1.map(v => ({ ...v, _src: 't' })),
    transC1: transC1.map(e => ({ ...e, _src: 'c' })),
    trans1: trans1.map(e => ({ ...e, _src: 't' })),
  };

  const acidNum = Number(accountId);

  const groups = state.acmac1
    .filter((a) => a.is_group && (!acidNum || a.acid === acidNum))
    .map((a) => ({
      id: String(a.id),
      name: a.name,
      parent: a.parent_id ? String(a.parent_id) : undefined,
      type: getGroupType(a.special_type_id || 150),
      acid: a.acid,
      specialTypeId: a.special_type_id
    }));

  const ledgers = state.acmac1
    .filter((a) => !a.is_group && (!acidNum || a.acid === acidNum))
    .map((a) => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      acid: a.acid
    }));

  function getGroupType(st) {
    if ([150, 40, 50, 125].includes(st)) return 'ASSET';
    if ([250, 275, 276].includes(st)) return 'LIABILITY';
    if (st === 280) return 'INCOME';
    if (st === 290) return 'EXPENSE';
    return 'ASSET';
  }

  const entries = [...state.transC1, ...state.trans1].map((e) => ({
    id: `${e._src}_${e.transid}`,
    voucherId: `${e._src}_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    date: e.dt || '',
    accountId: e.acid ? String(e.acid) : undefined,
  }));

  const vouchers = [...state.vouchersC1, ...state.vouchers1].map((v) => ({
    id: `${v._src}_${v.vid}`,
    date: v.dt || '',
    portfolioId: v.pfid ? String(v.pfid) : undefined,
    accountId: v.acid ? String(v.acid) : undefined,
  }));

  const voucherMap = {};
  vouchers.forEach((v) => voucherMap[v.id] = v);

  const portfolioIds = state.portfolios
    .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
    .map(p => {
      const link = state.accPflink.find((l) => l.pfid === p.id);
      return { id: String(p.id), accountId: link ? String(link.acid) : null };
    })
    .filter(p => p.accountId === accountId)
    .map(p => p.id);

  // Accumulate totals per ledger
  const ledgerTotals = {};
  
  // Find orphan lines while calculating
  let totalDebit = 0;
  let totalCredit = 0;

  entries.forEach((e) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    const dateOk = isOpeningBalance || entryDate <= endDate;

    if (dateOk) {
      const belongsToAccount = (entryAcid === accountId) || (entryPfid && portfolioIds.includes(entryPfid));
      if (belongsToAccount) {
        if (!ledgerTotals[e.ledgerId]) {
          ledgerTotals[e.ledgerId] = { debit: 0, credit: 0 };
        }
        ledgerTotals[e.ledgerId].debit += e.debit;
        ledgerTotals[e.ledgerId].credit += e.credit;
        totalDebit += e.debit;
        totalCredit += e.credit;
      }
    }
  });

  console.log(`Total Debit: ${totalDebit.toFixed(2)}`);
  console.log(`Total Credit: ${totalCredit.toFixed(2)}`);
  console.log(`Difference: ${(totalDebit - totalCredit).toFixed(2)}`);

  // Build CSV
  let csvContent = "Type,Group,Ledger,Debit,Credit,Net Balance\n";
  
  const allLedgers = state.acmac1.map(a => ({ id: String(a.id), name: a.name, groupId: String(a.parent_id) }));
  
  const getGroupPath = (groupId) => {
    let path = [];
    let current = groups.find(g => g.id === groupId);
    let type = "ASSET";
    while (current) {
      path.unshift(current.name);
      if (current.type) type = current.type;
      current = groups.find(g => g.id === current.parent);
    }
    return { path: path.join(" -> "), type };
  };

  const rows = [];
  
  for (const [ledgerId, totals] of Object.entries(ledgerTotals)) {
    let l = ledgers.find(lx => lx.id === ledgerId) || allLedgers.find(lx => lx.id === ledgerId);
    let ledgerName = l ? l.name : `Unknown (${ledgerId})`;
    let groupInfo = l ? getGroupPath(l.groupId) : { path: "Unknown Group", type: "UNKNOWN" };
    
    let net = groupInfo.type === "ASSET" || groupInfo.type === "EXPENSE" ? totals.debit - totals.credit : totals.credit - totals.debit;
    
    if (Math.abs(totals.debit) > 0 || Math.abs(totals.debit) > 0) {
      rows.push({
        type: groupInfo.type,
        groupPath: groupInfo.path,
        ledgerName,
        debit: totals.debit,
        credit: totals.credit,
        net
      });
    }
  }

  // Sort by Type then Group
  rows.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.groupPath !== b.groupPath) return a.groupPath.localeCompare(b.groupPath);
    return a.ledgerName.localeCompare(b.ledgerName);
  });

  for (const r of rows) {
    csvContent += `"${r.type}","${r.groupPath}","${r.ledgerName}",${r.debit.toFixed(2)},${r.credit.toFixed(2)},${r.net.toFixed(2)}\n`;
  }

  const outputPath = path.join(__dirname, 'Saahil_BS_26_27.csv');
  fs.writeFileSync(outputPath, csvContent);
  console.log(`Exported BS to ${outputPath}`);
}

run().catch(console.error);

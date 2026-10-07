import { readFileSync } from 'fs';
import path from 'path';

const snapshotDir = path.resolve('c:/Users/Admin/Desktop/wealthcore-clean/backups/latest_snapshot');

function loadJson(name: string) {
  try {
    return JSON.parse(readFileSync(path.join(snapshotDir, `${name}.json`), 'utf-8'));
  } catch (e) {
    return [];
  }
}

const portfolios = loadJson('portfolios');
const accPflink = loadJson('acc_pflink');
const acmac1 = loadJson('acmac1');
const vouchersc1 = loadJson('vouchersc1');
const vouchers1 = loadJson('vouchers1');
const transc1 = loadJson('transc1');
const trans1 = loadJson('trans1');
const bs1 = loadJson('bs1');

console.log('--- Portfolios ---');
portfolios.forEach((p: any) => {
  if (p.pfolio_type === 10) {
    console.log(`Account (acid): id=${p.id}, name="${p.investor_name}"`);
  }
});

// Let's find Unnati Shah account
const unnatiAcc = portfolios.find((p: any) => p.pfolio_type === 10 && (p.investor_name || '').toLowerCase().includes('unnati'));
const unnatiAcid = unnatiAcc ? unnatiAcc.id : 61;
console.log(`\nUnnati Account ID = ${unnatiAcid}`);

// Linked portfolios
const linkedPfs = accPflink.filter((l: any) => l.acid === unnatiAcid).map((l: any) => l.pfid);
console.log(`Linked Portfolio IDs for Unnati:`, linkedPfs);

// Let's check Unassigned Broker ledger for Unnati
const unassignedLedger = acmac1.find((a: any) => a.acid === unnatiAcid && a.name.toLowerCase().includes('unassigned'));
console.log('Unassigned Broker Ledger in acmac1:', unassignedLedger);

// Let's check all transactions mentioning unassigned ledger or id 215
const allTrans = [...transc1.map((t: any) => ({ ...t, _src: 'c' })), ...trans1.map((t: any) => ({ ...t, _src: 't' }))];
const unassignedTrans = allTrans.filter((t: any) => t.maid === unassignedLedger?.id || t.maid === 215);
console.log(`\nTransactions for Unassigned Broker (count = ${unassignedTrans.length}):`);
unassignedTrans.forEach((t: any) => {
  console.log(`  vid=${t.vid}, transid=${t.transid}, acid=${t.acid}, dramt=${t.dramt}, cramt=${t.cramt}, dt=${t.dt}, src=${t._src}`);
});

// Let's check all vouchers for these transactions
const allVouchers = [...vouchersc1.map((v: any) => ({ ...v, _src: 'c' })), ...vouchers1.map((v: any) => ({ ...v, _src: 't' }))];
unassignedTrans.forEach((t: any) => {
  const v = allVouchers.find((v: any) => v.vid === t.vid && v._src === t._src);
  console.log(`  Voucher for vid=${t.vid}:`, v);
  const otherLines = allTrans.filter((x: any) => x.vid === t.vid && x._src === t._src);
  console.log(`    All lines of voucher ${t.vid}:`, otherLines);
});

// Let's check why there is a 9.00 difference on Balance Sheet
console.log('\n--- Balance Sheet Calculation for Unnati ---');
const endDate = '2026-03-31';

// Calculate ledger balances for Unnati
const groups = acmac1.filter((a: any) => a.is_group && a.acid === unnatiAcid);
const ledgers = acmac1.filter((a: any) => !a.is_group && a.acid === unnatiAcid);

function getGroupType(gid: number | string): string {
  let cur = groups.find((g: any) => g.id === Number(gid));
  while (cur) {
    const st = cur.special_type_id || 150;
    if ([150, 40, 50, 125].includes(st)) return 'ASSET';
    if ([250, 275, 276].includes(st)) return 'LIABILITY';
    if (st === 280) return 'INCOME';
    if (st === 290) return 'EXPENSE';
    cur = groups.find((g: any) => g.id === cur.parent_id);
  }
  return 'ASSET';
}

let totalAssetSum = 0;
let totalLiabSum = 0;
let totalIncomeSum = 0;
let totalExpenseSum = 0;

ledgers.forEach((l: any) => {
  const gType = getGroupType(l.parent_id);
  const opDb = Number(l.db_bal) || 0;
  const opCr = Number(l.cr_bal) || 0;
  
  // Sum trans
  let dr = opDb;
  let cr = opCr;
  allTrans.filter((t: any) => t.acid === unnatiAcid && t.maid === l.id && (t.dt || '') <= endDate).forEach((t: any) => {
    dr += Number(t.dramt) || 0;
    cr += Number(t.cramt) || 0;
  });

  const bal = gType === 'ASSET' ? (dr - cr) : (cr - dr);
  if (Math.abs(bal) > 0.001) {
    console.log(`[${gType}] ${l.name} (id=${l.id}, parent=${l.parent_id}): dr=${dr.toFixed(2)}, cr=${cr.toFixed(2)} => bal=${bal.toFixed(2)}`);
  }

  if (gType === 'ASSET') totalAssetSum += bal;
  else if (gType === 'LIABILITY') totalLiabSum += bal;
  else if (gType === 'INCOME') totalIncomeSum += bal;
  else if (gType === 'EXPENSE') totalExpenseSum += bal;
});

console.log('\n--- Totals ---');
console.log('Total Assets:', totalAssetSum.toFixed(2));
console.log('Total Liabilities:', totalLiabSum.toFixed(2));
console.log('Total Income:', totalIncomeSum.toFixed(2));
console.log('Total Expense:', totalExpenseSum.toFixed(2));
console.log('Net Profit (Income - Expense):', (totalIncomeSum - totalExpenseSum).toFixed(2));
console.log('Liabilities + Net Profit:', (totalLiabSum + totalIncomeSum - totalExpenseSum).toFixed(2));
console.log('Diff (Assets - (Liabilities + Net Profit)):', (totalAssetSum - (totalLiabSum + totalIncomeSum - totalExpenseSum)).toFixed(2));

// Check ALL transactions for Unnati across all maids to see if Debits == Credits overall
let grandDr = 0;
let grandCr = 0;
ledgers.forEach((l: any) => {
  grandDr += Number(l.db_bal) || 0;
  grandCr += Number(l.cr_bal) || 0;
});
allTrans.filter((t: any) => t.acid === unnatiAcid && (t.dt || '') <= endDate).forEach((t: any) => {
  grandDr += Number(t.dramt) || 0;
  grandCr += Number(t.cramt) || 0;
});
console.log(`\nGrand Total: Dr = ${grandDr.toFixed(2)}, Cr = ${grandCr.toFixed(2)}, Net Difference = ${(grandDr - grandCr).toFixed(2)}`);

// Check Difference in Opening Balances in acmac1
const diffOp = acmac1.filter((a: any) => a.name.toLowerCase().includes('difference in opening'));
console.log('Difference in opening balances rows in acmac1:', diffOp);

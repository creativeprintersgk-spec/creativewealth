import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

import { state, rebuildAllIndexes } from '../src/logic.ts';

Object.assign(state, {
  portfolios: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8')),
  investorGroupMembers: [],
  accPflink: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8')),
  acmac1,
  sam: [],
  assetMaster: [],
  bs1: [],
  sumTable: [],
  vouchersC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8')).map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8')).map((v: any) => ({ ...v, _src: 't' })),
  transC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8')).map((e: any) => ({ ...e, _src: 'c' })),
  trans1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8')).map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function check() {
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');

  // Print all ledgers in Assets with their net (DR - CR)
  console.log("=== ASSET LEDGERS ===");
  const assetLids: any[] = [];
  function scanA(g: any) {
    for (const l of g.ledgers || []) assetLids.push({ ...l, groupName: g.name, groupType: l.groupType });
    for (const c of g.children || []) scanA(c);
  }
  bs.assets.forEach(scanA);

  console.log("=== LIABILITY LEDGERS ===");
  const liabLids: any[] = [];
  function scanL(g: any) {
    for (const l of g.ledgers || []) liabLids.push({ ...l, groupName: g.name, groupType: l.groupType });
    for (const c of g.children || []) scanL(c);
  }
  bs.liabilities.forEach(scanL);

  // Check if any ledger is in BOTH or in NEITHER
  console.log(`Asset ledgers count: ${assetLids.length}`);
  console.log(`Liab ledgers count: ${liabLids.length}`);

  // Calculate Asset sum:
  const assetTotal = assetLids.reduce((s, l) => s + l.balance, 0);
  const liabTotal = liabLids.reduce((s, l) => s + l.balance, 0);
  console.log(`Asset sum: ${assetTotal.toFixed(2)}, Liab sum: ${liabTotal.toFixed(2)}, Diff: ${(assetTotal - liabTotal).toFixed(2)}`);

  // Let's check which ledgers have unexpected groupType
  console.log("\nAsset ledgers with non-ASSET groupType:");
  assetLids.filter(l => l.groupType !== 'ASSET').forEach(l => console.log(`  [${l.id}] ${l.name} (${l.groupName}): groupType=${l.groupType}, bal=${l.balance}`));

  console.log("\nLiab ledgers with non-LIABILITY/INCOME/EXPENSE groupType:");
  liabLids.filter(l => l.groupType === 'ASSET').forEach(l => console.log(`  [${l.id}] ${l.name} (${l.groupName}): groupType=${l.groupType}, bal=${l.balance}`));
}
check().catch(console.error);

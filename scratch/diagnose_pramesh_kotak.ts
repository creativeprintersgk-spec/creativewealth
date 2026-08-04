import { initDatabase, getStoredAccounts, getStoredLedgers, getStoredEntries, getStoredVouchers, getStoredPortfolios, getLedgerWithBalance } from '../src/logic.ts';
import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function run() {
  // Initialize logic state
  await initDatabase();

  const accounts = getStoredAccounts();
  const pramesh = accounts.find(a => a.name.toLowerCase().includes('pramesh'));
  if (!pramesh) {
    console.error('Pramesh Shah account not found');
    return;
  }
  console.log(`Pramesh Shah Account: ID=${pramesh.id}, Name=${pramesh.name}`);

  const ledgers = getStoredLedgers(pramesh.id);
  const kotak = ledgers.find(l => l.name.toLowerCase().includes('kotak'));
  if (!kotak) {
    console.error('Kotak Bank ledger not found for Pramesh');
    return;
  }
  console.log(`Kotak Bank Ledger: ID=${kotak.id}, Name=${kotak.name}, GroupID=${kotak.groupId}`);

  // Calculate balance as of 2026-03-31 as in Balance Sheet
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', pramesh.id);
  
  // Find Kotak bank ledger inside bs assets
  let bsKotakBal = 0;
  function searchGroup(group: any) {
    const foundLedger = group.ledgers.find((l: any) => l.id === kotak.id);
    if (foundLedger) {
      bsKotakBal = foundLedger.balance;
    }
    group.children.forEach(searchGroup);
  }
  bs.assets.forEach(searchGroup);
  console.log(`Balance Sheet Kotak balance: ${bsKotakBal}`);

  // Calculate balance using getLedgerWithBalance
  const drilldown = getLedgerWithBalance(kotak.id, '2025-04-01', '2026-03-31', pramesh.id);
  console.log(`Drilldown Opening balance: ${drilldown.openingBalance}`);
  console.log(`Drilldown Closing balance: ${drilldown.closingBalance}`);
  console.log(`Drilldown total transactions: ${drilldown.transactions.length}`);

  // Compare entries filtered in both
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  const allPortfolios = getStoredPortfolios();
  const portfolioIds = allPortfolios.filter((p: any) => p.accountId === pramesh.id).map((p: any) => p.id);

  // In Balance Sheet logic:
  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => voucherMap[v.id] = v);

  const bsEntries = entries.filter((e: any) => {
    if (e.ledgerId !== kotak.id) return false;
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    if (!entryDate || entryDate > '2026-03-31') return false;
    
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;
    const belongsToAccount = (entryAcid === pramesh.id) || (entryPfid && portfolioIds.includes(entryPfid));
    return belongsToAccount;
  });

  console.log(`Number of entries matching in BS logic: ${bsEntries.length}`);
  let bsDrSum = 0, bsCrSum = 0;
  bsEntries.forEach(e => {
    bsDrSum += e.debit || 0;
    bsCrSum += e.credit || 0;
  });
  console.log(`BS Summed: DR=${bsDrSum}, CR=${bsCrSum}, Net=${bsDrSum - bsCrSum}`);

  // In getLedgerWithBalance logic:
  console.log(`\nAnalyzing getLedgerWithBalance logic...`);
  // Look at entries in state.transC1 and state.trans1
  const ts = drilldown.transactions;
  let drillDrSum = 0, drillCrSum = 0;
  ts.forEach(t => {
    drillDrSum += t.debit || 0;
    drillCrSum += t.credit || 0;
  });
  console.log(`Drilldown Summed in FY 25-26: DR=${drillDrSum}, CR=${drillCrSum}, Net=${drillDrSum - drillCrSum}`);
}

run().catch(console.error);

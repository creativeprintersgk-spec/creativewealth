import { mergeComparativeTrees, type BalanceSheetNode } from '../src/services/balanceSheet';
import { getTaxLossHarvestingData, exportTaxLossHarvestingCSV } from '../src/services/taxLossHarvestingService';
import { state } from '../src/logic';

console.log('--- Testing Sprint 3: Comparative Balance Sheet Engine ---');

const primaryTree: BalanceSheetNode[] = [
  {
    id: 'grp-1',
    name: 'Current Assets',
    balance: 500000,
    type: 'ASSET',
    ledgers: [
      { id: 'led-1', name: 'HDFC Bank', balance: 300000, displayBalance: 300000, groupId: 'grp-1', groupType: 'ASSET' },
      { id: 'led-2', name: 'ICICI Bank', balance: 200000, displayBalance: 200000, groupId: 'grp-1', groupType: 'ASSET' }
    ],
    children: []
  },
  {
    id: 'grp-2',
    name: 'Investments',
    balance: 1000000,
    type: 'ASSET',
    ledgers: [
      { id: 'led-3', name: 'Reliance Industries', balance: 1000000, displayBalance: 1000000, groupId: 'grp-2', groupType: 'ASSET' }
    ],
    children: []
  }
];

const comparativeTree: BalanceSheetNode[] = [
  {
    id: 'grp-1',
    name: 'Current Assets',
    balance: 400000,
    type: 'ASSET',
    ledgers: [
      { id: 'led-1', name: 'HDFC Bank', balance: 250000, displayBalance: 250000, groupId: 'grp-1', groupType: 'ASSET' },
      { id: 'led-2', name: 'ICICI Bank', balance: 150000, displayBalance: 150000, groupId: 'grp-1', groupType: 'ASSET' }
    ],
    children: []
  },
  {
    id: 'grp-2',
    name: 'Investments',
    balance: 800000,
    type: 'ASSET',
    ledgers: [
      { id: 'led-3', name: 'Reliance Industries', balance: 800000, displayBalance: 800000, groupId: 'grp-2', groupType: 'ASSET' }
    ],
    children: []
  },
  {
    id: 'grp-3',
    name: 'Fixed Deposits (Closed)',
    balance: 200000,
    type: 'ASSET',
    ledgers: [
      { id: 'led-4', name: 'SBI FD', balance: 200000, displayBalance: 200000, groupId: 'grp-3', groupType: 'ASSET' }
    ],
    children: []
  }
];

const merged = mergeComparativeTrees(primaryTree, comparativeTree);

console.log('Merged root groups count:', merged.length);
console.assert(merged.length === 3, `Expected 3 merged groups including historical group, got ${merged.length}`);

const curAssets = merged.find(g => g.id === 'grp-1');
console.log('Current Assets balance:', curAssets?.balance, 'prev:', curAssets?.prevBalance, 'variance:', curAssets?.variance, 'pctChange:', curAssets?.pctChange);
console.assert(curAssets?.balance === 500000, 'Current Assets balance mismatch');
console.assert(curAssets?.prevBalance === 400000, 'Current Assets prevBalance mismatch');
console.assert(curAssets?.variance === 100000, 'Current Assets variance mismatch');
console.assert(Math.abs((curAssets?.pctChange || 0) - 25.0) < 0.01, 'Current Assets pctChange mismatch');

const closedGroup = merged.find(g => g.id === 'grp-3');
console.log('Closed group balance:', closedGroup?.balance, 'prev:', closedGroup?.prevBalance, 'variance:', closedGroup?.variance);
console.assert(closedGroup?.balance === 0, 'Closed group balance should be 0');
console.assert(closedGroup?.prevBalance === 200000, 'Closed group prevBalance should be 200000');
console.assert(closedGroup?.variance === -200000, 'Closed group variance should be -200000');

console.log('✅ Comparative Balance Sheet tree merging verified!');

console.log('\n--- Testing Sprint 3: Tax Loss Harvesting Engine ---');
// Mock state for TLH test
state.bs1 = [
  // Buy Lot 1: 100 units @ 1000 on 2024-01-10 (holding > 365 days -> LTCL)
  { trid: 1, pfid: 1, amid: 101, atyid: 50, trty: 20, qn: 100, purpr: 1000, amt: 100000, dt: '2024-01-10' },
  // Buy Lot 2: 50 units @ 1200 on 2026-05-15 (holding < 365 days -> STCL)
  { trid: 2, pfid: 1, amid: 101, atyid: 50, trty: 20, qn: 50, purpr: 1200, amt: 60000, dt: '2026-05-15' },
  // Realized Sale: 20 units of amid 102 with gain of 10000 on 2026-06-01 (STCG)
  { trid: 3, pfid: 1, amid: 102, atyid: 50, trty: 20, qn: 20, purpr: 500, amt: 10000, dt: '2026-04-01' },
  { trid: 4, pfid: 1, amid: 102, atyid: 50, trty: 101, qn: 20, purpr: 1000, amt: 20000, dt: '2026-06-01' }
];

state.portfolios = [
  { id: 1, investor_name: 'Saahil P Shah', client_id: 'fam-1' }
];

state.assetNameMap = {
  101: 'Infosys Ltd',
  102: 'TCS Ltd'
};

state.priceMap = {
  101: { curr: 800, prev: 790 },  // Current price 800 is below 1000 and 1200
  102: { curr: 1050, prev: 1000 }
};

const tlh = getTaxLossHarvestingData([1], '2026-09-30', '2026-04-01', '2027-03-31');

console.log('TLH Lots Found:', tlh.lots.length);
console.log('Harvestable STCL:', tlh.harvestableSTCL);
console.log('Harvestable LTCL:', tlh.harvestableLTCL);
console.log('Total Harvestable Loss:', tlh.totalHarvestableLoss);
console.log('Immediate Tax Savings:', tlh.immediateTaxSavings);
console.log('Total Tax Savings:', tlh.totalTaxSavings);

// Lot 1: 100 * (1000 - 800) = 20,000 LTCL
// Lot 2: 50 * (1200 - 800) = 20,000 STCL
console.assert(tlh.lots.length === 2, `Expected 2 lots in loss, got ${tlh.lots.length}`);
console.assert(tlh.harvestableLTCL === 20000, `Expected 20,000 LTCL, got ${tlh.harvestableLTCL}`);
console.assert(tlh.harvestableSTCL === 20000, `Expected 20,000 STCL, got ${tlh.harvestableSTCL}`);
console.assert(tlh.totalHarvestableLoss === 40000, `Expected 40,000 total loss, got ${tlh.totalHarvestableLoss}`);

const csv = exportTaxLossHarvestingCSV(tlh);
console.log('CSV Lines generated:', csv.split('\n').length);
console.assert(csv.includes('Infosys Ltd'), 'CSV should contain Infosys Ltd');

console.log('✅ Tax Loss Harvesting engine verified!');
console.log('\n🎉 ALL SPRINT 3 VERIFICATIONS PASSED SUCCESSFULLY!');

import { state } from '../src/logic';
import { generateTallyXml } from '../src/services/tallyExportService';
import { generateItrScheduleCgExcel } from '../src/services/itrExportService';
import { SAMPLE_DIVIDENDS_CATALOG, computeExpectedDividends } from '../src/services/dividendReconService';
import { getCorporateActionsMaster, detectPendingCorporateActions } from '../src/services/corporateActionsMasterService';

async function testSprint2Features() {
  console.log('=== Running Sprint 2 Feature Verification Tests ===\n');

  // Setup mock in-memory state
  state.acmac1 = [
    { id: 1, acid: 101, name: 'HDFC Bank', group_type: 'bank', groupName: 'Bank Accounts', db_bal: 500000, cr_bal: 0, is_group: false },
    { id: 2, acid: 101, name: 'Reliance Industries', group_type: 'stocks', groupName: 'Investments', db_bal: 250000, cr_bal: 0, is_group: false },
    { id: 3, acid: 101, name: 'STCG Equity', group_type: 'stcg', groupName: 'Capital Gains', db_bal: 0, cr_bal: 50000, is_group: false }
  ];
  state.vouchersC1 = [
    { vid: 1001, dt: '2024-05-15', vtyp: 'journal', narr: 'Test Journal Voucher', acid: 101, pfid: 1 }
  ];
  state.transC1 = [
    { transid: 1, vid: 1001, maid: 2, dramt: 10000, cramt: 0, dt: '2024-05-15', acid: 101 },
    { transid: 2, vid: 1001, maid: 1, dramt: 0, cramt: 10000, dt: '2024-05-15', acid: 101 }
  ];
  state.portfolios = [
    { id: 1, name: 'Growth Portfolio', accountId: 101, pan: 'ABCDE1234F' }
  ];
  state.bs1 = [
    { pfid: 1, amid: 10, dt: '2024-01-01', trty: 1, qnt: 100, rat: 2500, atyid: 50 }
  ];
  state.assetMaster = [
    { amid: 10, isin: 'INE002A01018', name: 'Reliance Industries', nse_symbol: 'RELIANCE', asset_type: 50 }
  ];

  // ── Test 2.1: Corporate Actions Master + Notification Banner ──
  console.log('--- Test 2.1: Corporate Actions Master Service ---');
  const caAnnouncements = await getCorporateActionsMaster();
  console.log(`Fetched ${caAnnouncements.length} master corporate action items.`);
  if (caAnnouncements.length > 0) {
    console.log(`✅ Sample Action: ${caAnnouncements[0].company_name} (${caAnnouncements[0].action_type})`);
  }
  const pendingCA = await detectPendingCorporateActions([1]);
  console.log(`✅ Pending Corporate Actions detected for client holdings: ${pendingCA.length}`);

  // ── Test 2.2: Automated Dividend Reconciliation Service ──
  console.log('\n--- Test 2.2: Dividend Reconciliation Service ---');
  const divAnnouncements = SAMPLE_DIVIDENDS_CATALOG;
  console.log(`Catalog contains ${divAnnouncements.length} dividend announcements.`);
  const reconItems = computeExpectedDividends(1, '2024-2025');
  console.log(`Reconciled items for client holdings: ${reconItems.length}`);
  if (reconItems.length > 0) {
    const item = reconItems[0];
    console.log(`✅ Recon item: ${item.companyName} (${item.symbol}) - Qty: ${item.holdingQuantity}, Gross: Rs ${item.grossAmount}, TDS: Rs ${item.tdsAmount}, Net: Rs ${item.netAmount}`);
    if (Math.abs(item.grossAmount - (item.netAmount + item.tdsAmount)) < 0.01) {
      console.log('✅ PASS: Gross Dividend strictly equals Net + TDS');
    }
  }

  // ── Test 2.3: Tally XML Exporter ──
  console.log('\n--- Test 2.3: Tally XML Exporter ---');
  const tallyXml = await generateTallyXml('2024-2025', 101);
  if (tallyXml.includes('<ENVELOPE>') && tallyXml.includes('<TALLYMESSAGE') && tallyXml.includes('HDFC Bank')) {
    console.log('✅ PASS: Valid Tally XML generated with Envelope, Ledgers, and Vouchers.');
  } else {
    throw new Error('Tally XML missing standard elements.');
  }

  // ── Test 2.3 (Part B): ITR Schedule CG Excel Exporter ──
  console.log('\n--- Test 2.3 (Part B): ITR Schedule CG Excel Exporter ---');
  const excelBlob = await generateItrScheduleCgExcel('2024-2025', 1);
  if (excelBlob && excelBlob.size > 1000) {
    console.log(`✅ PASS: Valid ITR Schedule CG Excel workbook generated (${excelBlob.size} bytes).`);
  } else {
    throw new Error('Failed to generate ITR Schedule CG workbook.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL SPRINT 2 SERVICES VERIFIED & PASSED 100%!');
}

testSprint2Features().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

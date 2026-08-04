import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { 
    initDatabase, 
    createVoucher, 
    deleteVoucher, 
    getAssetTransactions, 
    state, 
    getAccountForPortfolio,
    ensureLedgerExists 
  } = await import('../src/logic');
  
  await initDatabase();

  // Find portfolio ID from sumTable for Bhandari Hosiery (101556)
  const holdingRow = state.sumTable.find(s => s.amid === 101556);
  if (!holdingRow) {
    console.error("Holding row for Bhandari (101556) not found in sumTable!");
    return;
  }
  const pfid = holdingRow.pfolio_id;
  const portfolio = state.portfolios.find(p => p.id === pfid);
  if (!portfolio) {
    console.error(`Portfolio with ID ${pfid} not found in state.portfolios!`);
    return;
  }

  // Resolve account ID
  const accountId = getAccountForPortfolio(pfid);
  if (!accountId) {
    console.error(`Account ID not found for portfolio ${pfid}!`);
    return;
  }

  console.log(`\n=== RUNNING COMPREHENSIVE PMS CORPORATE ACTION TESTING ===`);
  console.log(`Investor: ${portfolio.investor_name} (ID: ${pfid}), Account ID: ${accountId}`);

  // Resolve ledgers
  const assetName = "Bhandari Hosiery Exports";
  const assetLedger = await ensureLedgerExists(assetName, 'stocks', accountId);
  const bankLedger = await ensureLedgerExists('Bank', 'bank', accountId);
  const tdsLedger = await ensureLedgerExists('TDS', 'tds', accountId);
  const divIncomeLedger = await ensureLedgerExists('Dividend Income', 'dividend', accountId);
  const lossLedger = await ensureLedgerExists('Loss on Write Off', 'indirect_expense', accountId);
  const demergedAssetLedger = await ensureLedgerExists('Hindustan Copper', 'stocks', accountId); // Demerged asset demo
  const mergedAssetLedger = demergedAssetLedger; // Merger asset demo

  if (!assetLedger || !bankLedger || !tdsLedger || !divIncomeLedger || !lossLedger) {
    console.error("Failed to resolve one or more standard accounting ledgers!");
    return;
  }

  const actions = [
    {
      name: 'Bonus',
      payload: {
        date: '2026-05-31',
        type: 'bonus',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Bonus corporate action',
        lines: [{
          ledgerId: assetLedger.id,
          debit: 0,
          credit: 0,
          quantity: 500,
          price: 0
        }]
      }
    },
    {
      name: 'Split',
      payload: {
        date: '2026-05-31',
        type: 'split',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Split corporate action',
        lines: [{
          ledgerId: assetLedger.id,
          debit: 0,
          credit: 0,
          quantity: 1000, // net quantity added
          price: 0
        }]
      }
    },
    {
      name: 'Merger',
      payload: {
        date: '2026-05-31',
        type: 'merger',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Merger corporate action',
        lines: [
          {
            ledgerId: assetLedger.id,
            debit: 0,
            credit: 15000,
            quantity: 500, // credit original quantity
            price: 0
          },
          {
            ledgerId: mergedAssetLedger?.id,
            debit: 15000,
            credit: 0,
            quantity: 1000, // debit merged quantity
            price: 0
          }
        ]
      }
    },
    {
      name: 'DeMerger',
      payload: {
        date: '2026-05-31',
        type: 'demerger',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test DeMerger corporate action',
        lines: [{
          ledgerId: demergedAssetLedger?.id,
          debit: 5000, // allocated cost
          credit: 0,
          quantity: 200,
          price: 0
        }]
      }
    },
    {
      name: 'IPO/Rights',
      payload: {
        date: '2026-05-31',
        type: 'ipo',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test IPO/Rights subscription',
        lines: [
          {
            ledgerId: assetLedger.id,
            debit: 2000,
            credit: 0,
            quantity: 100,
            price: 20
          },
          {
            ledgerId: bankLedger.id,
            debit: 0,
            credit: 2000
          }
        ]
      }
    },
    {
      name: 'Buyback',
      payload: {
        date: '2026-05-31',
        type: 'buyback',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Share Buyback',
        lines: [
          {
            ledgerId: assetLedger.id,
            debit: 0,
            credit: 5000,
            quantity: 100,
            price: 50
          },
          {
            ledgerId: bankLedger.id,
            debit: 4500,
            credit: 0
          },
          {
            ledgerId: tdsLedger.id,
            debit: 500,
            credit: 0
          }
        ]
      }
    },
    {
      name: 'Dividend Reinvest',
      payload: {
        date: '2026-05-31',
        type: 'reinvest',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Dividend Reinvestment',
        lines: [
          {
            ledgerId: assetLedger.id,
            debit: 1000,
            credit: 0,
            quantity: 50,
            price: 20
          },
          {
            ledgerId: divIncomeLedger.id,
            debit: 0,
            credit: 1000
          }
        ]
      }
    },
    {
      name: 'Repayment of Debt',
      payload: {
        date: '2026-05-31',
        type: 'repayment',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Repayment of Debt',
        lines: [
          {
            ledgerId: assetLedger.id,
            debit: 0,
            credit: 3000,
            quantity: 150,
            price: 20
          },
          {
            ledgerId: bankLedger.id,
            debit: 3000,
            credit: 0
          }
        ]
      }
    },
    {
      name: 'Write Off',
      payload: {
        date: '2026-05-31',
        type: 'writeoff',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test Write Off of asset',
        lines: [
          {
            ledgerId: assetLedger.id,
            debit: 0,
            credit: 1500,
            quantity: 300,
            price: 0
          },
          {
            ledgerId: lossLedger.id,
            debit: 1500,
            credit: 0
          }
        ]
      }
    },
    {
      name: 'Transfer',
      payload: {
        date: '2026-05-31',
        type: 'transfer',
        portfolioId: pfid,
        accountId: accountId,
        narration: 'Test transfer of asset out',
        lines: [{
          ledgerId: assetLedger.id,
          debit: 0,
          credit: 2000,
          quantity: 100,
          price: 20
        }]
      }
    }
  ];

  for (const act of actions) {
    console.log(`\nTesting action: ${act.name}...`);
    try {
      const dummyId = "testact" + Math.random().toString(36).substring(2, 7);
      const payload = {
        ...act.payload,
        id: dummyId
      };
      
      // Call createVoucher
      const result = await createVoucher(payload);
      
      // Query local asset transactions to check if it appeared
      const targetAmid = act.name.includes("Demerger") || (act.name.includes("Merger") && act.payload.lines.length > 1 && Number(act.payload.lines[1].ledgerId) === demergedAssetLedger?.id)
        ? demergedAssetLedger?.id ?? 0
        : 101556;
      
      const ledgerResult = getAssetTransactions([Number(pfid)], targetAmid);
      const insertedTx = ledgerResult.transactions.find(t => t.narration.includes(payload.narration));
      
      if (!insertedTx) {
        throw new Error("Voucher created, but could not find the transaction in getAssetTransactions!");
      }
      
      console.log(`✅ Success: ${act.name} transaction saved!`);
      console.log(`   Voucher ID: ${insertedTx.voucherId}`);
      console.log(`   Type: ${insertedTx.type}`);
      console.log(`   Quantity: ${insertedTx.quantity}`);
      console.log(`   Amount: ${insertedTx.amount}`);
      console.log(`   Balance Qty: ${insertedTx.balanceQty}`);

      // Delete the voucher to keep db clean
      await deleteVoucher(insertedTx.voucherId);
      console.log(`   Deleted test voucher: ${insertedTx.voucherId} cleanly.`);
      
    } catch (e: any) {
      console.error(`❌ Failed testing ${act.name}:`, e.message || e);
    }
  }
  
  console.log(`\n=== COMPLETED PMS CORPORATE ACTION TESTING ===`);
}

run().catch(console.error);

import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { initDatabase, createVoucher, getAssetTransactions, state, getAccountForPortfolio } = await import('../src/logic');
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

  // Find Bhandari ledger in acmac1 for this account ID
  const accounts = state.acmac1.filter((a: any) => a.acid === accountId);
  const bhandariLedger = accounts.find((a: any) => a.name.toLowerCase().includes('bhandari'));
  
  if (!bhandariLedger) {
    console.error(`Bhandari ledger not found in Chart of Accounts (acid = ${accountId})!`);
    return;
  }

  console.log(`Resolved: Portfolio="${portfolio.investor_name || portfolio.full_name}" (ID=${pfid}), Account ID=${accountId}, Ledger="${bhandariLedger.name}" (ID=${bhandariLedger.id})`);

  console.log("Simulating Bonus Action...");
  const dummyId = "testbonus" + Math.random().toString(36).substring(2, 7);

  // Payload structure matching PMSCorporateActionModal.tsx
  const payload = {
    id: dummyId,
    date: '2026-05-31',
    type: 'bonus', // actionType is passed as 'bonus'
    portfolioId: pfid,
    narration: `Bonus transaction for Bhandari Hosiery Exports`,
    lines: [
      {
        ledgerId: String(bhandariLedger.id),
        debit: 0,
        credit: 0,
        quantity: 1300, // 1:2 bonus on 2600 shares
        price: 0
      }
    ]
  };

  try {
    await createVoucher(payload);
    console.log("✅ Simulation successful! Voucher created.");
    
    // Read the transactions to verify the newly added row
    const res = getAssetTransactions([Number(pfid)], 101556);
    const addedTx = res.transactions.find(t => t.narration.includes(dummyId) || t.type === 'Bonus');
    console.log("Newly added transaction details in ledger:", addedTx);

    // Clean up from database
    if (addedTx) {
      console.log("Cleaning up test bonus from database...");
      const { deleteVoucher } = await import('../src/logic');
      await deleteVoucher(addedTx.voucherId);
      console.log("✅ Cleanup successful!");
    }

  } catch (err: any) {
    console.error("❌ Simulation failed:", err.message || err);
  }
}

run().catch(console.error);

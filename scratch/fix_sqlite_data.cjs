const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db';
console.log('Opening SQLite database at:', dbPath);

const db = new Database(dbPath);

try {
  // We wrap updates in a transaction for safety
  const runUpdates = db.transaction(() => {
    // 1. Update Unnati (acid = 29) OLD Shares (ID = 27)
    // Set opening balance DBBAL = 639922.54 and CRBAL = 0
    const infoAcmac27 = db.prepare("UPDATE ACMAC1 SET DB_BAL = 639922.54, CR_BAL = 0 WHERE ID = 27 AND ACID = 29").run();
    console.log('Updated ACMAC1 ID 27 (Unnati OLD Shares):', infoAcmac27.changes, 'rows modified');

    // 2. Update Pramesh (acid = 30) OLD Shares (ID = 66)
    // Set opening balance DBBAL = 335189.68 and CRBAL = 0
    const infoAcmac66 = db.prepare("UPDATE ACMAC1 SET DB_BAL = 335189.68, CR_BAL = 0 WHERE ID = 66 AND ACID = 30").run();
    console.log('Updated ACMAC1 ID 66 (Pramesh OLD Shares):', infoAcmac66.changes, 'rows modified');

    // 3. Set Difference in Opening Balances (ID = 240) to 0 for both Unnati and Pramesh
    const infoDiff29 = db.prepare("UPDATE ACMAC1 SET DB_BAL = 0 WHERE ID = 240 AND ACID = 29").run();
    console.log('Updated ACMAC1 ID 240 (Unnati Difference in Opening Balances):', infoDiff29.changes, 'rows modified');

    const infoDiff30 = db.prepare("UPDATE ACMAC1 SET DB_BAL = 0 WHERE ID = 240 AND ACID = 30").run();
    console.log('Updated ACMAC1 ID 240 (Pramesh Difference in Opening Balances):', infoDiff30.changes, 'rows modified');

    // 4. Update the opening balance transactions (VID = 0) in Trans1
    const infoTrans27 = db.prepare("UPDATE Trans1 SET DRAMT = 639922.54 WHERE VID = 0 AND MAID = 27 AND ACID = 29").run();
    console.log('Updated Trans1 VID 0 MAID 27 (Unnati opening txn):', infoTrans27.changes, 'rows modified');

    const infoTrans66 = db.prepare("UPDATE Trans1 SET DRAMT = 335189.68 WHERE VID = 0 AND MAID = 66 AND ACID = 30").run();
    console.log('Updated Trans1 VID 0 MAID 66 (Pramesh opening txn):', infoTrans66.changes, 'rows modified');

    // 5. Delete double entry credit transactions (VID in 10043, 10426, 10427)
    const infoTransDel = db.prepare("DELETE FROM Trans1 WHERE VID IN (10043, 10426, 10427)").run();
    console.log('Deleted transactions for VIDs 10043, 10426, 10427:', infoTransDel.changes, 'rows deleted');

    // 6. Delete vouchers (VID in 10043, 10426, 10427)
    const infoVouchDel = db.prepare("DELETE FROM Vouchers1 WHERE VID IN (10043, 10426, 10427)").run();
    console.log('Deleted vouchers for VIDs 10043, 10426, 10427:', infoVouchDel.changes, 'rows deleted');
  });

  runUpdates();
  console.log('✅ SQLite database successfully updated.');
} catch (err) {
  console.error('❌ Error during transaction execution:', err);
} finally {
  db.close();
}

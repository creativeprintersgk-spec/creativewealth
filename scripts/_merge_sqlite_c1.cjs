const Database = require("better-sqlite3");

const sourceDb = new Database("C:/Users/Admin/Desktop/contract notes/mprTempBackupMPrAPPv10.db", { readonly: true });
const targetDb = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db");

// 1. Copy TransC1
console.log("Creating TransC1 in target DB...");
targetDb.exec(`
  CREATE TABLE IF NOT EXISTS "TransC1" (
    "TRANSID" INTEGER, "VID" INTEGER, "VTYP" INTEGER, "DT" TEXT,
    "MAID" INTEGER, "EXTID" INTEGER, "CRAMT" REAL, "DRAMT" REAL,
    "SpecialAccount" INTEGER, "Narr" TEXT, "ACID" INTEGER
  )
`);
targetDb.exec('DELETE FROM "TransC1"');
const tc1Rows = sourceDb.prepare('SELECT * FROM "TransC1"').all();
const insTc1 = targetDb.prepare(`
  INSERT INTO "TransC1" (TRANSID, VID, VTYP, DT, MAID, EXTID, CRAMT, DRAMT, SpecialAccount, Narr, ACID)
  VALUES (@TRANSID, @VID, @VTYP, @DT, @MAID, @EXTID, @CRAMT, @DRAMT, @SpecialAccount, @Narr, @ACID)
`);
const insertManyTc1 = targetDb.transaction((rows) => {
  for (const r of rows) insTc1.run(r);
});
insertManyTc1(tc1Rows);
console.log(`TransC1 copied: ${tc1Rows.length} rows.`);

// 2. Copy VouchersC1
console.log("Creating VouchersC1 in target DB...");
targetDb.exec(`
  CREATE TABLE IF NOT EXISTS "VouchersC1" (
    "VID" INTEGER, "VTYP" INTEGER, "DT" TEXT, "NARR" TEXT,
    "PMS_TransID" INTEGER, "CNID" INTEGER, "ACCTLIST" TEXT, "EXTID_SOURCE" INTEGER,
    "PFID" INTEGER, "AType" INTEGER, "SID" INTEGER, "IMP_REC_ID" INTEGER,
    "CHQNO" TEXT, "ACID" INTEGER
  )
`);
targetDb.exec('DELETE FROM "VouchersC1"');
const vc1Rows = sourceDb.prepare('SELECT * FROM "VouchersC1"').all();
const insVc1 = targetDb.prepare(`
  INSERT INTO "VouchersC1" (VID, VTYP, DT, NARR, PMS_TransID, CNID, ACCTLIST, EXTID_SOURCE, PFID, AType, SID, IMP_REC_ID, CHQNO, ACID)
  VALUES (@VID, @VTYP, @DT, @NARR, @PMS_TransID, @CNID, @ACCTLIST, @EXTID_SOURCE, @PFID, @AType, @SID, @IMP_REC_ID, @CHQNO, @ACID)
`);
const insertManyVc1 = targetDb.transaction((rows) => {
  for (const r of rows) insVc1.run(r);
});
insertManyVc1(vc1Rows);
console.log(`VouchersC1 copied: ${vc1Rows.length} rows.`);

// 3. Copy ACMAC1
console.log("Creating ACMAC1 in target DB...");
targetDb.exec(`
  CREATE TABLE IF NOT EXISTS "ACMAC1" (
    "ID" INTEGER, "EXTID" INTEGER, "PARENT_ID" INTEGER, "PARENT_EXTID" INTEGER,
    "IS_GROUP" INTEGER, "NAME" TEXT, "DISP_SEQNO" INTEGER, "Descr" TEXT,
    "Flags" TEXT, "ACID" INTEGER, "CLID" INTEGER, "IsItLedger" INTEGER,
    "SpecialTypeID" INTEGER, "CR_BAL" REAL, "DB_BAL" REAL, "TreeNode" TEXT,
    "Addr" TEXT, "PAN" TEXT, "ADDINFO" TEXT
  )
`);
targetDb.exec('DELETE FROM "ACMAC1"');
const acmac1Rows = sourceDb.prepare('SELECT * FROM "ACMAC1"').all();
const insAcmac1 = targetDb.prepare(`
  INSERT INTO "ACMAC1" (ID, EXTID, PARENT_ID, PARENT_EXTID, IS_GROUP, NAME, DISP_SEQNO, Descr, Flags, ACID, CLID, IsItLedger, SpecialTypeID, CR_BAL, DB_BAL, TreeNode, Addr, PAN, ADDINFO)
  VALUES (@ID, @EXTID, @PARENT_ID, @PARENT_EXTID, @IS_GROUP, @NAME, @DISP_SEQNO, @Descr, @Flags, @ACID, @CLID, @IsItLedger, @SpecialTypeID, @CR_BAL, @DB_BAL, @TreeNode, @Addr, @PAN, @ADDINFO)
`);
const insertManyAcmac1 = targetDb.transaction((rows) => {
  for (const r of rows) insAcmac1.run(r);
});
insertManyAcmac1(acmac1Rows);
console.log(`ACMAC1 copied: ${acmac1Rows.length} rows.`);

console.log("=== MERGE COMPLETE ===");

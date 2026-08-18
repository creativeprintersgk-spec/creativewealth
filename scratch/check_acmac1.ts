import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function run() {
  const db = await open({
    filename: 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db',
    driver: sqlite3.Database
  });
  const rows = await db.all("SELECT * FROM ACMAC1 LIMIT 1");
  console.log(rows);
}
run();

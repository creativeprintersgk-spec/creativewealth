import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function run() {
  const db = await open({
    filename: 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db',
    driver: sqlite3.Database
  });
  const rows = await db.all("PRAGMA table_info(Portfolios)");
  console.log(rows);
  const data = await db.all("SELECT * FROM Portfolios LIMIT 1");
  console.log(data);
}
run();

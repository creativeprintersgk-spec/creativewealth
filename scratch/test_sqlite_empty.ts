import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function run() {
  const db = await open({
    filename: 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db',
    driver: sqlite3.Database
  });
  const data = await db.all("SELECT * FROM Portfolios WHERE InvestorName = '' OR InvestorName IS NULL");
  console.log('Empty investor names:', data.length);
}
run();

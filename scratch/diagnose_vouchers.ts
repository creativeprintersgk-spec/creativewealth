import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function run() {
  const db = await open({
    filename: 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db',
    driver: sqlite3.Database
  });
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table';");
  console.log(tables);
  await db.close();
}
run();

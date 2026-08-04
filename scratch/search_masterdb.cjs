const Database = require('better-sqlite3');
const dbs = [
  'MPrMasterDbBonds.db',
  'MPrMasterDbAMFI.db',
  'MPrMasterDbBSE.db',
  'MPrMasterDbFAO.db',
  'MPrMasterDbForex.db'
];
const idsToFind = [440788, 442434, 440767, 440776, 440801, 440889, 427087, 426928, 426939];

for (const dbName of dbs) {
  try {
    const db = new Database(`C:/Users/Admin/Desktop/MasterDb/${dbName}`);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    for (const t of tables) {
      if (t.name === 'sqlite_stat1' || t.name === 'sqlite_sequence') continue;
      try {
        const cols = db.prepare(`PRAGMA table_info(${t.name})`).all().map(c => c.name);
        for (const c of cols) {
          if (c.toLowerCase().includes('id') || c.toLowerCase().includes('amid') || c.toLowerCase() === 'amfi') {
            for (const id of idsToFind) {
              const res = db.prepare(`SELECT * FROM ${t.name} WHERE ${c} = ?`).get(id);
              if (res) console.log(`Found ${id} in ${dbName} -> ${t.name}:`, res);
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {
    console.error(`Error with ${dbName}:`, e.message);
  }
}

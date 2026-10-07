const { execSync } = require("child_process");
const fs = require("fs");
const Database = require("better-sqlite3");

const buf = execSync("git show 8a0cdd8:scratch/latest_mpr_backup/mprTempBackupMPrAPPv10.db", { maxBuffer: 50 * 1024 * 1024 });
fs.writeFileSync("scripts/_old_mprofit_clean.db", buf);

const db = new Database("scripts/_old_mprofit_clean.db", { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables in old db:", tables.map(t => t.name).join(", "));

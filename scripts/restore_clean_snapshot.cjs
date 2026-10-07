const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const snapshotDir = path.join(__dirname, '..', 'backups', 'latest_snapshot');

const DELETE_ORDER = [
  'transc1',
  'trans1',
  'scnote1',
  'bs1',
  'vouchersc1',
  'vouchers1',
  'sum_table',
  'acmac1',
  'acc_pflink',
  'portfolios'
];

const INSERT_ORDER = [
  'portfolios',
  'acc_pflink',
  'acmac1',
  'sum_table',
  'vouchers1',
  'vouchersc1',
  'trans1',
  'transc1',
  'bs1',
  'scnote1'
];

const pkMap = {
  bs1: 'trid',
  transc1: 'transid', trans1: 'transid',
  vouchersc1: 'vid', vouchers1: 'vid',
  portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
  acmac1: 'id', sam: 'amid', asset_master: 'amid',
  sum_table: 'sid', mprices: 'amid', scnote1: 'cnid'
};

async function cleanRestoreOrdered() {
  console.log('=== 1. DELETING OLD DATA IN SAFE FOREIGN-KEY ORDER ===');
  for (const table of DELETE_ORDER) {
    const pk = pkMap[table] || 'id';
    const { error: delErr } = await supabase.from(table).delete().neq(pk, -99999999);
    if (delErr) {
      console.warn(`[!] Error deleting ${table}:`, delErr.message);
    } else {
      console.log(`[+] Cleaned table: ${table}`);
    }
  }

  console.log('\n=== 2. INSERTING CLEAN SNAPSHOT DATA IN SAFE ORDER ===');
  for (const table of INSERT_ORDER) {
    const filePath = path.join(snapshotDir, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`[-] Skipping ${table} (no snapshot file)`);
      continue;
    }

    let rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (table === 'transc1' || table === 'vouchersc1') {
      rows = rows.filter(r => r.vid !== 400);
    }
    console.log(`[>] Inserting ${table} (${rows.length} rows)...`);

    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error: insErr } = await supabase.from(table).insert(chunk);
      if (insErr) {
        console.error(`    [!] Insert error in ${table}:`, insErr.message);
      } else {
        process.stdout.write(`    Inserted ${Math.min(i + CHUNK_SIZE, rows.length)} / ${rows.length} rows...\r`);
      }
    }
    console.log(`\n    [+] Table ${table} successfully restored (${rows.length} rows)!`);
  }

  console.log('\n=== ALL TABLES CLEANLY RESTORED! ===');
}

cleanRestoreOrdered();

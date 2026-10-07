require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const SQLITE_FILE = "C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db";
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const HEADER_MAP = {
  "ID": "id",
  "PARENTID": "parent_id",
  "PARENT_ID": "parent_id",
  "ISGROUP": "is_group",
  "IS_GROUP": "is_group",
  "NAME": "name",
  "DISPSEQNO": "disp_seqno",
  "DISP_SEQNO": "disp_seqno",
  "DESCR": "descr",
  "FLAGS": "flags",
  "ACID": "acid",
  "CLID": "clid",
  "ISITLEDGER": "is_it_ledger",
  "SPECIALTYPEID": "special_type_id",
  "CRBAL": "cr_bal",
  "DBBAL": "db_bal",
  "CR_BAL": "cr_bal",
  "DB_BAL": "db_bal",
  "TREENODE": "tree_node",
  "ADDR": "addr",
  "PAN": "pan",
  "ADDINFO": "addinfo"
};

async function syncAcma() {
  const db = new Database(SQLITE_FILE, { readonly: true });
  const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  const acmaTables = allTables.filter(t => /^ACMA[0-9C]*$/i.test(t));
  console.log('Found ACMA tables in SQLite:', acmaTables);

  const seenIds = new Set();
  const allRows = [];

  for (const tab of acmaTables) {
    const rawRows = db.prepare(`SELECT * FROM "${tab}"`).all();
    console.log(`Table ${tab}: ${rawRows.length} rows`);
    for (const r of rawRows) {
      if (seenIds.has(r.ID)) continue;
      seenIds.add(r.ID);

      const obj = {};
      for (const [k, v] of Object.entries(r)) {
        const mapped = HEADER_MAP[k.toUpperCase()];
        if (mapped) {
          if (mapped === 'is_group') {
            obj[mapped] = v === 1 || v === '1' || v === true;
          } else if (['id', 'parent_id', 'disp_seqno', 'acid', 'clid', 'special_type_id', 'cr_bal', 'db_bal'].includes(mapped)) {
            const num = parseFloat(v);
            obj[mapped] = isNaN(num) ? 0 : num;
          } else {
            obj[mapped] = v !== null && v !== undefined ? String(v) : null;
          }
        }
      }
      allRows.push(obj);
    }
  }

  console.log(`Total unique Chart of Accounts rows to insert: ${allRows.length}`);
  await supabase.from('acmac1').delete().neq('id', -999999);

  for (let i = 0; i < allRows.length; i += 500) {
    const chunk = allRows.slice(i, i + 500);
    const { error } = await supabase.from('acmac1').insert(chunk);
    if (error) {
      console.error('Error inserting into acmac1:', error);
    } else {
      console.log(`Inserted ${Math.min(i + 500, allRows.length)} / ${allRows.length}`);
    }
  }

  console.log('✅ Chart of Accounts sync complete!');
}

syncAcma().catch(console.error);

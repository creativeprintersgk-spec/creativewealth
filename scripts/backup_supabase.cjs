/**
 * WealthCore — Supabase Backup Script
 * =====================================
 * Downloads ALL data from Supabase and saves it to a local .json backup file.
 * Run:  node scripts/backup_supabase.cjs
 * Output: backups/wealthcore_backup_YYYY-MM-DD_HH-MM-SS.json
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// All tables to back up (in dependency order)
const TABLES = [
  'portfolios',
  'investor_group_members',
  'acc_pflink',
  'acmac1',
  'sam',
  'bs1',
  'sum_table',
  'vouchersc1',
  'vouchers1',
  'transc1',
  'trans1',
  'mprices',
  'scnote1',
  'asset_master',
];

// PK for each table (used for pagination)
const TABLE_PK = {
  portfolios: 'id',
  investor_group_members: 'id',
  acc_pflink: 'pfid',
  acmac1: 'id',
  sam: 'amid',
  bs1: 'trid',
  sum_table: 'trid',
  vouchersc1: 'vid',
  vouchers1: 'vid',
  transc1: 'transid',
  trans1: 'transid',
  mprices: 'row_id',
  scnote1: 'id',
  asset_master: 'amid',
};

const PAGE_SIZE = 1000;

async function fetchAll(table) {
  const pk = TABLE_PK[table] || 'id';
  let allRows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
      .order(pk, { ascending: true });

    if (error) {
      // Table might not exist — skip gracefully
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.log(`  ⚠️  Table '${table}' not found, skipping.`);
        return [];
      }
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    process.stdout.write(`\r  Fetched ${allRows.length} rows from ${table}...`);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

async function run() {
  // Create backups directory
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Timestamp for filename
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const filename = `wealthcore_backup_${ts}.json`;
  const filepath = path.join(backupsDir, filename);

  console.log('🔄 WealthCore Supabase Backup');
  console.log('================================');
  console.log(`Timestamp : ${now.toLocaleString()}`);
  console.log(`Output    : ${filepath}`);
  console.log('');

  const backup = {
    version: 2,
    created_at: now.toISOString(),
    supabase_url: supabaseUrl,
    tables: {}
  };

  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`📥 Backing up '${table}'...`);
    try {
      const rows = await fetchAll(table);
      backup.tables[table] = rows;
      totalRows += rows.length;
      console.log(`\r✅ ${table.padEnd(25)} — ${rows.length} rows`);
    } catch (err) {
      console.log(`\r❌ ${table.padEnd(25)} — ERROR: ${err.message}`);
      backup.tables[table] = [];
    }
  }

  // Write to file
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');

  const fileSizeKB = (fs.statSync(filepath).size / 1024).toFixed(1);
  console.log('');
  console.log('================================');
  console.log(`✅ Backup complete!`);
  console.log(`   Total rows : ${totalRows.toLocaleString()}`);
  console.log(`   File size  : ${fileSizeKB} KB`);
  console.log(`   Saved to   : ${filepath}`);
  console.log('');
  console.log('To restore this backup later, run:');
  console.log(`  node scripts/restore_supabase.cjs backups/${filename}`);
}

run().catch(err => {
  console.error('\n❌ Backup failed:', err.message);
  process.exit(1);
});

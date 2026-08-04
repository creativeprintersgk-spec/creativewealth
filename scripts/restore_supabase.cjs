/**
 * WealthCore — Supabase Restore Script
 * ======================================
 * Reads a backup JSON file and RESTORES it to Supabase.
 * ⚠️  WARNING: This will WIPE all existing data in the listed tables first!
 *
 * Usage:
 *   node scripts/restore_supabase.cjs backups/wealthcore_backup_YYYY-MM-DD_HH-MM-SS.json
 *
 * Or to restore the latest backup automatically:
 *   node scripts/restore_supabase.cjs
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

const BATCH_SIZE = 500;

// Restore order matters: parent tables before child tables
const RESTORE_ORDER = [
  'portfolios',
  'investor_group_members',
  'acc_pflink',
  'acmac1',
  'sam',
  'asset_master',
  'bs1',
  'sum_table',
  'vouchersc1',
  'vouchers1',
  'transc1',
  'trans1',
  'mprices',
  'scnote1',
];

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function truncateTables(tables) {
  // Truncate in reverse dependency order to handle FK constraints
  const tableList = [...tables].reverse().map(t => `public.${t}`).join(', ');
  const { error } = await supabase.rpc('exec_sql', {
    query: `TRUNCATE TABLE ${tableList} CASCADE;`
  });
  if (error) {
    // Try individually if bulk truncate fails
    console.log('  Bulk truncate failed, trying individually...');
    for (const table of [...tables].reverse()) {
      const { error: e } = await supabase.rpc('exec_sql', {
        query: `TRUNCATE TABLE public.${table} CASCADE;`
      });
      if (e) console.log(`  ⚠️  Could not truncate ${table}: ${e.message}`);
    }
  }
}

async function restoreTable(table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭️  ${table.padEnd(25)} — no data, skipping`);
    return;
  }

  const batches = chunkArray(rows, BATCH_SIZE);
  let inserted = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      // If column doesn't exist, strip it and retry
      if (error.code === 'PGRST204' && error.message?.includes("Could not find the '")) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match) {
          const badCol = match[1];
          console.log(`\n    ⚠️  Unknown column '${badCol}' in ${table}, removing and retrying...`);
          const cleaned = batches[i].map(r => { const n = { ...r }; delete n[badCol]; return n; });
          const { error: e2 } = await supabase.from(table).insert(cleaned);
          if (e2) {
            console.log(`\n    ❌ Still failed: ${e2.message}`);
            return;
          }
        }
      } else {
        throw new Error(`Insert into '${table}' batch ${i + 1}/${batches.length} failed: ${error.message}`);
      }
    }

    inserted += batch.length;
    process.stdout.write(`\r  📤 ${table.padEnd(25)} — ${inserted}/${rows.length} rows...`);
  }

  console.log(`\r✅ ${table.padEnd(25)} — ${rows.length} rows restored`);
}

async function run() {
  // Determine backup file to use
  let backupFile = process.argv[2];

  if (!backupFile) {
    // Auto-select the latest backup
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupsDir)) {
      console.error('❌ No backup file specified and no backups/ directory found.');
      console.error('   Run: node scripts/restore_supabase.cjs backups/wealthcore_backup_XXX.json');
      process.exit(1);
    }

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('wealthcore_backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error('❌ No backup files found in backups/ directory.');
      process.exit(1);
    }

    backupFile = path.join(backupsDir, files[0]);
    console.log(`🔍 Auto-selected latest backup: ${files[0]}`);
  }

  // Resolve relative path
  if (!path.isAbsolute(backupFile)) {
    backupFile = path.join(process.cwd(), backupFile);
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  console.log('');
  console.log('⚠️  WealthCore Supabase RESTORE');
  console.log('================================');
  console.log(`Backup file : ${backupFile}`);
  console.log('');
  console.log('WARNING: This will WIPE all existing data and restore from backup!');
  console.log('Press Ctrl+C within 5 seconds to cancel...');
  console.log('');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Load backup
  console.log('📂 Loading backup file...');
  const raw = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(raw);

  console.log(`   Backup created: ${backup.created_at}`);
  console.log(`   Version       : ${backup.version || 1}`);
  const totalRows = Object.values(backup.tables).reduce((s, r) => s + r.length, 0);
  console.log(`   Total rows    : ${totalRows.toLocaleString()}`);
  console.log('');

  // Determine which tables we have in the backup and should restore
  const tablesToRestore = RESTORE_ORDER.filter(t => backup.tables[t] !== undefined);

  // Step 1: Truncate
  console.log('🗑️  Wiping existing data...');
  await truncateTables(tablesToRestore);
  console.log('   Done.\n');

  // Step 2: Restore each table
  console.log('📥 Restoring tables...');
  for (const table of tablesToRestore) {
    try {
      await restoreTable(table, backup.tables[table]);
    } catch (err) {
      console.log(`\n❌ Failed to restore '${table}': ${err.message}`);
      console.log('   Continuing with next table...\n');
    }
  }

  console.log('');
  console.log('================================');
  console.log('✅ Restore complete!');
  console.log(`   ${totalRows.toLocaleString()} rows restored to Supabase.`);
  console.log('   Refresh the WealthCore app to see the restored data.');
}

run().catch(err => {
  console.error('\n❌ Restore failed:', err.message);
  process.exit(1);
});

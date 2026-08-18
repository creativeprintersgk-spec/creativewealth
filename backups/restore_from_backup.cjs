const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
let supaUrl = '';
let supaKey = '';
envFile.split('\n').forEach(l => {
  if (l.startsWith('VITE_SUPABASE_URL=')) supaUrl = l.split('=')[1].trim();
  if (l.startsWith('VITE_SUPABASE_ANON_KEY=')) supaKey = l.split('=')[1].trim();
});

if (!supaUrl || !supaKey) {
  console.error('Supabase URL or Key not found in .env');
  process.exit(1);
}

const supabase = createClient(supaUrl, supaKey);

const snapshotDir = process.argv[2] 
  ? path.resolve(process.argv[2]) 
  : path.join(__dirname, 'latest_snapshot');

if (!fs.existsSync(snapshotDir)) {
  console.error('Snapshot directory not found:', snapshotDir);
  process.exit(1);
}

console.log('=== STARTING SUPABASE RESTORE FROM SNAPSHOT ===');
console.log('Snapshot Location:', snapshotDir);

const TABLES_ORDER = [
  'acc_pflink',
  'portfolios',
  'acmac1',
  'asset_master',
  'scnote1',
  'bs1',
  'sum_table',
  'vouchers1',
  'vouchersc1',
  'trans1',
  'transc1'
];

async function restoreTable(table) {
  const filePath = path.join(snapshotDir, `${table}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`[-] Skipping ${table} (file not in snapshot)`);
    return;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`\n[>] Restoring ${table} (${rows.length} rows)...`);

  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error: insError } = await supabase.from(table).upsert(chunk);
    if (insError) {
      console.error(`    [!] Error inserting chunk into ${table}:`, insError.message);
    } else {
      process.stdout.write(`    Inserted ${Math.min(i + CHUNK_SIZE, rows.length)} / ${rows.length} rows...\r`);
    }
  }
  console.log(`\n    [+] Table ${table} successfully restored!`);
}

async function run() {
  for (const t of TABLES_ORDER) {
    await restoreTable(t);
  }
  console.log('\n=== ALL TABLES RESTORED SUCCESSFULLY! ===');
}

run();

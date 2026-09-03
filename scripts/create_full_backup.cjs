const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const JSZip = require('jszip');

// 1. Read Supabase configuration from .env
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
let supaUrl = '';
let supaKey = '';
envFile.split('\n').forEach(l => {
  if (l.startsWith('VITE_SUPABASE_URL=')) supaUrl = l.split('=')[1].trim();
  if (l.startsWith('VITE_SUPABASE_ANON_KEY=')) supaKey = l.split('=')[1].trim();
});

const todayStr = '2026-09-03';
const backupDirName = `snapshot_${todayStr}`;
const backupDir = path.join(__dirname, '..', 'backups', backupDirName);
const latestDir = path.join(__dirname, '..', 'backups', 'latest_snapshot');

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
if (!fs.existsSync(latestDir)) fs.mkdirSync(latestDir, { recursive: true });

const TABLES = [
  { name: 'portfolios', pk: 'id' },
  { name: 'acc_pflink', pk: 'pfid' },
  { name: 'acmac1', pk: 'id' },
  { name: 'sam', pk: 'amid' },
  { name: 'asset_master', pk: 'amid' },
  { name: 'bs1', pk: 'trid' },
  { name: 'vouchersc1', pk: 'vid' },
  { name: 'vouchers1', pk: 'vid' },
  { name: 'transc1', pk: 'transid' },
  { name: 'trans1', pk: 'transid' },
  { name: 'mprices', pk: 'amid' },
  { name: 'scnote1', pk: 'cnid' },
  { name: 'sum_table', pk: 'sid' },
  { name: 'investor_group_members', pk: 'pfolio_id' }
];

async function backupDatabase() {
  console.log('====================================================');
  console.log(`[1/3] EXPORTING FULL SUPABASE DATABASE SNAPSHOT (${todayStr})`);
  console.log('====================================================');

  if (!supaUrl || !supaKey) {
    console.warn('⚠️ Supabase URL or Key not found in .env, skipping DB export.');
    return;
  }

  const supabase = createClient(supaUrl, supaKey);
  const manifest = {
    created_at: new Date().toISOString(),
    date: todayStr,
    tables: {}
  };

  for (const { name, pk } of TABLES) {
    process.stdout.write(`Fetching ${name}... `);
    let allRows = [];
    let from = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      let query = supabase.from(name).select('*').range(from, from + PAGE_SIZE - 1);
      if (pk) query = query.order(pk, { ascending: true });
      const { data, error } = await query;
      if (error) {
        console.log(`Error: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    manifest.tables[name] = allRows.length;
    console.log(`${allRows.length} rows`);

    const jsonStr = JSON.stringify(allRows, null, 2);
    fs.writeFileSync(path.join(backupDir, `${name}.json`), jsonStr, 'utf8');
    fs.writeFileSync(path.join(latestDir, `${name}.json`), jsonStr, 'utf8');
  }

  const manifestStr = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), manifestStr, 'utf8');
  fs.writeFileSync(path.join(latestDir, 'manifest.json'), manifestStr, 'utf8');
  console.log(`Database snapshot saved to: ${backupDir}`);
}

async function addDirectoryToZip(zip, dirPath, rootPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    // Skip heavy / build / secret / VCS folders
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.vercel', 'dist', 'scratch', 'test-results'].includes(entry.name)) {
        continue;
      }
      const subFolder = zip.folder(entry.name);
      await addDirectoryToZip(subFolder, fullPath, rootPath);
    } else {
      // Skip very large binaries or existing zip files
      if (entry.name.endsWith('.zip') || entry.name.endsWith('.exe') || entry.name === 'mprTempBackupMPrAPPv10.db') {
        continue;
      }
      const data = fs.readFileSync(fullPath);
      zip.file(entry.name, data);
    }
  }
}

async function createCodebaseZip() {
  console.log('\n====================================================');
  console.log(`[2/3] CREATING FULL APPLICATION & CODE ARCHIVE (${todayStr})`);
  console.log('====================================================');

  const rootDir = path.resolve(__dirname, '..');
  const zip = new JSZip();

  console.log('Packing application source files, configurations, and scripts...');
  await addDirectoryToZip(zip, rootDir, rootDir);

  console.log('Compressing zip archive...');
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const zipFilename = `wealthcore_full_app_backup_${todayStr}.zip`;
  const internalZipPath = path.join(rootDir, 'backups', zipFilename);
  const desktopZipPath = path.join('C:', 'Users', 'Admin', 'Desktop', zipFilename);

  fs.writeFileSync(internalZipPath, content);
  console.log(`Saved internal backup: ${internalZipPath} (${(content.length / (1024 * 1024)).toFixed(2)} MB)`);

  try {
    fs.writeFileSync(desktopZipPath, content);
    console.log(`Saved Desktop backup: ${desktopZipPath} (${(content.length / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (err) {
    console.warn('Desktop copy warning:', err.message);
  }

  console.log('\n====================================================');
  console.log('✅ FULL BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`1. Database Snapshot: ${backupDir}`);
  console.log(`2. Full App Code Zip: ${desktopZipPath}`);
  console.log('====================================================');
}

async function main() {
  try {
    await backupDatabase();
    await createCodebaseZip();
  } catch (err) {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  }
}

main();

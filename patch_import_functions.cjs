/**
 * Add missing functions/vars to ImportPage.tsx:
 * - missingRequired: derived list of required tables not yet staged
 * - clearStaged: resets staged files + status  
 * - startImport: runs the actual Supabase upsert for each staged table
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// ── 1. Add missingRequired right after hasStaged ──────────────────────────────
const AFTER_HAS_STAGED = `  const hasStaged = Object.keys(stagedFiles).length > 0;`;
const MISSING_REQUIRED = `  const hasStaged = Object.keys(stagedFiles).length > 0;
  const missingRequired = TABLE_CONFIGS.filter(t => 
    t.required && !stagedFiles[t.key]
  );`;

if (content.includes(AFTER_HAS_STAGED)) {
  content = content.replace(AFTER_HAS_STAGED, MISSING_REQUIRED);
  console.log('✅ Added missingRequired');
} else {
  // Try CRLF
  const C = s => s.replace(/\n/g, '\r\n');
  if (content.includes(C(AFTER_HAS_STAGED))) {
    content = content.replace(C(AFTER_HAS_STAGED), C(MISSING_REQUIRED));
    console.log('✅ Added missingRequired (CRLF)');
  } else {
    console.error('❌ Cannot find hasStaged line');
  }
}

// ── 2. Find a good place to insert clearStaged and startImport ────────────────
// Insert before the return() statement of the component
// Look for the useEffect or first const that's a callback
const INSERT_MARKER = `  const handleDragOver`;
const INSERT_MARKER_ALT = `  const handleFileSelect`;

let insertPoint = content.indexOf('\n  const handleDragOver');
if (insertPoint < 0) insertPoint = content.indexOf('\n  const handleFileSelect');
if (insertPoint < 0) {
  // Find the return statement
  insertPoint = content.indexOf('\n  return (');
}

if (insertPoint < 0) {
  console.error('❌ Cannot find insertion point for functions');
  process.exit(1);
}

const FUNCTIONS = `
  // ── Clear all staged files and reset state ────────────────────────────────
  const clearStaged = () => {
    setStagedFiles({});
    setImportComplete(false);
    setOverallProgress(0);
    setOverallMessage('');
    const resetStatus: Record<string, any> = {};
    TABLE_CONFIGS.forEach(t => {
      resetStatus[t.key] = { status: 'idle', rowCount: 0, progress: 0 };
    });
    setTableStatus(resetStatus);
  };

  // ── Run the actual Supabase upsert for each staged table ──────────────────
  const startImport = async () => {
    if (!hasStaged || missingRequired.length > 0 || isImporting) return;
    setIsImporting(true);
    setOverallProgress(0);
    setImportComplete(false);

    const tables = Object.keys(stagedFiles);
    let done = 0;

    for (const tableKey of tables) {
      const cfg = TABLE_CONFIGS.find(t => t.key === tableKey);
      if (!cfg) continue;
      const { rows } = stagedFiles[tableKey];

      setTableStatus(prev => ({ ...prev, [tableKey]: { ...prev[tableKey], status: 'importing', progress: 0 } }));
      setOverallMessage(\`Importing \${cfg.name}...\`);

      try {
        // Delete existing rows then insert fresh
        await supabase.from(tableKey as any).delete().neq(cfg.deleteKey, -999999);
        
        // Insert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await supabase.from(tableKey as any).insert(batch);
          if (error) throw new Error(error.message);
          const pct = Math.round(((i + batch.length) / rows.length) * 100);
          setTableStatus(prev => ({ ...prev, [tableKey]: { ...prev[tableKey], status: 'importing', progress: pct } }));
        }

        setTableStatus(prev => ({ 
          ...prev, 
          [tableKey]: { status: 'done', rowCount: rows.length, progress: 100 } 
        }));
      } catch (err: any) {
        setTableStatus(prev => ({ 
          ...prev, 
          [tableKey]: { ...prev[tableKey], status: 'error', progress: 0 } 
        }));
        setOverallMessage(\`❌ Error importing \${cfg.name}: \${err.message}\`);
        setIsImporting(false);
        return;
      }

      done++;
      setOverallProgress(Math.round((done / tables.length) * 100));
    }

    setOverallProgress(100);
    setOverallMessage('✅ All tables imported successfully!');
    setIsImporting(false);
    setImportComplete(true);
    await forceRefreshDatabase();
  };

`;

// Insert the functions before the marker
content = content.slice(0, insertPoint) + FUNCTIONS + content.slice(insertPoint);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Added clearStaged and startImport functions');

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('\n── Verification ──');
console.log('missingRequired:', verify.includes('const missingRequired'));
console.log('clearStaged:', verify.includes('const clearStaged'));
console.log('startImport:', verify.includes('const startImport'));

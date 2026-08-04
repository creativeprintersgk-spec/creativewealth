/**
 * Add missing drag/drop and file-select handlers to ImportPage.tsx.
 * These process CSV files and stage them for import.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Insert after isDragging state declaration, before the portfolios state
const MARKER = `  const [isDragging, setIsDragging] = useState(false);`;

const HANDLERS = `  const [isDragging, setIsDragging] = useState(false);

  // ── File Processing ───────────────────────────────────────────────────────
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (!file.name.endsWith('.csv')) continue;
      const fileName = file.name.toLowerCase();
      const config = TABLE_CONFIGS.find(t => t.filePattern.test(fileName));
      if (!config) {
        console.warn(\`No table config matched file: \${file.name}\`);
        continue;
      }
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length < 2) continue; // No data rows
      const headers = parsed[0].map(h => mapColumn(h.trim()));
      const rows = parsed.slice(1)
        .filter(row => row.some(cell => cell.trim() !== ''))
        .map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            if (h) obj[h] = parseValue(h, row[i] ?? '');
          });
          return obj;
        });
      setStagedFiles(prev => ({ ...prev, [config.key]: { rows, fileName: file.name } }));
      setTableStatus(prev => ({
        ...prev,
        [config.key]: { status: 'parsed', rowCount: rows.length, progress: 0 }
      }));
      console.log(\`Staged \${config.name}: \${rows.length} rows\`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFiles(e.target.files);
    e.target.value = ''; // Reset input
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };`;

let found = false;
if (content.includes(MARKER)) {
  content = content.replace(MARKER, HANDLERS);
  found = true;
  console.log('✅ Added file handlers (LF)');
} else {
  const C = s => s.replace(/\n/g, '\r\n');
  if (content.includes(C(MARKER))) {
    content = content.replace(C(MARKER), C(HANDLERS));
    found = true;
    console.log('✅ Added file handlers (CRLF)');
  }
}

if (!found) {
  console.error('❌ Could not find isDragging marker');
  process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('\n── Verification ──');
['handleFileSelect', 'handleDragOver', 'handleDragLeave', 'handleDrop', 'processFiles'].forEach(fn => {
  console.log(fn + ':', verify.includes('const ' + fn) ? 'EXISTS' : 'MISSING');
});

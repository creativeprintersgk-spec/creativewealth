/**
 * Fix: add missing hasStaged derived variable in ImportPage.tsx
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const OLD = `  const [stagedFiles, setStagedFiles] = useState<Record<string, { rows: any[]; fileName: string }>>({});`;
const NEW = `  const [stagedFiles, setStagedFiles] = useState<Record<string, { rows: any[]; fileName: string }>>({});
  const hasStaged = Object.keys(stagedFiles).length > 0;`;

// Try LF and CRLF
if (content.includes(OLD)) {
  content = content.replace(OLD, NEW);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Added hasStaged derived variable');
} else {
  const CRLF_OLD = OLD.replace(/\n/g, '\r\n');
  const CRLF_NEW = NEW.replace(/\n/g, '\r\n');
  if (content.includes(CRLF_OLD)) {
    content = content.replace(CRLF_OLD, CRLF_NEW);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Added hasStaged derived variable (CRLF)');
  } else {
    // Try finding just the start
    const idx = content.indexOf('const [stagedFiles, setStagedFiles]');
    if (idx >= 0) {
      const lineEnd = content.indexOf('\n', idx);
      content = content.slice(0, lineEnd + 1) 
        + '  const hasStaged = Object.keys(stagedFiles).length > 0;\n'
        + content.slice(lineEnd + 1);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('✅ Added hasStaged (fallback)');
    } else {
      console.error('❌ Could not find stagedFiles declaration');
    }
  }
}

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('hasStaged defined:', verify.includes('const hasStaged'));

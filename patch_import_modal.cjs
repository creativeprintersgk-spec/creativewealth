/**
 * Patch ImportPage.tsx and VoucherModal.tsx to pass isTest flag
 * from TestModeContext when creating vouchers.
 */
const fs = require('fs');
const path = require('path');

function patch(filePath, oldStr, newStr, label) {
  const full = path.join(__dirname, filePath);
  let content = fs.readFileSync(full, 'utf8');
  let found = false;
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    found = true;
  } else {
    const crlf = oldStr.replace(/\n/g, '\r\n');
    const newCrlf = newStr.replace(/\n/g, '\r\n');
    if (content.includes(crlf)) {
      content = content.replace(crlf, newCrlf);
      found = true;
    }
  }
  if (found) {
    fs.writeFileSync(full, content, 'utf8');
    console.log('✅ ' + label);
  } else {
    console.error('❌ Pattern not found: ' + label);
    // Show nearby context
    const idx = content.indexOf(oldStr.slice(0, 40));
    if (idx >= 0) console.log('  Near match at:', idx, content.slice(idx, idx+200));
  }
}

// ── ImportPage.tsx ──────────────────────────────────────────────────────────

// 1. Add useTestMode import
patch('src/pages/ImportPage.tsx',
  `import { useFY } from "../FYContext";`,
  `import { useFY } from "../FYContext";
import { useTestMode } from "../contexts/TestModeContext";`,
  'ImportPage: add useTestMode import'
);

// 2. Use the hook inside the component — find first hook call after component declaration
patch('src/pages/ImportPage.tsx',
  `  const { selectedFY } = useFY();`,
  `  const { selectedFY } = useFY();
  const { isTestMode } = useTestMode();`,
  'ImportPage: destructure isTestMode from useTestMode'
);

// 3. Pass isTest in createVoucher call
patch('src/pages/ImportPage.tsx',
  `        console.log(\`Commiting contract note voucher for portfolio \${pName}:\`, dataPayload);
        await createVoucher(dataPayload);`,
  `        console.log(\`Commiting contract note voucher for portfolio \${pName}:\`, dataPayload);
        await createVoucher({ ...dataPayload, isTest: isTestMode });`,
  'ImportPage: pass isTest flag to createVoucher'
);

// ── VoucherModal.tsx ────────────────────────────────────────────────────────

// 1. Add useTestMode import
patch('src/VoucherModal.tsx',
  `import React, {`,
  `import React, {`,
  'VoucherModal: (checking import section)'
);

// Find the actual import structure in VoucherModal
const vmPath = path.join(__dirname, 'src/VoucherModal.tsx');
const vmContent = fs.readFileSync(vmPath, 'utf8');
const firstLines = vmContent.slice(0, 500);
console.log('\nVoucherModal.tsx first 500 chars:');
console.log(firstLines);

// Check if useTestMode already imported
if (!vmContent.includes('useTestMode')) {
  // Find last import line to add after it
  const lastImport = vmContent.lastIndexOf('\nimport ');
  const lineEnd = vmContent.indexOf('\n', lastImport + 1);
  const before = vmContent.slice(0, lineEnd + 1);
  const after = vmContent.slice(lineEnd + 1);
  const newContent = before + `import { useTestMode } from "./contexts/TestModeContext";\n` + after;
  fs.writeFileSync(vmPath, newContent, 'utf8');
  console.log('✅ VoucherModal: added useTestMode import');
} else {
  console.log('ℹ️  VoucherModal: useTestMode already imported');
}

// 2. Add hook usage inside VoucherModal component
patch('src/VoucherModal.tsx',
  `  const [error, setError] = useState<string | null>(null)`,
  `  const { isTestMode } = useTestMode();
  const [error, setError] = useState<string | null>(null)`,
  'VoucherModal: add isTestMode hook'
);

// 3. Pass isTest when calling createVoucher in VoucherModal
patch('src/VoucherModal.tsx',
  `      else await createVoucher(data);`,
  `      else await createVoucher({ ...data, isTest: isTestMode });`,
  'VoucherModal: pass isTest to createVoucher'
);

console.log('\n✅ All import/modal patches done!');

const fs = require('fs');
const logic = fs.readFileSync('src/logic.ts', 'utf8');

const files = [
  'src/pages/MfCasTab.tsx',
  'src/pages/PMSWorkspace.tsx', 
  'src/pages/ImportPage.tsx',
  'src/pages/LedgerPage.tsx',
  'src/pages/BalanceSheet.tsx',
  'src/VoucherModal.tsx',
  'src/pages/MasterEntry.tsx',
  'src/components/pms/PMSIncomeModal.tsx',
  'src/components/pms/PMSCorporateActionModal.tsx'
];

const missing = new Set();

files.forEach(f => {
  try {
    const content = fs.readFileSync(f, 'utf8');
    // Find all imports from logic
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*logic['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const imports = match[1].split(',').map(s => s.trim().replace(/\s+as\s+\w+/, '').trim());
      imports.forEach(fn => {
        if (!fn || fn.length < 2) return;
        const hasExport = logic.includes(`export function ${fn}`)
          || logic.includes(`export async function ${fn}`)
          || logic.includes(`export const ${fn}`)
          || logic.includes(`export type ${fn}`)
          || logic.includes(`export { ${fn}`)
          || logic.includes(`export interface ${fn}`);
        if (!hasExport) missing.add(fn);
      });
    }
  } catch(e) { console.warn('Could not read:', f); }
});

console.log('Missing exports from logic.ts:');
[...missing].forEach(fn => console.log(' -', fn));

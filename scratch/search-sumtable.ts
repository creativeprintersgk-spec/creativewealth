import fs from 'fs';
const files = ['src/logic.ts', 'src/pages/PMSWorkspace.tsx', 'src/services/balanceSheet.ts', 'src/components/pms/PMSPPFModal.tsx'];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('sumTable') && (l.includes('.push') || l.includes('=') || l.includes('splice'))) {
      console.log(`${f}:${i+1} ${l.trim()}`);
    }
  });
});

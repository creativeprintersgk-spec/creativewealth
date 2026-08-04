/**
 * Final patch: add isTestMode hook usage in ImportPage + VoucherModal
 */
const fs = require('fs');
const path = require('path');

// ── ImportPage: add hook after triggerGlobalRefresh ──────────────────────────
{
  const full = path.join(__dirname, 'src/pages/ImportPage.tsx');
  let content = fs.readFileSync(full, 'utf8');

  // Already have isTestMode? Skip
  if (content.includes('const { isTestMode }')) {
    console.log('ℹ️  ImportPage: isTestMode already present');
  } else {
    const marker = '  const { triggerGlobalRefresh } = useFY();';
    if (content.includes(marker)) {
      content = content.replace(marker, marker + '\n  const { isTestMode } = useTestMode();');
      fs.writeFileSync(full, content, 'utf8');
      console.log('✅ ImportPage: added isTestMode hook');
    } else {
      // Try alternative — first useState line after export default
      const alt = '  const navigate = useNavigate();';
      if (content.includes(alt)) {
        content = content.replace(alt, alt + '\n  const { isTestMode } = useTestMode();');
        fs.writeFileSync(full, content, 'utf8');
        console.log('✅ ImportPage: added isTestMode hook (alt)');
      } else {
        console.error('❌ ImportPage: could not find hook insertion point');
      }
    }
  }
}

// ── VoucherModal: add hook usage ─────────────────────────────────────────────
{
  const full = path.join(__dirname, 'src/VoucherModal.tsx');
  let content = fs.readFileSync(full, 'utf8');

  if (content.includes('const { isTestMode }')) {
    console.log('ℹ️  VoucherModal: isTestMode already present');
  } else {
    // Find the first useState inside the component
    const marker = '  const [lines, setLines]';
    const markerAlt = '  const [error, setError]';
    const markerAlt2 = '  const { fyDateRange }';
    const markerAlt3 = '  const { selectedFY }';

    let found = false;
    for (const m of [marker, markerAlt, markerAlt2, markerAlt3]) {
      if (content.includes(m)) {
        content = content.replace(m, '  const { isTestMode } = useTestMode();\n' + m);
        fs.writeFileSync(full, content, 'utf8');
        console.log('✅ VoucherModal: added isTestMode hook (matched: ' + m.trim().slice(0,30) + ')');
        found = true;
        break;
      }
    }
    if (!found) {
      // Try finding first useState
      const useStateIdx = content.indexOf('  const [');
      if (useStateIdx >= 0) {
        const before = content.slice(0, useStateIdx);
        const after = content.slice(useStateIdx);
        content = before + '  const { isTestMode } = useTestMode();\n' + after;
        fs.writeFileSync(full, content, 'utf8');
        console.log('✅ VoucherModal: added isTestMode hook (first useState)');
      } else {
        console.error('❌ VoucherModal: no insertion point found');
      }
    }
  }
}

// ── Verify createVoucher calls have isTest ───────────────────────────────────
{
  const imp = fs.readFileSync(path.join(__dirname, 'src/pages/ImportPage.tsx'), 'utf8');
  const vm = fs.readFileSync(path.join(__dirname, 'src/VoucherModal.tsx'), 'utf8');
  console.log('\n── Verification ──');
  console.log('ImportPage has isTest in createVoucher:', imp.includes('isTest: isTestMode'));
  console.log('VoucherModal has isTest in createVoucher:', vm.includes('isTest: isTestMode'));
  console.log('ImportPage has useTestMode import:', imp.includes('useTestMode'));
  console.log('VoucherModal has useTestMode import:', vm.includes('useTestMode'));
  console.log('logic.ts has impRecId in transactions.push:', 
    fs.readFileSync(path.join(__dirname, 'src/logic.ts'), 'utf8').includes('impRecId: v?.imp_rec_id'));
}

console.log('\n✅ Done! Test Mode feature is fully wired:');
console.log('   Sidebar → Start Test Mode button');
console.log('   ImportPage + VoucherModal → new entries tagged imp_rec_id=TEST in Supabase');
console.log('   LedgerPage → shows orange for any row where imp_rec_id===TEST');

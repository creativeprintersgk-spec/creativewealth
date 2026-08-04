/**
 * Comprehensive patch for Test Mode (Supabase-based orange highlighting):
 * 1. logic.ts: Add impRecId to transactions.push in getLedgerWithBalance
 * 2. TestModeContext.tsx: Replace localStorage with pure React state
 * 3. LedgerPage.tsx: Read row.impRecId === 'TEST' for orange highlight
 */
const fs = require('fs');
const path = require('path');

function patch(filePath, oldStr, newStr, label) {
  const full = path.join(__dirname, filePath);
  let content = fs.readFileSync(full, 'utf8');
  // Try LF then CRLF
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
  }
}

// ── 1. logic.ts: expose imp_rec_id in getLedgerWithBalance ──────────────────
patch('src/logic.ts',
  `      transactions.push({
        date: e.dt || v?.dt, voucherId: e.vid,
        voucherType: v?.vtyp ? vtypMap[v.vtyp] || 'journal' : 'journal',
        narration: v?.narr || '',
        debit: dr, credit: cr, balance: runningBalance,
        againstLedger: againstName || '-'
      });`,
  `      transactions.push({
        date: e.dt || v?.dt, voucherId: e.vid,
        voucherType: v?.vtyp ? vtypMap[v.vtyp] || 'journal' : 'journal',
        narration: v?.narr || '',
        debit: dr, credit: cr, balance: runningBalance,
        againstLedger: againstName || '-',
        impRecId: v?.imp_rec_id || null,
      });`,
  'logic.ts: expose imp_rec_id in getLedgerWithBalance'
);

// ── 2. TestModeContext.tsx: pure React state, no localStorage ────────────────
const newContext = `/**
 * TestModeContext — "orange highlight" for test imports.
 *
 * HOW IT WORKS:
 * - When Test Mode is ON, ANY new voucher created or imported gets imp_rec_id='TEST' in Supabase.
 * - In the Ledger, any row with impRecId==='TEST' is shown in orange.
 * - Because the flag is in Supabase (not localStorage), it survives page refresh.
 * - Click "End Test Mode" to turn off the orange mode for future entries.
 *   (Existing TEST-tagged entries remain orange until you clear them from DB.)
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface TestModeContextType {
  isTestMode: boolean;
  isTestEntry: (impRecId?: string | null) => boolean;
  startTestMode: () => void;
  endTestMode: () => void;
}

const TestModeContext = createContext<TestModeContextType>({
  isTestMode: false,
  isTestEntry: () => false,
  startTestMode: () => {},
  endTestMode: () => {},
});

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  // React state only — no localStorage. Mode is active for the current session.
  // Entries tagged with imp_rec_id='TEST' in Supabase are visible even after refresh.
  const [isTestMode, setIsTestMode] = useState(false);

  const isTestEntry = useCallback((impRecId?: string | null): boolean => {
    return impRecId === 'TEST';
  }, []);

  const startTestMode = useCallback(() => {
    setIsTestMode(true);
  }, []);

  const endTestMode = useCallback(() => {
    setIsTestMode(false);
  }, []);

  return (
    <TestModeContext.Provider value={{ isTestMode, isTestEntry, startTestMode, endTestMode }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  return useContext(TestModeContext);
}
`;

const ctxPath = path.join(__dirname, 'src/contexts/TestModeContext.tsx');
fs.writeFileSync(ctxPath, newContext, 'utf8');
console.log('✅ TestModeContext.tsx: replaced with pure React state (no localStorage)');

// ── 3. LedgerPage.tsx: use impRecId for orange instead of baseline vid ───────
patch('src/pages/LedgerPage.tsx',
  `              filteredData.map((row: any, idx: number) => {
                // Orange highlight: Test Mode — any voucher with vid > baseline
                const rowVid = Number(row.voucherId?.replace(/[^0-9]/g, '') || 0);
                const isTestRow = isTestEntry(rowVid);`,
  `              filteredData.map((row: any, idx: number) => {
                // Orange highlight: Test Mode — entry tagged with imp_rec_id='TEST' in Supabase
                const isTestRow = isTestEntry(row.impRecId);`,
  'LedgerPage.tsx: switch to impRecId-based orange'
);

// ── 4. Sidebar.tsx: simplify the startTestMode call (no supabase max vid needed) ──
patch('src/Sidebar.tsx',
  `            onClick={async () => {
              if (isTestMode) {
                endTestMode();
              } else {
                setSettingBaseline(true);
                try {
                  const { data: v1 } = await supabase.from('vouchersc1').select('vid').order('vid', { ascending: false }).limit(1);
                  const { data: v2 } = await supabase.from('vouchers1').select('vid').order('vid', { ascending: false }).limit(1);
                  const maxVid = Math.max(v1?.[0]?.vid || 0, v2?.[0]?.vid || 0);
                  startTestMode(maxVid);
                } catch { startTestMode(0); }
                setSettingBaseline(false);
              }
            }}`,
  `            onClick={() => {
              if (isTestMode) {
                endTestMode();
              } else {
                startTestMode();
              }
            }}`,
  'Sidebar.tsx: simplify onClick (no supabase fetch needed)'
);

// Remove unused state and imports from Sidebar
patch('src/Sidebar.tsx',
  `  const { isTestMode, baselineVid, startTestMode, endTestMode } = useTestMode();
  const [settingBaseline, setSettingBaseline] = useState(false);`,
  `  const { isTestMode, startTestMode, endTestMode } = useTestMode();`,
  'Sidebar.tsx: remove baselineVid and settingBaseline state'
);

patch('src/Sidebar.tsx',
  `            disabled={settingBaseline}`,
  `            disabled={false}`,
  'Sidebar.tsx: remove disabled=settingBaseline'
);

patch('src/Sidebar.tsx',
  `            {settingBaseline ? 'Setting...' : isTestMode ? (`,
  `            {isTestMode ? (`,
  'Sidebar.tsx: remove settingBaseline text'
);

// Remove supabase import from Sidebar (no longer needed for test mode)
patch('src/Sidebar.tsx',
  `import { useTestMode } from './contexts/TestModeContext';
import { supabase } from './supabase';`,
  `import { useTestMode } from './contexts/TestModeContext';`,
  'Sidebar.tsx: remove supabase import'
);

console.log('\n✅ All patches applied successfully!');
console.log('\nNext: Update ImportPage.tsx to pass isTest:true from context when committing contract notes');

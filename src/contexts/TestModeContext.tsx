/**
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

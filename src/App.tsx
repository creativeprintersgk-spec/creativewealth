import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Sidebar from "./Sidebar"
import LedgerPage from "./pages/LedgerPage"
import BalanceSheet from "./pages/BalanceSheet"
import GroupPage from "./pages/GroupPage"
import MasterEntry from "./pages/MasterEntry"
import PMSWorkspace from "./pages/PMSWorkspace"
import TrialBalance from "./pages/TrialBalance"
import ChartOfAccounts from "./ChartOfAccounts"
import { initDatabase, getStoredGroups, getStoredLedgers, getStoredVouchers } from "./logic"
import { FYProvider } from "./FYContext"
import { FamilyProvider, useFamily } from "./contexts/FamilyContext"
import TopNavbar from "./TopNavbar"
import AppShell from "./AppShell"

function AppContent() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    initDatabase().then(() => setReady(true));
  }, []);

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#94a3b8', fontSize: '14px', gap: '12px' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Initializing WealthCore...
    </div>
  );

  return (
    <FamilyProvider>
      <AppShell>
        <div className="app-layout">
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
              <Routes>
                <Route path="/" element={<Navigate to="/pms" replace />} />
                <Route path="/pms" element={<PMSWorkspace />} />
                {/* Accounting routes - we will add TopNavbar here or in the components */}
                <Route path="/ledger" element={<><TopNavbar /><LedgerPage /></>} />
                <Route path="/ledger/:ledgerId" element={<><TopNavbar /><LedgerPage /></>} />
                <Route path="/balance-sheet" element={<><TopNavbar /><BalanceSheet /></>} />
                <Route path="/group/:groupId" element={<><TopNavbar /><GroupPage /></>} />
                <Route path="/trial-balance" element={<><TopNavbar /><TrialBalance /></>} />
                <Route path="/coa" element={<><TopNavbar /><ChartOfAccounts /></>} />
                <Route path="/master-entry" element={<MasterEntry />} />
              </Routes>
            </main>
          </div>
        </div>
      </AppShell>
    </FamilyProvider>
  );
}

export default function App() {
  return (
    <FYProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </FYProvider>
  );
}
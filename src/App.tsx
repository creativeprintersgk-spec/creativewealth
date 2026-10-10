import React from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
import LedgerPage from "./pages/LedgerPage"
import BalanceSheet from "./pages/BalanceSheet"
import ProfitLoss from "./pages/ProfitLoss"
import ReportPrinting from "./pages/ReportPrinting"
import GroupPage from "./pages/GroupPage"
import MasterEntry from "./pages/MasterEntry"
import PMSWorkspace from "./pages/PMSWorkspace"
import Dashboard from "./pages/Dashboard"
import ChartOfAccounts from "./ChartOfAccounts"
import CapitalGainsPage from "./pages/CapitalGainsPage"
import ImportPage from "./pages/ImportPage"
import TrialBalance from "./pages/TrialBalance"
import BackupRestorePage from "./pages/BackupRestorePage"
import DividendReconciliation from "./pages/DividendReconciliation"
import TaxLossHarvesting from "./pages/TaxLossHarvesting"
import ExecutiveOverviewPage from "./pages/ExecutiveOverviewPage"
import PortfolioAnalysisPage from "./pages/PortfolioAnalysisPage"
import SimulatorDashboard from "./pages/SimulatorDashboard"
import { initDatabase, getStoredGroups, getStoredLedgers, getStoredVouchers } from "./logic"
import { FYProvider, useFY } from "./FYContext"
import { FamilyProvider, useFamily } from "./contexts/FamilyContext"
import { TestModeProvider } from "./contexts/TestModeContext"
import TopNavbar from "./TopNavbar"
import AppShell from "./AppShell"
import AuthGate from "./AuthGate"
import { ThemeProvider } from "./contexts/ThemeContext"
import { SidebarProvider } from "./contexts/SidebarContext"

function AppContent() {
  const [ready, setReady] = React.useState(false);
  const fyCtx = useFY();
  const { isGlobalLoading } = fyCtx ?? { isGlobalLoading: false };

  React.useEffect(() => {
    initDatabase().then(() => setReady(true));
  }, []);

  const location = useLocation();
  const isPms = location.pathname === "/pms";
  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/";
  const isSimulator = location.pathname.startsWith("/simulator");

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bbg-text-main)', color: 'var(--bbg-text-muted)', fontSize: '14px', gap: '12px' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Initializing WealthCore...
    </div>
  );

  if (isSimulator) {
    return (
      <Routes>
        <Route path="/simulator" element={<SimulatorDashboard />} />
        <Route path="/simulator/dashboard" element={<SimulatorDashboard />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <div className="app-layout">
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <main 
            className={isPms || isDashboard ? "" : "main-content"} 
            style={{ 
              flex: 1, 
              overflowY: isPms ? 'hidden' : 'auto',
              padding: (isPms || isDashboard) ? 0 : undefined 
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/executive-overview" element={<><TopNavbar /><ExecutiveOverviewPage /></>} />
              <Route path="/portfolio-analysis" element={<PortfolioAnalysisPage />} />
              <Route path="/pms" element={<PMSWorkspace />} />
              {/* Accounting routes - we will add TopNavbar here or in the components */}
              <Route path="/ledger" element={<><TopNavbar /><LedgerPage /></>} />
              <Route path="/ledger/:ledgerId" element={<><TopNavbar /><LedgerPage /></>} />
              <Route path="/balance-sheet" element={<><TopNavbar /><BalanceSheet /></>} />
              <Route path="/profit-loss" element={<><TopNavbar /><ProfitLoss /></>} />
              <Route path="/trial-balance" element={<><TopNavbar /><TrialBalance /></>} />
              <Route path="/reports" element={<><TopNavbar /><ReportPrinting /></>} />
              <Route path="/ledger-printing" element={<><TopNavbar /><ReportPrinting /></>} />
              <Route path="/group/:groupId" element={<><TopNavbar /><GroupPage /></>} />
              <Route path="/coa" element={<><TopNavbar /><ChartOfAccounts /></>} />
              <Route path="/capital-gains" element={<><TopNavbar /><CapitalGainsPage /></>} />
              <Route path="/master-entry" element={<MasterEntry />} />
              <Route path="/import" element={<><TopNavbar /><ImportPage /></>} />
              <Route path="/dividend-reconciliation" element={<><TopNavbar /><DividendReconciliation /></>} />
              <Route path="/tax-loss-harvesting" element={<><TopNavbar /><TaxLossHarvesting /></>} />
              <Route path="/backup" element={<><TopNavbar /><BackupRestorePage /></>} />
              <Route path="/simulator" element={<SimulatorDashboard />} />
              <Route path="/simulator/dashboard" element={<SimulatorDashboard />} />
            </Routes>
          </main>
        </div>
      </div>
      {isGlobalLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'var(--bbg-surface)',
          fontSize: '14px',
          fontWeight: 600,
          gap: '12px'
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: '3px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          Refreshing database...
        </div>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthGate>
      <FYProvider>
        <TestModeProvider>
          <FamilyProvider>
            <ThemeProvider>
              <SidebarProvider>
                <BrowserRouter>
                  <AppContent />
                </BrowserRouter>
              </SidebarProvider>
            </ThemeProvider>
          </FamilyProvider>
        </TestModeProvider>
      </FYProvider>
    </AuthGate>
  );
}
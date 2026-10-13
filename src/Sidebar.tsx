import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, BookOpen, Scale, LogOut, Wallet, FileText, Printer, FileUp, Calculator, FlaskConical, Database, ChevronDown, DollarSign, TrendingDown, TrendingUp, BarChart3, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { getIndices } from './services/priceService';
import { getStoredFamilies } from './logic';
import { useTestMode } from './contexts/TestModeContext';
import { useFamily } from './contexts/FamilyContext';
import { useAuth } from './AuthGate';
import { useSidebar } from './contexts/SidebarContext';

function getRefreshInterval(): number {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = ist.getHours()
  const m = ist.getMinutes()
  const day = ist.getDay()
  const minutes = h * 60 + m
  const isWeekend = day === 0 || day === 6
  const isMarketHours = !isWeekend && minutes >= 555 && minutes < 930
  return isMarketHours ? 60 * 1000 : 15 * 60 * 1000
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isTestMode, startTestMode, endTestMode } = useTestMode();
  const { activeFamilyId, setActiveFamilyId } = useFamily();
  const families = getStoredFamilies();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const [indices, setIndices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await getIndices();
        if (!data || data.length === 0) {
          setError('Market closed');
          setIndices([]);
        } else {
          setIndices(data);
          setError(null);
        }
      } catch (err) {
        setError('Market closed');
        setIndices([]);
      }
    };
    fetchIndices();
    const interval = setInterval(fetchIndices, getRefreshInterval());
    return () => clearInterval(interval);
  }, []);



  const { signOut } = useAuth();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('wealthcore_sidebar_open_sections');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      wealth: true,
      accounting: false,
      reports: false,
      setup: false,
    };
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('wealthcore_sidebar_open_sections', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Auto-expand section if current route belongs to that section
  useEffect(() => {
    const p = location.pathname;
    if (p === '/dashboard' || p.startsWith('/dashboard/') || p.startsWith('/simulator') || p === '/pms' || p.startsWith('/pms/') || p === '/executive-overview' || p === '/portfolio-analysis') {
      setOpenSections(prev => prev.wealth ? prev : { ...prev, wealth: true });
    } else if (p === '/coa' || p === '/ledger' || p.startsWith('/ledger/')) {
      setOpenSections(prev => prev.accounting ? prev : { ...prev, accounting: true });
    } else if (p === '/balance-sheet' || p === '/capital-gains' || p === '/tax-loss-harvesting' || p === '/profit-loss' || p === '/trial-balance' || p === '/reports' || p === '/ledger-printing') {
      setOpenSections(prev => prev.reports ? prev : { ...prev, reports: true });
    } else if (p === '/master-entry' || p === '/import' || p === '/dividend-reconciliation' || p === '/backup') {
      setOpenSections(prev => prev.setup ? prev : { ...prev, setup: true });
    }
  }, [location.pathname]);

  return (
    <aside className={`sidebar print-hide ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="sidebar-logo-icon">
            <LayoutDashboard size={14} color="white" />
          </div>
          <span className="sidebar-logo-text">WealthCore</span>
        </div>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(true)}
          title="Slide navigation menu in"
        >
          <PanelLeftClose size={15} color="rgba(255, 255, 255, 0.9)" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {/* WEALTH WORKSPACE */}
        <div>
          <button
            type="button"
            className="sidebar-section-toggle"
            onClick={() => toggleSection('wealth')}
            aria-expanded={!!openSections.wealth}
          >
            <span className="sidebar-section-label-text">Wealth Workspace</span>
            <ChevronDown 
              size={13} 
              className={`sidebar-section-chevron ${openSections.wealth ? 'open' : ''}`} 
            />
          </button>
          
          {openSections.wealth && (
            <div className="sidebar-group-items">
              <button 
                className={`sidebar-nav-item ${isActive('/dashboard') || isActive('/simulator') ? 'active' : ''}`}
                onClick={() => navigate('/dashboard')}
              >
                <Sparkles size={14} /> Simulator
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/pms') ? 'active' : ''}`}
                onClick={() => navigate('/pms')}
              >
                <Wallet size={14} /> PMS Workspace
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/executive-overview') ? 'active' : ''}`}
                onClick={() => navigate('/executive-overview')}
              >
                <BarChart3 size={14} /> Executive Overview
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/portfolio-analysis') ? 'active' : ''}`}
                onClick={() => navigate('/portfolio-analysis')}
              >
                <TrendingUp size={14} /> Portfolio Analysis
              </button>
            </div>
          )}
        </div>

        {/* ACCOUNTING ENGINE SECTION */}
        <div>
          <button
            type="button"
            className="sidebar-section-toggle"
            onClick={() => toggleSection('accounting')}
            aria-expanded={!!openSections.accounting}
          >
            <span className="sidebar-section-label-text">Accounting Engine</span>
            <ChevronDown 
              size={13} 
              className={`sidebar-section-chevron ${openSections.accounting ? 'open' : ''}`} 
            />
          </button>

          {openSections.accounting && (
            <div className="sidebar-group-items">
              <button 
                className={`sidebar-nav-item ${isActive('/coa') ? 'active' : ''}`}
                onClick={() => navigate('/coa')}
              >
                <Layers size={14} /> Chart of Accounts
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/ledger') ? 'active' : ''}`}
                onClick={() => navigate('/ledger')}
              >
                <BookOpen size={14} /> Ledger View
              </button>
            </div>
          )}
        </div>

        {/* REPORTS SECTION */}
        <div>
          <button
            type="button"
            className="sidebar-section-toggle"
            onClick={() => toggleSection('reports')}
            aria-expanded={!!openSections.reports}
          >
            <span className="sidebar-section-label-text">Reports & Insights</span>
            <ChevronDown 
              size={13} 
              className={`sidebar-section-chevron ${openSections.reports ? 'open' : ''}`} 
            />
          </button>

          {openSections.reports && (
            <div className="sidebar-group-items">
              <button 
                className={`sidebar-nav-item ${isActive('/balance-sheet') ? 'active' : ''}`}
                onClick={() => navigate('/balance-sheet')}
              >
                <Scale size={14} /> Balance Sheet
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/capital-gains') ? 'active' : ''}`}
                onClick={() => navigate('/capital-gains')}
              >
                <FileText size={14} /> Capital Gains
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/tax-loss-harvesting') ? 'active' : ''}`}
                onClick={() => navigate('/tax-loss-harvesting')}
              >
                <TrendingDown size={14} /> Tax Loss Harvesting
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/profit-loss') ? 'active' : ''}`}
                onClick={() => navigate('/profit-loss')}
              >
                <LayoutDashboard size={14} /> Profit &amp; Loss
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/trial-balance') ? 'active' : ''}`}
                onClick={() => navigate('/trial-balance')}
              >
                <Calculator size={14} /> Trial Balance
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/reports') || isActive('/ledger-printing') ? 'active' : ''}`}
                onClick={() => navigate('/reports')}
              >
                <Printer size={14} /> Report Printing
              </button>
            </div>
          )}
        </div>

        {/* SETUP SECTION */}
        <div>
          <button
            type="button"
            className="sidebar-section-toggle"
            onClick={() => toggleSection('setup')}
            aria-expanded={!!openSections.setup}
          >
            <span className="sidebar-section-label-text">Setup</span>
            <ChevronDown 
              size={13} 
              className={`sidebar-section-chevron ${openSections.setup ? 'open' : ''}`} 
            />
          </button>

          {openSections.setup && (
            <div className="sidebar-group-items">
              <button 
                className={`sidebar-nav-item ${isActive('/master-entry') ? 'active' : ''}`}
                onClick={() => navigate('/master-entry')}
              >
                <BookOpen size={14} /> Master Entry
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/import') ? 'active' : ''}`}
                onClick={() => navigate('/import')}
              >
                <FileUp size={14} /> Import Data
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/dividend-reconciliation') ? 'active' : ''}`}
                onClick={() => navigate('/dividend-reconciliation')}
              >
                <DollarSign size={14} /> Dividend Recon
              </button>
              <button 
                className={`sidebar-nav-item ${isActive('/backup') ? 'active' : ''}`}
                onClick={() => navigate('/backup')}
              >
                <Database size={14} /> Backup & Restore
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-bottom">
        {/* Indices Display */}
        <div style={{ padding: '0 12px 12px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255, 255, 255, 0.75)', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>Market Indices</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {indices.map(idx => (
              <div key={idx.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>{idx.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: idx.change_pct >= 0 ? '#4ade80' : '#fca5a5' }}>
                    {idx.change >= 0 ? '+' : ''}{idx.change.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
            {indices.length === 0 && !error && (
              <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Loading indices...</div>
            )}
            {error && (
              <div style={{ fontSize: '10px', color: '#fca5a5' }}>{error}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <button 
            className="sidebar-action-btn"
            style={{ flex: 1, padding: '0 4px', fontSize: '10px' }}
            title="Change active family context"
            onClick={() => {
              localStorage.removeItem('activeFamilyId');
              window.location.reload();
            }}
          >
            <LogOut size={12} /> Family
          </button>
          <button 
            className="sidebar-action-btn"
            style={{ flex: 1, padding: '0 4px', fontSize: '10px', color: '#fecaca', background: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            title="Sign out of WealthCore session"
            onClick={async () => {
              if (window.confirm('Are you sure you want to sign out?')) {
                await signOut();
                window.location.reload();
              }
            }}
          >
            <LogOut size={12} color="#fca5a5" /> Sign Out
          </button>
        </div>

        {/* FAMILY CONTEXT SELECTOR */}
        <div style={{ padding: '8px 12px 4px', marginTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255, 255, 255, 0.75)', letterSpacing: '0.05em', marginBottom: '6px', textTransform: 'uppercase' }}>Family Context</div>
          <div style={{ position: 'relative' }}>
            <select
              value={activeFamilyId || ''}
              onChange={(e) => setActiveFamilyId(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 24px 7px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                background: 'rgba(255, 255, 255, 0.18)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              {families.map(f => (
                <option key={f.id} value={f.id} style={{ background: '#3b5a7a', color: '#fff' }}>
                  {f.familyName || f.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} color="rgba(255, 255, 255, 0.8)" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>
      </div>

      <style>{`
        .sidebar-action-btn { flex: 1; height: 32px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: #ffffff; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
        .sidebar-action-btn:hover { background: rgba(255,255,255,0.28); color: #fff; border-color: rgba(255,255,255,0.45); }
      `}</style>
    </aside>
  );
}

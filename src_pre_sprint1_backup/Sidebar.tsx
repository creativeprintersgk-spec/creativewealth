import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, BookOpen, Scale, LogOut, Wallet, FileText, Printer, FileUp, Calculator, FlaskConical, Database, ChevronDown } from 'lucide-react';
import { getIndices } from './services/priceService';
import { getStoredFamilies } from './logic';
import { useTestMode } from './contexts/TestModeContext';
import { useFamily } from './contexts/FamilyContext';
import { useAuth } from './AuthGate';

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

  return (
    <aside className="sidebar print-hide">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <LayoutDashboard size={14} color="white" />
        </div>
        <span className="sidebar-logo-text">WealthCore</span>
      </div>

      <nav className="sidebar-nav">
        {/* WEALTH WORKSPACE */}
        <div>
          <div className="sidebar-section-label">Wealth Workspace</div>
          <div className="sidebar-group-items">
            <button 
              className={`sidebar-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard /> Dashboard
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/pms') ? 'active' : ''}`}
              onClick={() => navigate('/pms')}
            >
              <Wallet /> PMS Workspace
            </button>
          </div>
        </div>

        {/* ACCOUNTING ENGINE SECTION */}
        <div>
          <div className="sidebar-section-label">Accounting Engine</div>
          <div className="sidebar-group-items">
            <button 
              className={`sidebar-nav-item ${isActive('/coa') ? 'active' : ''}`}
              onClick={() => navigate('/coa')}
            >
              <Layers /> Chart of Accounts
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/ledger') ? 'active' : ''}`}
              onClick={() => navigate('/ledger')}
            >
              <BookOpen /> Ledger View
            </button>
          </div>
        </div>

        {/* REPORTS SECTION */}
        <div>
          <div className="sidebar-section-label">Reports & Insights</div>
          <div className="sidebar-group-items">
            <button 
              className={`sidebar-nav-item ${isActive('/balance-sheet') ? 'active' : ''}`}
              onClick={() => navigate('/balance-sheet')}
            >
              <Scale /> Balance Sheet
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/capital-gains') ? 'active' : ''}`}
              onClick={() => navigate('/capital-gains')}
            >
              <FileText /> Capital Gains
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/profit-loss') ? 'active' : ''}`}
              onClick={() => navigate('/profit-loss')}
            >
              <LayoutDashboard /> Profit &amp; Loss
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/trial-balance') ? 'active' : ''}`}
              onClick={() => navigate('/trial-balance')}
            >
              <Calculator /> Trial Balance
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/reports') || isActive('/ledger-printing') ? 'active' : ''}`}
              onClick={() => navigate('/reports')}
            >
              <Printer /> Report Printing
            </button>
          </div>
        </div>

        {/* SETUP SECTION */}
        <div>
          <div className="sidebar-section-label">Setup</div>
          <div className="sidebar-group-items">
            <button 
              className={`sidebar-nav-item ${isActive('/master-entry') ? 'active' : ''}`}
              onClick={() => navigate('/master-entry')}
            >
              <BookOpen /> Master Entry
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/import') ? 'active' : ''}`}
              onClick={() => navigate('/import')}
            >
              <FileUp /> Import Data
            </button>
            <button 
              className={`sidebar-nav-item ${isActive('/backup') ? 'active' : ''}`}
              onClick={() => navigate('/backup')}
            >
              <Database /> Backup & Restore
            </button>
          </div>
        </div>
      </nav>

      <div className="sidebar-bottom">
        {/* Indices Display */}
        <div style={{ padding: '0 12px 12px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>Market Indices</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {indices.map(idx => (
              <div key={idx.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{idx.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: idx.change_pct >= 0 ? '#4ade80' : '#f87171' }}>
                    {idx.change >= 0 ? '+' : ''}{idx.change.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
            {indices.length === 0 && !error && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Loading indices...</div>
            )}
            {error && (
              <div style={{ fontSize: '10px', color: '#f87171' }}>{error}</div>
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
            style={{ flex: 1, padding: '0 4px', fontSize: '10px', color: '#fca5a5' }}
            title="Sign out of WealthCore session"
            onClick={async () => {
              if (window.confirm('Are you sure you want to sign out?')) {
                await signOut();
                window.location.reload();
              }
            }}
          >
            <LogOut size={12} color="#f87171" /> Sign Out
          </button>
        </div>

        {/* FAMILY CONTEXT SELECTOR */}
        <div style={{ padding: '8px 12px 4px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', marginBottom: '6px', textTransform: 'uppercase' }}>Family Context</div>
          <div style={{ position: 'relative' }}>
            <select
              value={activeFamilyId || ''}
              onChange={(e) => setActiveFamilyId(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 24px 7px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              {families.map(f => (
                <option key={f.id} value={f.id} style={{ background: '#0f172a', color: '#fff' }}>
                  {f.familyName || f.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>
      </div>

      <style>{`
        .sidebar-action-btn { flex: 1; height: 32px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
        .sidebar-action-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }
      `}</style>
    </aside>
  );
}

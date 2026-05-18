import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, BookOpen, Scale, LogOut, Wallet, Database, Clock, Download, Upload, Calculator } from 'lucide-react';

import { getStoredLedgers, getStoredVouchers, initDatabase } from './logic';
import { getIndices } from './services/priceService';
import React, { useState, useEffect } from 'react';

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

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const ledgersCount = getStoredLedgers().length;
  const vouchersCount = getStoredVouchers().length;

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

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/db');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `wealthcore_backup_${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Backup failed: " + err);
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (!confirm("Are you sure? This will OVERWRITE all current data with the backup file.")) return;

      const reader = new FileReader();
      reader.onload = async (event: any) => {
        try {
          const data = JSON.parse(event.target.result);
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          alert("Restore Successful! Restarting app...");
          window.location.reload();
        } catch (err) {
          alert("Restore failed: Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <aside className="sidebar">
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
              className={`sidebar-nav-item ${isActive('/trial-balance') ? 'active' : ''}`}
              onClick={() => navigate('/trial-balance')}
            >
              <Calculator /> Trial Balance
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
              className="sidebar-nav-item"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <LayoutDashboard /> Profit & Loss
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

        {/* Version & DB Info */}
        <div style={{ padding: '0 8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px' }}>
            <Database size={10} />
            <span>DB: {vouchersCount} v / {ledgersCount} l</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
            <Clock size={10} />
            <span>v2.4.0 (Institutional)</span>
          </div>
        </div>

        <div className="sidebar-user-row">
          <div className="sidebar-avatar">W</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Test User</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>test@demo.com</div>
          </div>
        </div>
        <button 
          className="sidebar-nav-item" 
          style={{ marginTop: '4px', opacity: 0.8 }}
          onClick={() => {
            localStorage.removeItem('activeFamilyId');
            window.location.reload();
          }}
        >
          <LogOut /> Change Family
        </button>
      </div>

      <style>{`
        .sidebar-action-btn { flex: 1; height: 32px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
        .sidebar-action-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }
      `}</style>
    </aside>
  );
}

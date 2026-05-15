import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, RefreshCw, FileDown, FileUp, Calendar, FileText } from 'lucide-react';
import { useFY } from './FYContext';
import { handleYearClose, getStoredVouchers, getStoredEntries, getStoredLedgers } from './logic';
// import { save as dbSave } from './db/helpers';
import VoucherModal from './VoucherModal';

export default function TopNavbar() {
  const navigate = useNavigate();
  const { selectedFY, setSelectedFY, reportFilter, setReportFilter, customRange, setCustomRange } = useFY();
  
  const [showActions, setShowActions] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const years = [
    "2020-2021", "2021-2022", "2022-2023", "2023-2024", "2024-2025", 
    "2025-2026", "2026-2027", "2027-2028", "2028-2029", "2029-2030", "2030-2031"
  ];


  const getLastFY = (fyStr: string) => {
    const [start, end] = fyStr.split("-")
    return `${parseInt(start) - 1}-${parseInt(end) - 1}`
  }

  const getPreviousFY = (fyStr: string) => {
    const [start, end] = fyStr.split("-")
    return `${parseInt(start) - 2}-${parseInt(end) - 2}`
  }

  const handleExport = async () => {
    const data = { v: getStoredVouchers(), e: getStoredEntries(), l: getStoredLedgers() };
    const json = JSON.stringify(data);
    try {
      await navigator.clipboard.writeText(json);
      alert('✅ Backup copied to clipboard! Paste it somewhere safe.');
    } catch {
      prompt('BACKUP DATA (copy this):', json);
    }
  };

  const handleImport = async () => {
    alert('Import is temporarily disabled in Cloud Mode.');
  };

  return (
    <div style={{ height: '60px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', zIndex: 10 }}>
      
      {/* Left: Reports Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ position: 'relative' }}>
          <button 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'transparent', border: 'none', fontWeight: 600 }}
            onClick={() => { setShowReports(!showReports); setShowActions(false); }}
          >
            <FileText size={16} /> Reports <ChevronDown size={14} />
          </button>
          
          {showReports && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '200px', zIndex: 50 }}>
              <div style={{ padding: '8px 0' }}>
                <button onClick={() => { navigate('/balance-sheet'); setShowReports(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Balance Sheet</button>
                <button disabled style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, opacity: 0.5 }}>Profit &amp; Loss</button>
                <button disabled style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, opacity: 0.5 }}>Trial Balance</button>
                <button disabled style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, opacity: 0.5 }}>Ledger Printing</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Period Engine */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <Calendar size={16} color="#64748b" style={{ marginLeft: '8px' }} />
        
        {/* Anchor Year Selector */}
        <select 
          value={selectedFY} 
          onChange={(e) => {
            setSelectedFY(e.target.value);
            setReportFilter('current');
          }}
          style={{ padding: '6px 8px', border: 'none', background: 'white', borderRadius: '4px', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#1d4ed8', cursor: 'pointer', borderRight: '1px solid #e2e8f0' }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select 
          value={reportFilter} 
          onChange={(e) => setReportFilter(e.target.value as any)}
          style={{ padding: '6px 8px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
        >
          <option value="current">Current Year ({selectedFY})</option>
          <option value="last">Last Year ({getLastFY(selectedFY)})</option>
          <option value="previous">Previous Year ({getPreviousFY(selectedFY)})</option>
          <option value="custom">Custom Range</option>
        </select>
        
        {reportFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '8px' }}>
            <input type="date" value={customRange.start} onChange={(e) => setCustomRange((prev: any) => ({ ...prev, start: e.target.value }))} style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
            <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
            <input type="date" value={customRange.end} onChange={(e) => setCustomRange((prev: any) => ({ ...prev, end: e.target.value }))} style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
          </div>
        )}
      </div>

      {/* Right: Actions Menu */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            onClick={() => { setShowActions(!showActions); setShowReports(false); }}
          >
            Actions <ChevronDown size={14} />
          </button>
          
          {showActions && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '240px', zIndex: 50 }}>
              <div style={{ padding: '8px 0' }}>
                <button onClick={() => { setIsVoucherModalOpen(true); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><Plus size={14} /> New Voucher</button>
                <button onClick={() => { handleYearClose(selectedFY, () => window.location.reload()); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><Calendar size={14} /> Create Year End Voucher</button>
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
                <button onClick={() => { window.location.reload(); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><RefreshCw size={14} /> Recalculate</button>
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
                <button onClick={() => { handleImport(); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><FileUp size={14} /> Import Data</button>
                <button onClick={() => { handleExport(); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><FileDown size={14} /> Export Data</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isVoucherModalOpen && (
        <VoucherModal 
          onClose={() => setIsVoucherModalOpen(false)}
          onSaved={() => {
            setIsVoucherModalOpen(false);
            window.location.reload(); // Hard recalculate for now to ensure state sync globally
          }}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, RefreshCw, FileDown, FileUp, Calendar, FileText, ShieldCheck } from 'lucide-react';
import { useFY } from './FYContext';
import { handleYearClose, getStoredVouchers, getStoredEntries, getStoredLedgers, getStoredAccounts, getStoredPortfolios } from './logic';
// import { save as dbSave } from './db/helpers';
import VoucherModal from './VoucherModal';
import PriceAuditModal from './components/pms/PriceAuditModal';
import YearEndCloseModal from './components/YearEndCloseModal';

export default function TopNavbar() {
  const navigate = useNavigate();
  const { selectedFY, setSelectedFY, reportFilter, setReportFilter, customRange, setCustomRange, selectedAccountId, setSelectedAccountId, triggerGlobalRefresh } = useFY();
  
  const [showActions, setShowActions] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isYearEndModalOpen, setIsYearEndModalOpen] = useState(false);
  const [isPriceAuditOpen, setIsPriceAuditOpen] = useState(false);

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

  const handleExport = () => {
    try {
      const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        vouchers: getStoredVouchers(),
        entries: getStoredEntries(),
        ledgers: getStoredLedgers(),
        portfolios: getStoredPortfolios(),
        accounts: getStoredAccounts()
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `wealthcore_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Failed to generate export file: ' + (err.message || String(err)));
    }
  };

  const handleImport = async () => {
    navigate('/import');
  };

  return (
    <div className="print-hide" style={{ height: '60px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', zIndex: 10 }}>
      
      {/* Left spacer to keep Middle period engine centered */}
      <div style={{ width: '200px' }}></div>

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

      {/* Member Filter (Global) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginLeft: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Member:</span>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{ padding: '6px 8px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#1d4ed8', cursor: 'pointer' }}
        >
          <option value="">All Members</option>
          {getStoredAccounts().map(acc => (
            <option key={acc.id} value={acc.id}>{acc.accountName}</option>
          ))}
        </select>
      </div>

      {/* Right: Actions Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => setIsPriceAuditOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <ShieldCheck size={16} color="#2563eb" /> Price Audit
        </button>

        <div style={{ position: 'relative' }}>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            onClick={() => { setShowActions(!showActions); }}
          >
            Actions <ChevronDown size={14} />
          </button>
          
          {showActions && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '240px', zIndex: 50 }}>
              <div style={{ padding: '8px 0' }}>
                <button onClick={() => { setIsPriceAuditOpen(true); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><ShieldCheck size={14} /> Price Audit & Health Engine</button>
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
                <button onClick={() => { setIsVoucherModalOpen(true); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><Plus size={14} /> New Voucher</button>
                <button onClick={() => {
                  const currentMemberName = getStoredAccounts().find(a => a.id === selectedAccountId)?.name || 'the selected member';
                  if (window.confirm(`⚠️ WARNING: You are about to calculate and preview the Year End Closing Voucher for ${currentMemberName.toUpperCase()} for FY ${selectedFY}.\n\nThis will calculate offset transactions to close all Income & Expense accounts to the Capital Account.\n\nDo you want to proceed to the preview?`)) {
                    setIsYearEndModalOpen(true);
                  }
                  setShowActions(false);
                }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><Calendar size={14} /> Create Year End Voucher</button>
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
                <button onClick={async () => { await triggerGlobalRefresh(true); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><RefreshCw size={14} /> Recalculate & Clear Cache</button>
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
                <button onClick={() => { handleImport(); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><FileUp size={14} /> Import Data</button>
                <button onClick={() => { handleExport(); setShowActions(false); }} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><FileDown size={14} /> Export Data</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isPriceAuditOpen && (
        <PriceAuditModal 
          onClose={() => setIsPriceAuditOpen(false)}
          onRefresh={async () => {
            await triggerGlobalRefresh();
          }}
        />
      )}

      {isVoucherModalOpen && (
        <VoucherModal 
          onClose={() => setIsVoucherModalOpen(false)}
          onSaved={async () => {
            setIsVoucherModalOpen(false);
            await triggerGlobalRefresh();
          }}
        />
      )}
      {isYearEndModalOpen && (
        <YearEndCloseModal 
          isOpen={isYearEndModalOpen} 
          onClose={() => setIsYearEndModalOpen(false)} 
          selectedFY={selectedFY} 
        />
      )}
    </div>
  );
}

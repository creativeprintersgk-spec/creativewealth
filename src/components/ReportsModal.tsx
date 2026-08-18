import React, { useState, useMemo } from 'react';
import { X, FileText, ChevronDown } from 'lucide-react';
import { getStoredPortfolios } from '../logic';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFamily: any;
  activePortfolio: any;
  onGenerateReport: (config: ReportConfig) => void;
  defaultPortfolioIds?: string[];
}

export interface ReportConfig {
  category: string;
  reportName: string;
  options: {
    assetTypes: string[];
    dateRange?: { start: string; end: string };
    gainType?: 'All' | 'STCG' | 'LTCG';
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    [key: string]: any;
  };
}

const CATEGORIES = ['Capital Gains', 'Performance', 'Transactions', 'Tax Software Formats'];

const REPORTS_BY_CATEGORY: Record<string, string[]> = {
  'Capital Gains':        ['Realised Capital Gains', 'Capital Gains - Income Tax Return Format', 'Unrealised Capital Gains'],
  'Performance':          ['Portfolio Summary', 'P&L Detailed', 'P&L Summary', 'Annualised Return (XIRR)'],
  'Transactions':         ['All Transactions', 'Dividends Received'],
  'Tax Software Formats': ['ClearTax Format', 'Winman Format']
};

const ASSET_TYPES = [
  'All Assets',
  'Stocks & ETFs',
  'Mutual Funds',
  'Mutual Funds (Equity)',
  'Mutual Funds (Debt)',
  'Mutual Funds (Other)',
  'Gold / Commodities',
  'Traded Bonds',
  'NCDs'
];

function generateFYList() {
  const now = new Date();
  const cur = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fys = [];
  for (let y = cur; y >= 2001; y--)
    fys.push({ label: `${y}-${y + 1}`, start: `${y}-04-01`, end: `${y + 1}-03-31` });
  return fys;
}

function currentFYDates() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

export default function ReportsModal({ isOpen, onClose, onGenerateReport }: ReportsModalProps) {
  const fy = currentFYDates();
  const fyList = useMemo(() => generateFYList(), []);

  const [activeCategory, setActiveCategory] = useState('Capital Gains');
  const [activeReport, setActiveReport]     = useState('Realised Capital Gains');
  const [assetType, setAssetType]           = useState('All Assets');
  const [gainType, setGainType]             = useState<'All' | 'STCG' | 'LTCG'>('All');
  const [sortBy, setSortBy]                 = useState('Name');
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('asc');
  const [startDate, setStartDate]           = useState('1970-01-01');
  const [endDate, setEndDate]               = useState(fy.end);

  const allPortfolios = useMemo(() => getStoredPortfolios(), []);
  const [selectedPortId, setSelectedPortId] = useState('all');

  if (!isOpen) return null;

  const handleGenerate = () => {
    const portIds = selectedPortId === 'all'
      ? allPortfolios.map(p => String(p.id))
      : [selectedPortId];
    onGenerateReport({
      category: activeCategory,
      reportName: activeReport,
      options: {
        assetTypes: assetType === 'All Assets' ? ['All Assets'] : [assetType],
        dateRange: { start: startDate, end: endDate },
        portfolios: portIds,
        gainType,
        sortBy,
        sortDir
      }
    });
    onClose();
  };

  /* ── Styles helpers ── */
  const select: React.CSSProperties = {
    width: '100%', padding: '8px 30px 8px 10px', fontSize: '13px',
    border: '1px solid #e2e8f0', borderRadius: '7px',
    background: 'white', color: '#0f172a',
    appearance: 'none', outline: 'none', cursor: 'pointer'
  };
  const label: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '6px', display: 'block'
  };
  const radioRow = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
    fontSize: '12px', fontWeight: active ? 600 : 500,
    background: active ? '#eff6ff' : '#f8fafc',
    color: active ? '#2563eb' : '#475569',
    border: `1px solid ${active ? '#bfdbfe' : '#e2e8f0'}`,
    userSelect: 'none'
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '880px', maxHeight: '92vh', borderRadius: '12px', overflow: 'hidden',
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', background: 'white'
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', background: '#0f172a', color: 'white', flexShrink: 0
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={17} /> Reports Center
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Col 1 — Category */}
          <div style={{ width: '185px', flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#f8fafc', padding: '14px 0', overflowY: 'auto' }}>
            <div style={{ ...label, padding: '0 14px', marginBottom: '10px' }}>Category</div>
            {CATEGORIES.map(c => (
              <div key={c} onClick={() => { setActiveCategory(c); setActiveReport(REPORTS_BY_CATEGORY[c][0]); }}
                style={{
                  padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                  fontWeight: activeCategory === c ? 700 : 500,
                  color: activeCategory === c ? '#2563eb' : '#374151',
                  background: activeCategory === c ? '#eff6ff' : 'transparent',
                  borderRight: `3px solid ${activeCategory === c ? '#3b82f6' : 'transparent'}`
                }}>{c}</div>
            ))}
          </div>

          {/* Col 2 — Report list */}
          <div style={{ width: '215px', flexShrink: 0, borderRight: '1px solid #e2e8f0', padding: '14px 0', overflowY: 'auto' }}>
            <div style={{ ...label, padding: '0 14px', marginBottom: '10px' }}>Reports</div>
            {REPORTS_BY_CATEGORY[activeCategory]?.map(r => (
              <div key={r} onClick={() => setActiveReport(r)}
                style={{
                  padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                  fontWeight: activeReport === r ? 600 : 400,
                  color: activeReport === r ? '#0f172a' : '#475569',
                  background: activeReport === r ? '#f1f5f9' : 'transparent',
                }}>{r}</div>
            ))}
          </div>

          {/* Col 3 — Options */}
          <div style={{ flex: 1, padding: '20px 22px', overflowY: 'auto' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>{activeReport}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Capital Gains Summary Report</div>

            {/* Period */}
            <div style={{ marginBottom: '16px' }}>
              <span style={label}>Period</span>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button onClick={() => { setStartDate('1970-01-01'); setEndDate('2099-12-31'); }}
                  style={{
                    padding: '3px 9px', borderRadius: '5px', fontSize: '11px',
                    border: `1px solid ${startDate === '1970-01-01' ? '#3b82f6' : '#cbd5e1'}`,
                    background: startDate === '1970-01-01' ? '#3b82f6' : '#f8fafc',
                    color: startDate === '1970-01-01' ? 'white' : '#475569',
                    fontWeight: startDate === '1970-01-01' ? 700 : 500, cursor: 'pointer'
                  }}>All Time</button>
                {fyList.slice(0, 6).map(f => {
                  const active = startDate === f.start && endDate === f.end;
                  return (
                    <button key={f.label} onClick={() => { setStartDate(f.start); setEndDate(f.end); }}
                      style={{
                        padding: '3px 9px', borderRadius: '5px', fontSize: '11px',
                        border: `1px solid ${active ? '#3b82f6' : '#cbd5e1'}`,
                        background: active ? '#3b82f6' : '#f8fafc',
                        color: active ? 'white' : '#475569',
                        fontWeight: active ? 700 : 500, cursor: 'pointer'
                      }}>FY {f.label}</button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['From', 'To'] as const).map((lbl, i) => (
                  <div key={lbl} style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>{lbl}</label>
                    <input type="date"
                      value={i === 0 ? startDate : endDate}
                      onChange={e => i === 0 ? setStartDate(e.target.value) : setEndDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio */}
            <div style={{ marginBottom: '14px' }}>
              <span style={label}>Portfolio</span>
              <div style={{ position: 'relative' }}>
                <select style={select} value={selectedPortId} onChange={e => setSelectedPortId(e.target.value)}>
                  <option value="all">All Portfolios</option>
                  {allPortfolios.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.portfolioName || p.investor_name}</option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* Asset Type */}
            <div style={{ marginBottom: '14px' }}>
              <span style={label}>Select Asset Type</span>
              <div style={{ position: 'relative' }}>
                <select style={select} value={assetType} onChange={e => setAssetType(e.target.value)}>
                  {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* Capital Gain Type */}
            <div style={{ marginBottom: '14px' }}>
              <span style={label}>Capital Gain Type</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['All', 'STCG', 'LTCG'] as const).map(g => (
                  <div key={g} onClick={() => setGainType(g)} style={radioRow(gainType === g)}>{g}</div>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <span style={label}>Sort Type</span>
                <div style={{ position: 'relative' }}>
                  <select style={select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    {['Name', 'Sale Amount', 'Gain/Loss'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <span style={label}>Sort Direction</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['asc', 'desc'] as const).map(d => (
                    <div key={d} onClick={() => setSortDir(d)} style={radioRow(sortDir === d)}>
                      {d === 'asc' ? 'Ascending' : 'Descending'}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate}
              style={{
                width: '100%', padding: '13px', fontSize: '14px', fontWeight: 700,
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
                letterSpacing: '0.02em'
              }}>
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

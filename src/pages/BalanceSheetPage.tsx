import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateBS, calculateGroupTotal, getStoredLedgers, getStoredGroups, getStoredVouchers, getStoredEntries, type Ledger, type Group, type Voucher, type Entry } from '../logic';
import { ChevronRight } from 'lucide-react';

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ assets: number; liabilities: number; profit: number } | null>(null);

  useEffect(() => {
    setData(generateBS());
  }, []);

  if (!data) return <div className="p-6">Loading...</div>;

  const isEmpty = data.assets === 0 && data.liabilities === 0 && data.profit === 0;
  if (isEmpty) {
    return (
      <div className="page-container" style={{ padding: '4rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No Financial Data</h1>
        <p style={{ color: '#666' }}>Your Balance Sheet is currently empty. Please add some vouchers to see your financial position.</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>Balance Sheet</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>Final Financial Position (Drill-down enabled)</p>
      </div>

      <div className="bs-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '2rem',
        alignItems: 'start'
      }}>
        
        {/* LIABILITIES SIDE */}
        <div className="bs-card card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', background: '#fafafa' }}>
            <h2 style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>Liabilities</h2>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>Amount (₹)</span>
          </div>
          
          <div className="card-body" style={{ padding: '1rem 0' }}>
            <BSRow 
              label="Capital Account" 
              value={calculateGroupTotal('capital_account')} 
              onClick={() => navigate('/group/capital_account')}
            />
            <BSRow 
              label="Loans (Liability)" 
              value={calculateGroupTotal('loans_liability')} 
              onClick={() => navigate('/group/loans_liability')}
            />
            <BSRow 
              label="Current Liabilities" 
              value={calculateGroupTotal('current_liabilities')} 
              onClick={() => navigate('/group/current_liabilities')}
            />
            
            <div style={{ margin: '1rem 0', borderTop: '1px dashed #eee' }}></div>
            
            <BSRow 
              label="Profit & Loss A/c" 
              value={data.profit} 
              color={data.profit >= 0 ? '#10b981' : '#ef4444'}
              noArrow
            />
            
            <div style={{ marginTop: '2rem', padding: '1.25rem 1.5rem', borderTop: '2px solid #1a1a1a', background: '#f8f9fa' }}>
              <BSRow label="Total Liabilities" value={data.liabilities} bold noArrow />
            </div>
          </div>
        </div>

        {/* ASSETS SIDE */}
        <div className="bs-card card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', background: '#fafafa' }}>
            <h2 style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>Assets</h2>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>Amount (₹)</span>
          </div>
          
          <div className="card-body" style={{ padding: '1rem 0' }}>
            <BSRow label="Fixed Assets" value={calculateGroupTotal('fixed_assets')} onClick={() => navigate('/group/fixed_assets')} />
            <BSRow label="Investments" value={calculateGroupTotal('investments')} onClick={() => navigate('/group/investments')} />
            <BSRow label="Current Assets" value={calculateGroupTotal('current_assets')} onClick={() => navigate('/group/current_assets')} />
            
            {/* Fill space to align totals */}
            <div style={{ height: '2.4rem' }}></div>
            
            <div style={{ marginTop: '2.5rem', padding: '1.25rem 1.5rem', borderTop: '2px solid #1a1a1a', background: '#f8f9fa' }}>
              <BSRow label="Total Assets" value={data.assets} bold noArrow />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BSRow({ label, value, onClick, bold = false, color, noArrow = false }: { 
  label: string; 
  value: number; 
  onClick?: () => void; 
  bold?: boolean; 
  color?: string;
  noArrow?: boolean;
}) {
  return (
    <div 
      onClick={onClick}
      className={onClick ? "hover-row" : ""}
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0.6rem 1.5rem',
        fontWeight: bold ? 700 : 500,
        fontSize: bold ? '1rem' : '0.95rem',
        cursor: onClick ? 'pointer' : 'default',
        color: color || 'inherit'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{label}</span>
        {onClick && !noArrow && <ChevronRight size={12} style={{ color: '#ccc' }} />}
      </div>
      <span style={{ fontFamily: 'monospace' }}>
        {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

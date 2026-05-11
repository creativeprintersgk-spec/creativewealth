import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateBS, getStoredAccounts } from '../logic';
import { ChevronRight, Users, ArrowLeft, Printer, Download, AlertTriangle } from 'lucide-react';
import { useFamily } from '../contexts/FamilyContext';

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const { activeFamilyId } = useFamily();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [expandAll, setExpandAll] = useState(false);

  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);
  
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  useEffect(() => {
    if (selectedAccountId) {
      setData(generateBS(selectedAccountId));
    }
  }, [selectedAccountId]);

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: '14px' }}>Recalculating Financial Position...</div>
    </div>
  );

  const isBalanced = Math.abs(data.assets - data.liabilities) < 0.01;
  const diff = Math.abs(data.assets - data.liabilities);

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Balance Sheet</h1>
              {selectedAccount && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                  PERSON: {selectedAccount.accountName.toUpperCase()}
                </div>
              )}
            </div>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>Statement of Financial Position as at 31st March 2027</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Users size={18} color="#2563eb" />
            <div style={{ borderRight: '1px solid #e2e8f0', height: '20px', margin: '0 4px' }} />
            <select 
              value={selectedAccountId} 
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{ background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.accountName}</option>
              ))}
            </select>
          </div>
          <button style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', color: '#64748b' }}><Printer size={18} /></button>
        </div>
      </div>

      {!isBalanced && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.1)' }}>
          <AlertTriangle color="#e11d48" size={20} />
          <div style={{ color: '#9f1239', fontSize: '0.9rem', fontWeight: 700 }}>
            UNBALANCED BY ₹{fmt(diff)}: This person's accounting requires review.
          </div>
        </div>
      )}

      {/* Main BS Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* LIABILITIES & EQUITY */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liabilities & Equity</h3>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>AMOUNT (₹)</span>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {data.liabilityGroups.map((g: any) => (
              <BSRow key={g.id} label={g.name} value={g.total} onClick={() => navigate(`/group/${g.id}`)} />
            ))}
            <div style={{ margin: '1rem 0', borderTop: '1px dashed #e2e8f0' }} />
            <BSRow label="Net Profit / Loss" value={data.profit} color={data.profit >= 0 ? '#10b981' : '#ef4444'} />
          </div>
          <div style={{ marginTop: 'auto', padding: '1.5rem', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Total Liabilities & Equity</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{fmt(data.liabilities)}</span>
          </div>
        </div>

        {/* ASSETS */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assets</h3>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>AMOUNT (₹)</span>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {data.assetGroups.map((g: any) => (
              <BSRow key={g.id} label={g.name} value={g.total} onClick={() => navigate(`/group/${g.id}`)} />
            ))}
          </div>
          <div style={{ marginTop: 'auto', padding: '1.5rem', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Total Assets</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{fmt(data.assets)}</span>
          </div>
        </div>

      </div>

      <style>{`
        .bs-row:hover { background: #f1f5f9; }
      `}</style>
    </div>
  );
}

function BSRow({ label, value, onClick, color }: { label: string; value: number; onClick?: () => void; color?: string }) {
  return (
    <div 
      className="bs-row"
      onClick={onClick}
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.75rem 1.5rem', 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.2s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{label}</span>
        {onClick && <ChevronRight size={14} color="#cbd5e1" />}
      </div>
      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
        {Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

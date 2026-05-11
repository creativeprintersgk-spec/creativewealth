import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Calculator, Users } from 'lucide-react';
import { getTrialBalance, getStoredAccounts } from '../logic';
import { useFamily } from '../contexts/FamilyContext';

export default function TrialBalance() {
  const navigate = useNavigate();
  const { activeFamilyId } = useFamily();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const data = getTrialBalance(undefined, selectedAccountId);
  
  const totalDebit = data.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = data.reduce((sum, row) => sum + row.credit, 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01;

  const fmt = (n: number) => n === 0 ? '-' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Trial Balance</h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Mathematical verification of double-entry accounting</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <Users size={16} color="#64748b" />
            <select 
              value={selectedAccountId} 
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{ background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 600, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.accountName}</option>
              ))}
            </select>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Printer size={16} /> Print
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {!isBalanced && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>!</div>
          <div style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: 600 }}>
            System Out of Balance: Difference of ₹{fmt(diff)} detected. Check for orphaned vouchers.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>Account Group</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', width: '120px' }}>Type</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', width: '180px' }}>Debit (₹)</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', width: '180px' }}>Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {['ASSET', 'LIABILITY', 'EXPENSE', 'INCOME'].map(type => {
              const rows = data.filter(r => r.type === type);
              if (rows.length === 0) return null;
              
              return (
                <React.Fragment key={type}>
                  <tr style={{ background: '#f1f5f9' }}>
                    <td colSpan={4} style={{ padding: '0.5rem 1.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{type}S</td>
                  </tr>
                  {rows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                      <td style={{ padding: '1rem 1.5rem', cursor: 'pointer' }} onClick={() => navigate(`/ledger/${row.ledgerId}`)}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.ledgerName}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>{row.groupName}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{row.type}</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 600, color: row.debit > 0 ? '#0f172a' : '#cbd5e1' }}>
                        {fmt(row.debit)}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 600, color: row.credit > 0 ? '#0f172a' : '#cbd5e1' }}>
                        {fmt(row.credit)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#0f172a', color: '#fff' }}>
              <td colSpan={2} style={{ padding: '1.25rem 1.5rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.875rem' }}>Grand Totals</td>
              <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem' }}>{fmt(totalDebit)}</td>
              <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem' }}>{fmt(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Active Ledgers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.length} Accounts</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Verification Status</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isBalanced ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={20} /> {isBalanced ? 'Balanced' : 'Imbalanced'}
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>As of Date</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>
    </div>
  );
}

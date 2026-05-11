import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStoredLedgers, getStoredGroups, getLedgerBalance, calculateGroupTotal, getStoredAccounts } from '../logic';
import { ArrowLeft, ChevronRight, FileText, Users } from 'lucide-react';
import { useFamily } from '../contexts/FamilyContext';

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  
  const { activeFamilyId } = useFamily();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  const ledgers = getStoredLedgers();
  const groups = getStoredGroups();
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);

  const group = groups.find(item => item.id === groupId);
  const subGroups = groups.filter(g => g.parent === groupId);
  const groupLedgers = ledgers.filter(l => l.groupId === groupId);

  // Use centralized logic
  const getLedgerBal = (ledgerId: string) => getLedgerBalance(ledgerId, selectedAccountId);
  const getGroupBal = (id: string) => calculateGroupTotal(id, selectedAccountId);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ 
            background: 'white', 
            border: '1px solid #eee', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{group?.name || 'Group Details'}</h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>Drill-down: {group?.type} hierarchy</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '6px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <Users size={16} color="#2563eb" />
          <select 
            value={selectedAccountId} 
            onChange={e => setSelectedAccountId(e.target.value)}
            style={{ background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Consolidated</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.accountName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Name</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Type</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Balance</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {subGroups.length === 0 && groupLedgers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: '#999' }}>No items found in this group.</td>
              </tr>
            ) : (
              <>
                {/* Render Subgroups */}
                {subGroups.map(sg => {
                  const balance = getGroupBal(sg.id);
                  return (
                    <tr 
                      key={sg.id} 
                      style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: '#fffcf5' }} 
                      className="hover-row"
                      onClick={() => navigate(`/group/${sg.id}`)}
                    >
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '6px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                            <FileText size={14} />
                          </div>
                          <span style={{ fontWeight: 600 }}>{sg.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#666', fontSize: '0.85rem' }}>Sub-Group</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>₹ {Math.abs(balance).toLocaleString()}</div>
                        <div style={{ fontSize: '0.7rem', color: '#999' }}>{balance >= 0 ? 'DR' : 'CR'}</div>
                      </td>
                      <td style={{ paddingRight: '1rem', color: '#ccc' }}>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })}

                {/* Render Ledgers */}
                {groupLedgers.map(l => {
                  const balance = getLedgerBal(l.id);
                  return (
                    <tr 
                      key={l.id} 
                      style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }} 
                      className="hover-row"
                      onClick={() => navigate(`/ledger/${l.id}`)}
                    >
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '6px', background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <FileText size={14} />
                          </div>
                          <span style={{ fontWeight: 500 }}>{l.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#666', fontSize: '0.85rem' }}>Ledger</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>₹ {Math.abs(balance).toLocaleString()}</div>
                        <div style={{ fontSize: '0.7rem', color: '#999' }}>{balance >= 0 ? 'DR' : 'CR'}</div>
                      </td>
                      <td style={{ paddingRight: '1rem', color: '#ccc' }}>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

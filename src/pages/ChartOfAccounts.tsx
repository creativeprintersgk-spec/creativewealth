
import React, { useMemo } from 'react';
import { getStoredGroups, getStoredLedgers, calculateGroupTotal } from '../logic';
import { Layers, Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import TopNavbar from '../TopNavbar';

export default function ChartOfAccounts() {
  const groups = useMemo(() => getStoredGroups(), []);
  const ledgers = useMemo(() => getStoredLedgers(), []);

  const renderGroup = (groupId: string, depth: number = 0) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;

    const childGroups = groups.filter(g => g.parent === groupId);
    const groupLedgers = ledgers.filter(l => l.groupId === groupId);

    return (
      <div key={groupId} style={{ marginLeft: depth * 20 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '8px 0', 
          borderBottom: '1px solid #f1f5f9',
          color: depth === 0 ? '#0f172a' : '#475569',
          fontWeight: depth === 0 ? 800 : 600,
          fontSize: depth === 0 ? '14px' : '13px'
        }}>
          <Folder size={14} color={depth === 0 ? '#3b82f6' : '#94a3b8'} />
          {group.name}
        </div>
        
        {groupLedgers.map(l => (
          <div key={l.id} style={{ 
            marginLeft: 24, 
            padding: '6px 0', 
            fontSize: '12px', 
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FileText size={12} color="#cbd5e1" />
            {l.name}
          </div>
        ))}

        {childGroups.map(cg => renderGroup(cg.id, depth + 1))}
      </div>
    );
  };

  const rootGroups = groups.filter(g => !g.parent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      <TopNavbar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Chart of Accounts</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Hierarchical view of all account groups and ledgers</p>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            {['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'].map(type => (
              <div key={type}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  color: '#94a3b8', 
                  letterSpacing: '0.05em', 
                  marginBottom: '16px',
                  borderBottom: '2px solid #e2e8f0',
                  paddingBottom: '8px'
                }}>
                  {type}
                </div>
                {rootGroups.filter(g => g.type === type).map(g => renderGroup(g.id))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getStoredGroups, 
  getStoredLedgers, 
  getStoredAccounts, 
  deleteLedger, 
  type Ledger 
} from '../logic';
import { 
  Layers, 
  Folder, 
  FileText, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ExternalLink,
  X
} from 'lucide-react';
import TopNavbar from '../TopNavbar';
import LedgerModal from '../LedgerModal';
import { useFamily } from '../contexts/FamilyContext';

export default function ChartOfAccounts() {
  const navigate = useNavigate();
  const { activeFamilyId } = useFamily();
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);
  const [selectedAcid, setSelectedAcid] = useState<string>(accounts[0]?.id || '');
  const [syncVersion, setSyncVersion] = useState(0);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | undefined>(undefined);
  const [selectedGroupIdForNew, setSelectedGroupIdForNew] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync event listener to auto-refresh state
  useEffect(() => {
    const handleSync = () => setSyncVersion(v => v + 1);
    window.addEventListener('wealthcore-sync-complete', handleSync);
    return () => window.removeEventListener('wealthcore-sync-complete', handleSync);
  }, []);

  // Sync selectedAcid when accounts change
  useEffect(() => {
    if (accounts.length > 0 && (!selectedAcid || !accounts.some(a => String(a.id) === String(selectedAcid)))) {
      setSelectedAcid(String(accounts[0].id));
    }
  }, [accounts, selectedAcid]);

  // Always filter by acid so each person's COA is clean and duplicate-free
  const groups  = useMemo(() => getStoredGroups(selectedAcid),  [selectedAcid, syncVersion]);
  const ledgers = useMemo(() => getStoredLedgers(selectedAcid), [selectedAcid, syncVersion]);

  // Handle open modal for new ledger
  const handleOpenNew = (groupId?: string) => {
    setEditingLedger(undefined);
    setSelectedGroupIdForNew(groupId);
    setShowModal(true);
  };

  // Handle open modal for editing ledger
  const handleOpenEdit = (e: React.MouseEvent, ledger: Ledger) => {
    e.stopPropagation();
    setEditingLedger(ledger);
    setSelectedGroupIdForNew(undefined);
    setShowModal(true);
  };

  // Handle deleting a ledger
  const handleDeleteLedger = async (e: React.MouseEvent, ledger: Ledger) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ledger "${ledger.name}"?`)) {
      return;
    }

    try {
      const ok = await deleteLedger(ledger.id, Number(selectedAcid));
      if (ok) {
        setFeedbackMsg({ text: `Ledger "${ledger.name}" deleted successfully.`, type: 'success' });
        setSyncVersion(v => v + 1);
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else {
        setFeedbackMsg({ text: `Could not find ledger to delete.`, type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err?.message || 'Failed to delete ledger.', type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const q = searchQuery.trim().toLowerCase();

  const groupMatchesSearch = (groupId: string): boolean => {
    if (!q) return true;
    const group = groups.find(g => g.id === groupId);
    if (!group) return false;
    if (group.name.toLowerCase().includes(q)) return true;
    const groupLedgers = ledgers.filter(l => l.groupId === groupId);
    if (groupLedgers.some(l => l.name.toLowerCase().includes(q))) return true;
    const childGroups = groups.filter(g => g.parent === groupId);
    return childGroups.some(cg => groupMatchesSearch(cg.id));
  };

  const renderGroup = (groupId: string, depth: number = 0): React.ReactElement | null => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;

    if (q && !groupMatchesSearch(groupId)) return null;

    const childGroups = groups.filter(g => g.parent === groupId);
    const groupLedgers = ledgers.filter(l => l.groupId === groupId && (!q || l.name.toLowerCase().includes(q) || group.name.toLowerCase().includes(q)));

    // Key uses id + acid to guarantee uniqueness (same id exists across all persons)
    const key = `${groupId}_${(group as any).acid || selectedAcid}`;

    return (
      <div key={key} style={{ marginLeft: depth * 16, marginBottom: 4 }}>
        <div 
          className="group-row"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '6px 8px', 
            borderRadius: '6px',
            borderBottom: '1px solid #f1f5f9',
            color: depth === 0 ? '#0f172a' : '#334155',
            fontWeight: depth === 0 ? 800 : 600,
            fontSize: depth === 0 ? '13px' : '12px',
            background: depth === 0 ? '#f8fafc' : 'transparent',
            transition: 'background 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={14} color={depth === 0 ? '#2563eb' : '#64748b'} />
            <span>{group.name}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
              ({ledgers.filter(l => l.groupId === groupId).length})
            </span>
          </div>

          <button
            onClick={() => handleOpenNew(group.id)}
            title={`Add Ledger under ${group.name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              background: 'rgba(59, 130, 246, 0.08)',
              color: '#2563eb',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={11} /> Add
          </button>
        </div>
        
        {groupLedgers.map(l => (
          <div 
            key={`${l.id}_${(l as any).acid || selectedAcid}`} 
            style={{ 
              marginLeft: 20, 
              padding: '6px 8px', 
              fontSize: '12px', 
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '6px',
              transition: 'background 0.15s ease'
            }}
            className="ledger-row"
          >
            <div 
              onClick={() => navigate(`/ledger/${l.id}`)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer',
                flex: 1,
                minWidth: 0
              }}
              title="Click to view ledger details"
            >
              <FileText size={12} color="#94a3b8" />
              <span style={{ 
                fontWeight: 500, 
                color: '#1e293b', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {l.name}
              </span>
              {l.openingBalance ? (
                <span style={{ 
                  fontSize: '10px', 
                  color: '#64748b', 
                  background: '#f1f5f9', 
                  padding: '1px 5px', 
                  borderRadius: '4px',
                  marginLeft: '4px' 
                }}>
                  ₹{Math.abs(l.openingBalance).toLocaleString()} {l.openingType}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={(e) => handleOpenEdit(e, l)}
                title="Edit Ledger"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '3px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => handleDeleteLedger(e, l)}
                title="Delete Ledger"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '3px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px' }}>
        {/* Header Bar */}
        <div style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px' 
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={22} color="#2563eb" />
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Chart of Accounts
              </h1>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
              Manage and organize ledger accounts, hierarchical groups, and opening balances
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search Box */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: '#fff', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px', 
              padding: '6px 12px',
              gap: '6px',
              width: 220
            }}>
              <Search size={14} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search ledgers/groups..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ 
                  border: 'none', 
                  outline: 'none', 
                  fontSize: '12px', 
                  width: '100%',
                  background: 'transparent'
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Member Account Selector */}
            <select
              value={selectedAcid}
              onChange={e => setSelectedAcid(e.target.value)}
              style={{ 
                padding: '8px 14px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0', 
                fontSize: '13px', 
                fontWeight: 600, 
                color: '#0f172a', 
                background: '#fff', 
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.accountName}
                </option>
              ))}
            </select>

            {/* + New Ledger Button */}
            <button
              className="btn-primary"
              onClick={() => handleOpenNew()}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> New Ledger
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div style={{
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 500,
            background: feedbackMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedbackMsg.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`
          }}>
            {feedbackMsg.text}
          </div>
        )}

        {/* Chart of Accounts Grid */}
        <div className="card" style={{ padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
            {(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'] as const).map(type => {
              const typeRootGroups = rootGroups.filter(g => g.type === type);
              const totalTypeLedgers = ledgers.filter(l => {
                const grp = groups.find(g => g.id === l.groupId);
                return grp?.type === type;
              }).length;

              const badgeBg = type === 'ASSET' ? '#eff6ff' : type === 'LIABILITY' ? '#fef3c7' : type === 'INCOME' ? '#ecfdf5' : '#fef2f2';
              const badgeColor = type === 'ASSET' ? '#2563eb' : type === 'LIABILITY' ? '#d97706' : type === 'INCOME' ? '#059669' : '#dc2626';

              return (
                <div key={type} style={{ background: '#fafbfc', padding: '16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                    borderBottom: '2px solid #e2e8f0',
                    paddingBottom: '8px'
                  }}>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: 800, 
                      color: '#475569', 
                      letterSpacing: '0.05em'
                    }}>
                      {type}
                    </span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      background: badgeBg, 
                      color: badgeColor,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {totalTypeLedgers} Ledgers
                    </span>
                  </div>
                  {typeRootGroups.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                      No groups found.
                    </div>
                  ) : (
                    typeRootGroups.map(g => renderGroup(g.id))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ledger Creation / Editing Modal */}
      {showModal && (
        <LedgerModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setSyncVersion(v => v + 1);
            setFeedbackMsg({
              text: editingLedger ? `Ledger "${editingLedger.name}" updated successfully.` : `New ledger created successfully.`,
              type: 'success'
            });
            setTimeout(() => setFeedbackMsg(null), 4000);
          }}
          initialLedger={editingLedger}
          accountId={selectedAcid}
          initialGroupId={selectedGroupIdForNew}
        />
      )}
    </div>
  );
}

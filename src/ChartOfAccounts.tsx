import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Folder, FileText, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Search, X, ExternalLink } from "lucide-react";
import { type Ledger, deleteLedger } from "./logic";
import LedgerModal from "./LedgerModal";
import { getStoredGroups, getStoredLedgers, getStoredAccounts } from "./logic";
import { useFamily } from "./contexts/FamilyContext";

export default function ChartOfAccounts() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeFamilyId } = useFamily();
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts.length > 0 ? accounts[0].id : "");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set<string>());
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = () => {
    setLoading(true);
    const targetAcid = selectedAccountId || (accounts.length > 0 ? accounts[0].id : undefined);
    const g = getStoredGroups(targetAcid);
    const l = getStoredLedgers(targetAcid);
    setGroups(g);
    setLedgers(l);
    setExpandedGroups(new Set(g.map((gr: any) => gr.id)));
    setLoading(false);
  };

  useEffect(() => {
    if (accounts.length > 0 && (!selectedAccountId || !accounts.some(a => a.id === selectedAccountId))) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    loadData();
  }, [selectedAccountId]);

  // Sync event listener to auto-refresh state
  useEffect(() => {
    const handleSync = () => loadData();
    window.addEventListener('wealthcore-sync-complete', handleSync);
    return () => window.removeEventListener('wealthcore-sync-complete', handleSync);
  }, [selectedAccountId]);

  const refreshData = () => {
    loadData();
  };

  const toggleGroup = (id: string) => {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGroups(next);
  };

  const selectedGroupName = selectedGroupId 
    ? groups.find(g => g.id === selectedGroupId)?.name 
    : "All Accounts";

  const q = searchQuery.trim().toLowerCase();

  const filteredLedgers = useMemo(() => {
    let base = selectedGroupId 
      ? ledgers.filter(l => l.groupId === selectedGroupId)
      : ledgers;

    if (q) {
      base = base.filter(l => l.name.toLowerCase().includes(q));
    }
    return base;
  }, [ledgers, selectedGroupId, q]);

  const handleDeleteLedger = async (l: Ledger) => {
    if (window.confirm(`Are you sure you want to delete ledger "${l.name}"?`)) {
      try {
        const ok = await deleteLedger(l.id, Number(selectedAccountId));
        if (ok) {
          setFeedback({ text: `Ledger "${l.name}" deleted successfully.`, type: 'success' });
          refreshData();
          setTimeout(() => setFeedback(null), 4000);
        } else {
          setFeedback({ text: `Could not find ledger to delete.`, type: 'error' });
        }
      } catch (err: any) {
        setFeedback({ text: err?.message || 'Failed to delete ledger.', type: 'error' });
        setTimeout(() => setFeedback(null), 5000);
      }
    }
  };

  const handleOpenNewLedger = (groupId?: string) => {
    setEditingLedger(undefined);
    if (groupId) {
      setSelectedGroupId(groupId);
    }
    setShowLedgerModal(true);
  };

  const renderGroupTree = (parentId?: string, level = 0) => {
    return groups
      .filter(g => g.parent === parentId)
      .map(group => {
        const hasChildren = groups.some(g => g.parent === group.id);
        const isExpanded = expandedGroups.has(group.id);
        const isSelected = selectedGroupId === group.id;
        const count = ledgers.filter(l => l.groupId === group.id).length;

        return (
          <div key={group.id} style={{ marginLeft: level * 14 }}>
            <div 
              className={`group-tree-item ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedGroupId(group.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                color: isSelected ? 'hsl(213, 94%, 55%)' : 'hsl(222, 47%, 25%)',
                background: isSelected ? 'hsl(213, 94%, 95%)' : 'transparent',
                fontWeight: isSelected ? 700 : 500,
                marginBottom: '2px',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }} 
                  style={{ display: 'flex', alignItems: 'center', padding: '2px' }}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                  ) : (
                    <div style={{ width: 13 }} />
                  )}
                </div>
                <Folder size={14} color={isSelected ? '#2563eb' : '#64748b'} fill={isSelected ? 'rgba(37,99,235,0.2)' : 'transparent'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: isSelected ? '#2563eb' : '#94a3b8', fontWeight: 600 }}>
                  {count}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNewLedger(group.id);
                  }}
                  title={`Add Ledger to ${group.name}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isSelected ? '#2563eb' : '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex'
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            {hasChildren && isExpanded && renderGroupTree(group.id, level + 1)}
          </div>
        );
      });
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading accounts...</div>;
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)', padding: '20px' }}>
      {/* LEFT: GROUP TREE */}
      <div className="card" style={{ width: '320px', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Account Groups
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
              {groups.length} Groups
            </span>
          </div>
          <select 
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{ 
              padding: '6px 10px', 
              borderRadius: '6px', 
              border: '1px solid #cbd5e1', 
              fontSize: '13px', 
              fontWeight: 600, 
              color: '#0f172a',
              outline: 'none',
              background: '#f8fafc' 
            }}
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          <div 
            className={`group-tree-item ${!selectedGroupId ? 'active' : ''}`}
            onClick={() => setSelectedGroupId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              color: !selectedGroupId ? 'hsl(213, 94%, 55%)' : 'hsl(222, 47%, 25%)',
              background: !selectedGroupId ? 'hsl(213, 94%, 95%)' : 'transparent',
              fontWeight: !selectedGroupId ? 700 : 500,
              marginBottom: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={15} fill={!selectedGroupId ? 'hsl(213, 94%, 55%)' : 'transparent'} />
              <span>All Accounts</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: !selectedGroupId ? '#2563eb' : '#94a3b8' }}>
              {ledgers.length}
            </span>
          </div>
          {renderGroupTree()}
        </div>
      </div>

      {/* RIGHT: LEDGERS */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
              {selectedGroupName}
            </span>
            <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              {filteredLedgers.length} {filteredLedgers.length === 1 ? 'ledger' : 'ledgers'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 10px', gap: '6px', width: 200 }}>
              <Search size={13} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search ledgers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={() => handleOpenNewLedger(selectedGroupId || undefined)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
            >
              <Plus size={15} /> New Ledger
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div style={{
            margin: '12px 20px 0 20px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`
          }}>
            {feedback.text}
          </div>
        )}
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '8px 10px' }}>Ledger Name</th>
                <th style={{ padding: '8px 10px' }}>Group</th>
                <th style={{ padding: '8px 10px' }}>Opening Balance</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedgers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '13px' }}>
                    {searchQuery ? `No ledgers matching "${searchQuery}".` : 'No ledgers found in this group.'}
                  </td>
                </tr>
              ) : (
                filteredLedgers.map(l => {
                  const grp = groups.find(g => g.id === l.groupId);
                  return (
                    <tr 
                      key={l.id} 
                      className="ledger-table-row"
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                    >
                      <td style={{ padding: '10px' }}>
                        <div 
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                          onClick={() => navigate(`/ledger/${l.id}`)}
                          title="Click to view ledger transactions"
                        >
                          <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <FileText size={14} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{l.name}</span>
                              <ExternalLink size={11} color="#94a3b8" />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px', fontSize: '12px', color: '#64748b' }}>
                        {grp?.name || l.groupId}
                      </td>
                      <td style={{ padding: '10px', fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                        {l.openingBalance ? (
                          <span>
                            ₹{Math.abs(l.openingBalance).toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{l.openingType}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>₹0.00</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                            onClick={() => { setEditingLedger(l); setShowLedgerModal(true); }}
                            title="Edit Ledger"
                          >
                            <Edit2 size={12} color="#475569" />
                          </button>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #fee2e2', background: '#fff', cursor: 'pointer' }}
                            onClick={() => handleDeleteLedger(l)}
                            title="Delete Ledger"
                          >
                            <Trash2 size={12} color="#dc2626" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showLedgerModal && (
        <LedgerModal 
          onClose={() => setShowLedgerModal(false)} 
          onSaved={() => { 
            setShowLedgerModal(false); 
            refreshData(); 
            setFeedback({
              text: editingLedger ? `Ledger "${editingLedger.name}" updated successfully.` : `New ledger created successfully.`,
              type: 'success'
            });
            setTimeout(() => setFeedback(null), 4000);
          }}
          initialLedger={editingLedger}
          accountId={selectedAccountId}
          initialGroupId={selectedGroupId || undefined}
        />
      )}
    </div>
  );
}

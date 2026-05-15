import { useState, useEffect } from "react";
import { Folder, FileText, Plus, Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { type Ledger, deleteLedger } from "./logic";
import LedgerModal from "./LedgerModal";
import { getStoredGroups, getStoredLedgers } from "./logic";

export default function ChartOfAccounts() {
  const [groups, setGroups] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set<string>());

  const loadData = async () => {
    setLoading(true);
    const g = getStoredGroups();
    const l = getStoredLedgers();
    console.log("✅ Loaded groups:", g.length);
    console.log("UI groups count:", g.length);
    setGroups(g);
    setLedgers(l);
    setExpandedGroups(new Set(g.map((gr: any) => gr.id)));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = () => {
    loadData();
  };

  const toggleGroup = (id: string) => {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGroups(next);
  };

  const selectedGroupLedgers = selectedGroupId 
    ? ledgers.filter(l => l.groupId === selectedGroupId)
    : ledgers;

  const selectedGroupName = selectedGroupId 
    ? groups.find(g => g.id === selectedGroupId)?.name 
    : "All Accounts";

  const handleDeleteLedger = (id: string) => {
    if (window.confirm("Are you sure you want to delete this ledger?")) {
      deleteLedger(id);
      refreshData();
    }
  };

  const renderGroupTree = (parentId?: string, level = 0) => {
    return groups
      .filter(g => g.parent === parentId)
      .map(group => {
        const hasChildren = groups.some(g => g.parent === group.id);
        const isExpanded = expandedGroups.has(group.id);
        const isSelected = selectedGroupId === group.id;

        return (
          <div key={group.id} style={{ marginLeft: level * 16 }}>
            <div 
              className={`group-tree-item ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedGroupId(group.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                color: isSelected ? 'hsl(213, 94%, 55%)' : 'hsl(222, 47%, 25%)',
                background: isSelected ? 'hsl(213, 94%, 95%)' : 'transparent',
                fontWeight: isSelected ? 600 : 500,
                marginBottom: '2px'
              }}
            >
              <div onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }} style={{ display: 'flex', alignItems: 'center' }}>
                {hasChildren ? (
                  isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                ) : (
                  <div style={{ width: 14 }} />
                )}
              </div>
              <Folder size={14} fill={isSelected ? 'hsl(213, 94%, 55%)' : 'transparent'} />
              <span>{group.name}</span>
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
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 160px)' }}>
      {/* LEFT: GROUP TREE */}
      <div className="card" style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid hsl(220, 15%, 90%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' }}>Groups</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div 
            className={`group-tree-item ${!selectedGroupId ? 'active' : ''}`}
            onClick={() => setSelectedGroupId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              color: !selectedGroupId ? 'hsl(213, 94%, 55%)' : 'hsl(222, 47%, 25%)',
              background: !selectedGroupId ? 'hsl(213, 94%, 95%)' : 'transparent',
              fontWeight: !selectedGroupId ? 600 : 500,
              marginBottom: '8px'
            }}
          >
            <Folder size={14} fill={!selectedGroupId ? 'hsl(213, 94%, 55%)' : 'transparent'} />
            <span>All Accounts</span>
          </div>
          {renderGroupTree()}
        </div>
      </div>

      {/* RIGHT: LEDGERS */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid hsl(220, 15%, 90%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' }}>
              {selectedGroupName}
            </span>
          </div>
          <button className="btn-primary" onClick={() => { setEditingLedger(undefined); setShowLedgerModal(true); }}>
            <Plus size={14} /> New Ledger
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th>Opening Bal</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedGroupLedgers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-state">No ledgers in this group.</td>
                </tr>
              ) : (
                selectedGroupLedgers.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'hsl(220, 20%, 96%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(220, 9%, 60%)' }}>
                          <FileText size={14} />
                        </div>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                      </div>
                    </td>
                    <td>{l.openingBalance.toLocaleString()} {l.openingType}</td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px' }}
                          onClick={() => { setEditingLedger(l); setShowLedgerModal(true); }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', color: 'hsl(0, 84%, 60%)' }}
                          onClick={() => handleDeleteLedger(l.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showLedgerModal && (
        <LedgerModal 
          onClose={() => setShowLedgerModal(false)} 
          onSaved={() => { setShowLedgerModal(false); refreshData(); }}
          initialLedger={editingLedger}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import { type Ledger, getStoredGroups, saveLedger, getStoredLedgers } from "./logic";

export default function LedgerModal({
  onClose,
  onSaved,
  initialLedger
}: {
  onClose: () => void;
  onSaved?: () => void;
  initialLedger?: Ledger;
}) {
  const groups = getStoredGroups();
  const [name, setName] = useState(initialLedger?.name || "");
  const [groupId, setGroupId] = useState(initialLedger?.groupId || (groups.length > 0 ? groups[0].id : ""));
  const [openingBalance, setOpeningBalance] = useState(initialLedger?.openingBalance.toString() || "0");
  const [openingType, setOpeningType] = useState<"DR" | "CR">(initialLedger?.openingType || "DR");
  const [error, setError] = useState("");

  const selectedGroup = groups.find(g => g.id === groupId);
  const nature = selectedGroup?.type || "";

    async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("Ledger name is required");
      return;
    }

    const ledgers = getStoredLedgers();
    if (!initialLedger && ledgers.some(l => l.name.toLowerCase() === name.trim().toLowerCase())) {
      setError("Ledger already exists");
      return;
    }
    if (initialLedger && ledgers.some(l => l.name.toLowerCase() === name.trim().toLowerCase() && l.id !== initialLedger.id)) {
      setError("Ledger name already exists");
      return;
    }

    const numBal = parseFloat(openingBalance) || 0;

    const newLedger: Ledger = {
      id: initialLedger ? initialLedger.id : Date.now().toString(),
      name: name.trim(),
      groupId: groupId,
      openingBalance: numBal,
      openingType: openingType,
      currentBalance: initialLedger ? initialLedger.currentBalance : numBal,
      currentType: initialLedger ? initialLedger.currentType : openingType
    };

    await saveLedger(newLedger);
    
    if (onSaved) onSaved();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 400 }}>
        <div className="modal-header">
          <div className="modal-title">
            <BookOpen size={15} color="hsl(213, 94%, 55%)" />
            {initialLedger ? "Edit Ledger" : "New Ledger"}
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={13} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 15 }}>
            <label className="form-label">Ledger Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. HDFC Bank" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              autoFocus 
            />
          </div>

          <div className="form-group" style={{ marginBottom: 15 }}>
            <label className="form-label">Group</label>
            <select 
              className="form-input" 
              value={groupId} 
              onChange={e => setGroupId(e.target.value)}
            >
              {groups.map(g => {
                const isChild = !!g.parent;
                return (
                  <option key={g.id} value={g.id}>
                    {isChild ? `\u00A0\u00A0\u00A0\u00A0→ ${g.name}` : g.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 15, background: "hsl(220, 20%, 97%)", padding: 10, borderRadius: 6, border: "1px solid hsl(220, 15%, 90%)" }}>
            <label className="form-label" style={{ fontSize: 11, color: "hsl(220, 9%, 46%)" }}>Auto-assigned Nature</label>
            <div style={{ fontWeight: 600, fontSize: 13, color: "hsl(222, 47%, 25%)" }}>
              {nature}
            </div>
          </div>

          <div style={{ display: "flex", gap: 15, marginBottom: 15 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Opening Balance</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0.00" 
                value={openingBalance} 
                onChange={e => setOpeningBalance(e.target.value)} 
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Type</label>
              <select 
                className="form-input" 
                value={openingType} 
                onChange={e => setOpeningType(e.target.value as "DR" | "CR")}
              >
                <option value="DR">Dr</option>
                <option value="CR">Cr</option>
              </select>
            </div>
          </div>

          {error && <div style={{ color: "hsl(0, 84%, 55%)", fontSize: 12 }}>⚠ {error}</div>}
        </div>

        <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

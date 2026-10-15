import { useState, useMemo, useEffect } from "react";
import { BookOpen, X, Check, AlertCircle } from "lucide-react";
import { type Ledger, getStoredGroups, saveLedger, getStoredLedgers, getStoredAccounts } from "./logic";

export default function LedgerModal({
  onClose,
  onSaved,
  initialLedger,
  accountId,
  initialGroupId
}: {
  onClose: () => void;
  onSaved?: () => void;
  initialLedger?: Ledger;
  accountId?: string;
  initialGroupId?: string;
}) {
  const accounts = getStoredAccounts();
  const [selectedAcid, setSelectedAcid] = useState<string>(() => {
    if (initialLedger?.acid) return String(initialLedger.acid);
    if (accountId) return String(accountId);
    return accounts.length > 0 ? String(accounts[0].id) : "31";
  });

  const groups = useMemo(() => getStoredGroups(selectedAcid), [selectedAcid]);

  const [name, setName] = useState(initialLedger?.name || "");
  const [groupId, setGroupId] = useState<string>(() => {
    if (initialLedger?.groupId) return String(initialLedger.groupId);
    if (initialGroupId && groups.some(g => g.id === initialGroupId)) return initialGroupId;
    const bankGroup = groups.find(g => g.id === "60" || g.name.toLowerCase().includes("bank"));
    if (bankGroup) return bankGroup.id;
    return groups.length > 0 ? groups[0].id : "60";
  });

  // If initialGroupId or groups change, keep groupId valid
  useEffect(() => {
    if (initialLedger?.groupId) {
      setGroupId(String(initialLedger.groupId));
    } else if (initialGroupId && groups.some(g => g.id === initialGroupId)) {
      setGroupId(initialGroupId);
    } else if (!groups.some(g => g.id === groupId) && groups.length > 0) {
      const bankGroup = groups.find(g => g.id === "60" || g.name.toLowerCase().includes("bank"));
      setGroupId(bankGroup ? bankGroup.id : groups[0].id);
    }
  }, [groups, initialGroupId, initialLedger]);

  const [openingBalance, setOpeningBalance] = useState(
    initialLedger?.openingBalance !== undefined ? String(initialLedger.openingBalance) : "0"
  );
  const [openingType, setOpeningType] = useState<"DR" | "CR">(initialLedger?.openingType || "DR");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Group options hierarchically and categorized by Type
  const groupedOptions = useMemo(() => {
    const types = ["ASSET", "LIABILITY", "INCOME", "EXPENSE"];
    return types.map(type => {
      const typeGroups = groups.filter(g => g.type === type);
      const roots = typeGroups.filter(g => !g.parent);
      const flatList: Array<{ id: string; name: string; isChild: boolean }> = [];

      function addGroupWithChildren(parentGroup: typeof groups[0], level: number) {
        flatList.push({
          id: parentGroup.id,
          name: level > 0 ? `${"\u00A0".repeat(level * 4)}↳ ${parentGroup.name}` : parentGroup.name,
          isChild: level > 0
        });
        const children = typeGroups.filter(g => g.parent === parentGroup.id);
        children.forEach(c => addGroupWithChildren(c, level + 1));
      }

      roots.forEach(r => addGroupWithChildren(r, 0));
      typeGroups.forEach(g => {
        if (!flatList.some(item => item.id === g.id)) {
          flatList.push({ id: g.id, name: g.name, isChild: !!g.parent });
        }
      });

      return { type, items: flatList };
    }).filter(t => t.items.length > 0);
  }, [groups]);

  const selectedGroup = groups.find(g => g.id === groupId);
  const nature = selectedGroup?.type || "ASSET";

  async function handleSave() {
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Ledger name is required.");
      return;
    }

    const currentAcidLedgers = getStoredLedgers(selectedAcid);
    if (!initialLedger && currentAcidLedgers.some(l => l.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError(`A ledger named "${trimmedName}" already exists for this member.`);
      return;
    }
    if (initialLedger && currentAcidLedgers.some(l => l.name.toLowerCase() === trimmedName.toLowerCase() && String(l.id) !== String(initialLedger.id))) {
      setError(`A ledger named "${trimmedName}" already exists for this member.`);
      return;
    }

    const numBal = parseFloat(openingBalance) || 0;

    setIsSaving(true);
    try {
      await saveLedger({
        id: initialLedger ? initialLedger.id : undefined,
        name: trimmedName,
        groupId: groupId,
        acid: selectedAcid,
        openingBalance: numBal,
        openingType: openingType
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save ledger.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedAccountName = accounts.find(a => String(a.id) === String(selectedAcid))?.accountName || `Account #${selectedAcid}`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 440, maxWidth: "95vw" }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: 6, borderRadius: 6, display: "flex" }}>
              <BookOpen size={16} color="#2563eb" />
            </div>
            {initialLedger ? "Edit Ledger Account" : "Create New Ledger Account"}
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "16px 20px" }}>
          {/* Member / Account display or selector */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: "#475569" }}>
              Member Account
            </label>
            {initialLedger ? (
              <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                {selectedAccountName}
              </div>
            ) : (
              <select
                className="form-input"
                value={selectedAcid}
                onChange={e => setSelectedAcid(e.target.value)}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.accountName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: "#475569" }}>
              Ledger Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. HDFC Bank - 0023, Electricity Expense, Sundry Debtor" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              autoFocus 
              style={{ fontSize: 13, fontWeight: 500 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: "#475569" }}>
              Parent Group <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select 
              className="form-input" 
              value={groupId} 
              onChange={e => setGroupId(e.target.value)}
              style={{ fontSize: 13 }}
            >
              {groupedOptions.map(section => (
                <optgroup key={section.type} label={`── ${section.type} ──`}>
                  {section.items.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 14, background: "#f8fafc", padding: "10px 14px", borderRadius: 6, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Nature / Classification:</span>
            <span style={{ 
              fontWeight: 700, 
              fontSize: 12, 
              padding: "2px 8px", 
              borderRadius: 4, 
              background: nature === "ASSET" ? "#eff6ff" : nature === "LIABILITY" ? "#fef3c7" : nature === "INCOME" ? "#ecfdf5" : "#fef2f2",
              color: nature === "ASSET" ? "#2563eb" : nature === "LIABILITY" ? "#d97706" : nature === "INCOME" ? "#059669" : "#dc2626"
            }}>
              {nature}
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: "#475569" }}>
                Opening Balance
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0.00" 
                value={openingBalance} 
                onChange={e => setOpeningBalance(e.target.value)} 
                step="any"
                style={{ fontSize: 13 }}
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: "#475569" }}>
                Dr / Cr
              </label>
              <select 
                className="form-input" 
                value={openingType} 
                onChange={e => setOpeningType(e.target.value as "DR" | "CR")}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                <option value="DR">Dr (Debit)</option>
                <option value="CR">Cr (Credit)</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginTop: 10, border: "1px solid #fee2e2" }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 10, padding: "12px 20px" }}>
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={isSaving}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Check size={14} />
            {isSaving ? "Saving..." : initialLedger ? "Update Ledger" : "Create Ledger"}
          </button>
        </div>
      </div>
    </div>
  );
}

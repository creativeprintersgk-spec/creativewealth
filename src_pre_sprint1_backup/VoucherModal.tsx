import { X, Trash2, Save, Copy } from "lucide-react";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  createVoucher,
  updateVoucher,
  deleteVoucher,
  getVoucherById,
  getStoredLedgers,
  getStoredGroups,
  getNextVoucherNo,
  getLedgerWithBalance,
  getStoredAccounts,
  type VoucherLine
} from "./logic";
import VoucherGrid from "./components/VoucherGrid";
import { v4 as uuid } from "uuid";
import { useFY } from "./FYContext";
import { useFamily } from "./contexts/FamilyContext";
import { useTestMode } from "./contexts/TestModeContext";

type VoucherType = "payment" | "receipt" | "journal" | "contra" | "purchase" | "sale" | "dividend";

const VOUCHER_TYPES: { key: VoucherType; label: string; short: string; color: string }[] = [
  { key: "receipt",  label: "Receipt",  short: "RCPT", color: "#059669" },
  { key: "payment",  label: "Payment",  short: "PAY",  color: "#dc2626" },
  { key: "journal",  label: "Journal",  short: "JRN",  color: "#7c3aed" },
  { key: "contra",   label: "Contra",   short: "CON",  color: "#0284c7" },
  { key: "purchase", label: "Purchase", short: "PUR",  color: "#3b82f6" },
  { key: "sale",     label: "Sale",     short: "SAL",  color: "#f59e0b" },
  { key: "dividend", label: "Dividend", short: "DIV",  color: "#ec4899" },
];

export default function VoucherModal({
  onClose,
  onSaved,
  voucherId,
  selectedLedger,
  accountId: propAccountId,
}: {
  onClose: () => void;
  onSaved?: () => void;
  voucherId?: string;
  selectedLedger?: string;
  accountId?: string;
}) {
  const { selectedFY } = useFY();
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<VoucherType>("receipt");
  const [voucherNo, setVoucherNo] = useState("");
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<string>(propAccountId || "");
  const [narration, setNarration] = useState("");
  const { isTestMode } = useTestMode();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Simple mode (payment/receipt)
  const [simpleAccount, setSimpleAccount] = useState("");
  const [simpleAmount, setSimpleAmount] = useState("");
  const [simpleQuantity, setSimpleQuantity] = useState("");
  const [simplePrice, setSimplePrice] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([]);

  const { activeFamilyId } = useFamily();
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);

  const groups = getStoredGroups();

  // Only load ledgers for the currently selected accountId person.
  // This prevents duplicate names (e.g. "Gift" appearing for every family member)
  // and makes the dropdown fast — no more scanning 5000+ rows.
  const mappedLedgers = useMemo(() => {
    // Use propAccountId if passed from parent, else the locally selected accountId state.
    // We also deduplicate by name (same ledger name should not appear twice for same person).
    const effectiveAcid = propAccountId || accountId;
    const raw = effectiveAcid ? getStoredLedgers(effectiveAcid) : getStoredLedgers();
    
    const seen = new Set<string>();
    const unique: typeof raw = [];
    for (const l of raw) {
      const lowerName = l.name.toLowerCase().trim();
      if (!seen.has(lowerName)) {
        seen.add(lowerName);
        unique.push(l);
      }
    }

    return unique.map(l => ({
      id: l.id,
      name: l.name,
      type: l.name.toLowerCase().includes("bank")
        ? "bank"
        : l.name.toLowerCase().includes("cash")
        ? "cash"
        : "other",
      accountingType: groups.find(g => g.id === l.groupId)?.type || "ASSET",
    }));
  }, [propAccountId, accountId, groups]);

  const [mainAccount, setMainAccount] = useState<string>(() => {
    if (selectedLedger) {
      const found = mappedLedgers.find(l => String(l.id) === String(selectedLedger) || l.name === selectedLedger);
      if (found) return found.id;
    }
    return "";
  });
  const [mainAccountSearch, setMainAccountSearch] = useState("");

  const isSimpleMode = (type === "payment" || type === "receipt") && voucherLines.length <= 2;

  // Auto voucher number
  useEffect(() => {
    if (!voucherId || voucherId === "new") {
      setVoucherNo(getNextVoucherNo(type, selectedFY));
    }
  }, [type, selectedFY, voucherId]);

  // Load existing voucher
  useEffect(() => {
    if (voucherId && voucherId !== "new") {
      const v = getVoucherById(voucherId);
      if (v) {
        setType(v.type);
        setVoucherNo(v.voucherNo || "");
        setDate(v.date);
        setAccountId(v.accountId || "");
        setNarration(v.narration || "");
        
        // Query the ledger name directly from getStoredLedgers() to avoid stale state issues with mappedLedgers
        const allLedgers = getStoredLedgers();
        const lines: VoucherLine[] = v.lines.map((e: any) => ({
          id: e.id || uuid(),
          ledgerId: e.ledgerId,
          ledgerName: allLedgers.find(l => String(l.id) === String(e.ledgerId))?.name || e.ledgerId,
          debit: e.debit || 0,
          credit: e.credit || 0,
          narration: e.narration || "",
        }));
        setVoucherLines(lines);
        
        // Populate Simple Mode fields correctly based on debit/credit structure
        const nonZeroLines = lines.filter(l => (l.debit !== 0 || l.credit !== 0));
        if (nonZeroLines.length >= 2) {
          let mainAccId = "";
          let counterLine: VoucherLine | undefined;

          if (v.type === "payment") {
            const creditLine = nonZeroLines.find(l => l.credit > 0);
            const debitLine = nonZeroLines.find(l => l.debit > 0);
            if (creditLine && creditLine.ledgerId) mainAccId = creditLine.ledgerId;
            counterLine = debitLine;
          } else if (v.type === "receipt") {
            const debitLine = nonZeroLines.find(l => l.debit > 0);
            const creditLine = nonZeroLines.find(l => l.credit > 0);
            if (debitLine && debitLine.ledgerId) mainAccId = debitLine.ledgerId;
            counterLine = creditLine;
          }

          if (mainAccId) {
            setMainAccount(mainAccId);
          }
          if (counterLine) {
            setSimpleAccount(counterLine.ledgerName ?? "");
            setSimpleAmount(String(counterLine.debit || counterLine.credit || ""));
            setSimpleQuantity(String(counterLine.quantity || ""));
            setSimplePrice(String(counterLine.price || ""));
          }
        }
      }
    }
  }, [voucherId]);

  // Ctrl+S to save
  const handleSave = useCallback(async () => {
    setError("");

    const amt = parseFloat(simpleAmount);
    const isSimpleValid = amt > 0 && simpleAccount;
    const isGridValid = (() => {
      const validLines = voucherLines.filter(r => r.ledgerId && (r.debit > 0 || r.credit > 0));
      if (validLines.length < 2) return false;
      const dr = validLines.reduce((s, r) => s + (r.debit || 0), 0);
      const cr = validLines.reduce((s, r) => s + (r.credit || 0), 0);
      return Math.abs(dr - cr) < 0.01;
    })();

    if (isSimpleMode && (!isSimpleValid || !mainAccount)) { setError("Select both accounts and enter an amount."); return; }
    if (!isSimpleMode && !isGridValid) { setError("Voucher is not balanced."); return; }
    if (!accountId) { setError("Please select an Account (Member) for this voucher."); return; }

    let finalLines: any[] = [];
    if (isSimpleMode) {
      const otherLedgerId = mappedLedgers.find(l => l.name === simpleAccount)?.id || simpleAccount;
      const qty = parseFloat(simpleQuantity) || 0;
      const prc = parseFloat(simplePrice) || 0;
      finalLines = type === "payment"
        ? [{ ledgerId: otherLedgerId, debit: amt, credit: 0, quantity: qty, price: prc }, { ledgerId: mainAccount, debit: 0, credit: amt }]
        : [{ ledgerId: mainAccount, debit: amt, credit: 0 }, { ledgerId: otherLedgerId, debit: 0, credit: amt, quantity: qty, price: prc }];
    } else {
      finalLines = voucherLines.filter(r => r.ledgerId && (r.debit > 0 || r.credit > 0));
    }

    const data = {
      id: (voucherId && voucherId !== "new") ? voucherId : uuid(),
      date, type, voucherNo, fy: selectedFY, accountId, narration, lines: finalLines,
    };

    setIsSaving(true);
    setError("");
    try {
      if (voucherId && voucherId !== "new") await updateVoucher(data);
      else await createVoucher({ ...data, isTest: isTestMode });
      onSaved?.();
    } catch (e: any) { 
      setError(e.message); 
      setIsSaving(false);
    }
  }, [isSimpleMode, simpleAmount, simpleAccount, voucherLines, type, date, voucherNo, narration, selectedFY, mainAccount, voucherId, onSaved]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, onClose]);

  const totalDebit = isSimpleMode ? (parseFloat(simpleAmount) || 0) : voucherLines.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = isSimpleMode ? (parseFloat(simpleAmount) || 0) : voucherLines.reduce((s, r) => s + (r.credit || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = isSimpleMode ? (totalDebit > 0 && !!simpleAccount && !!mainAccount) : (difference < 0.01 && totalDebit > 0);

  // Safety: if type is an unrecognized value (e.g. 'buy'/'sell' from old PMS data), default to 'journal'
  // Without this guard, currentTypeMeta would be undefined and crash the render with a blank screen
  const currentTypeMeta = VOUCHER_TYPES.find(t => t.key === type) ?? VOUCHER_TYPES.find(t => t.key === 'journal')!;

  // Balance hint is only shown for the currently-selected counter ledger, not in every dropdown row
  // (calling getLedgerWithBalance on every row causes severe slowdown with 1000+ ledgers)
  const renderHint = (_ledgerName: string) => null;

  const mainLedgerName = mappedLedgers.find(l => String(l.id) === String(mainAccount))?.name || "";

  // Live balance projection for simple mode
  const mainMeta = mappedLedgers.find(l => String(l.id) === String(mainAccount));
  const mainBalRaw = mainMeta ? getLedgerWithBalance(mainMeta.id) : null;
  const mainBal = mainBalRaw && !Array.isArray(mainBalRaw) ? mainBalRaw.closingBalance : 0;
  const counterMeta = mappedLedgers.find(l => l.name === simpleAccount);
  const counterBalRaw = counterMeta ? getLedgerWithBalance(counterMeta.id) : null;
  const counterBal = counterBalRaw && !Array.isArray(counterBalRaw) ? counterBalRaw.closingBalance : 0;
  const simpleAmt = parseFloat(simpleAmount) || 0;
  const mainAfter = type === "receipt" ? mainBal + simpleAmt : mainBal - simpleAmt;
  const counterAfter = type === "receipt" ? counterBal - simpleAmt : counterBal + simpleAmt;
  const fmtBal = (v: number) =>
    `\u20b9${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${v >= 0 ? "Dr" : "Cr"}`;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 860, maxHeight: "90vh", display: "flex", flexDirection: "column", borderRadius: "14px", overflow: "hidden" }}>

        {/* ── Accounting Toolbar Header ── */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          {VOUCHER_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              style={{
                padding: "16px 16px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                border: "none",
                borderBottom: type === t.key ? `3px solid ${t.color}` : "3px solid transparent",
                background: type === t.key ? `${t.color}10` : "transparent",
                color: type === t.key ? t.color : "#94a3b8",
                transition: "all 0.15s",
              }}
            >{t.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          {/* Voucher number + date inline */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 12px" }}>
            {!propAccountId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0 8px', height: '30px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }}>PERSON:</span>
                <select 
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '11px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
                >
                  <option value="">-- Select Member --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.accountName.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            )}
            <span style={{
              fontSize: "12px", fontWeight: 800, color: currentTypeMeta.color,
              background: `${currentTypeMeta.color}18`,
              padding: "5px 12px", borderRadius: "4px",
              border: `1px solid ${currentTypeMeta.color}40`,
              display: "inline-flex", alignItems: "center", height: "30px", boxSizing: "border-box"
            }}>{voucherNo}</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ fontSize: "12px", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: "4px", height: "30px", boxSizing: "border-box" }}
            />
          </div>
          {voucherId && voucherId !== "new" && (
            <button onClick={() => setVoucherNo(getNextVoucherNo(type, selectedFY))} title="Duplicate" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}>
              <Copy size={14} color="#94a3b8" />
            </button>
          )}
          {voucherId && voucherId !== "new" && (
            <button onClick={() => { if (window.confirm("Delete this voucher?")) deleteVoucher(voucherId).then(onSaved) }} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}>
              <Trash2 size={14} color="#ef4444" />
            </button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 14px" }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* â”€â”€ Body â”€â”€ */}
        <div className="modal-body" style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
          {isSimpleMode ? (
            <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              {/* Main Account row */}
              <div style={{ marginBottom: "18px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: "6px", letterSpacing: "0.06em" }}>
                  {type === "payment" ? "Paying From" : "Receiving Into"}
                </div>
                <div style={{ position: "relative" }}>
                  {!selectedLedger ? (
                    <>
                      <input
                        type="text"
                        value={activeDropdown === "m" ? mainAccountSearch : mainLedgerName}
                        onFocus={() => { setActiveDropdown("m"); setMainAccountSearch(mainLedgerName); }}
                        onBlur={() => setTimeout(() => setActiveDropdown(null), 150)}
                        onChange={e => setMainAccountSearch(e.target.value)}
                        placeholder="Select account..."
                        style={{ fontSize: "15px", fontWeight: 700, padding: "5px 10px", border: "1px solid #e2e8f0", borderRadius: "5px", background: "white", minWidth: "220px" }}
                      />
                      {activeDropdown === "m" && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", maxHeight: "150px", overflowY: "auto", boxShadow: "0 8px 20px rgba(0,0,0,0.1)" }}>
                          {mappedLedgers.filter(l => l.name.toLowerCase().includes(mainAccountSearch.toLowerCase())).slice(0, 50).map(l => (
                            <div key={l.name} onMouseDown={() => setMainAccount(l.id)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f1f5f9" }}>{l.name}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{mainLedgerName}</div>
                  )}
                </div>
                {/* Prominent main account balance with live projection */}
                <div style={{ marginTop: "7px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    Cur. bal: <span style={{ color: mainBal >= 0 ? "#0f766e" : "#b91c1c" }}>{fmtBal(mainBal)}</span>
                  </span>
                </div>
              </div>

              {/* Counter Account + Amount */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#64748b", letterSpacing: "0.06em" }}>
                    {type === "payment" ? "Paid To" : "Received From"}
                  </label>
                  <input
                    type="text"
                    value={activeDropdown === "s" ? searchQuery : simpleAccount}
                    onFocus={() => { setActiveDropdown("s"); setSearchQuery(simpleAccount); }}
                    onBlur={() => setTimeout(() => setActiveDropdown(null), 150)}
                    onChange={e => { setSearchQuery(e.target.value); setSimpleAccount(e.target.value); }}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }}
                    placeholder="Search ledger..."
                  />
                  {activeDropdown === "s" && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", maxHeight: "160px", overflowY: "auto", boxShadow: "0 8px 20px rgba(0,0,0,0.1)" }}>
                      {mappedLedgers.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 50).map(l => (
                        <div key={l.name} onMouseDown={() => { setSimpleAccount(l.name); setActiveDropdown(null); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
                          <span>{l.name}</span>
                          {renderHint(l.name)}
                        </div>
                      ))}
                    </div>
                  )}
                  {counterMeta && (
                    <div style={{ marginTop: "7px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                        Cur. bal: <span style={{ color: counterBal >= 0 ? "#0f766e" : "#b91c1c" }}>{fmtBal(counterBal)}</span>
                      </span>
                    </div>
                  )}
                </div>
                {counterMeta && (counterMeta.accountingType === 'ASSET' && (counterMeta.id.includes('stock') || counterMeta.name.toLowerCase().includes('stock') || counterMeta.name.toLowerCase().includes('equity') || counterMeta.name.toLowerCase().includes('mf'))) && (
                  <>
                    <div style={{ width: "100px" }}>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#64748b", letterSpacing: "0.06em" }}>Qty</label>
                      <input
                        type="number"
                        value={simpleQuantity}
                        onChange={e => {
                          const q = e.target.value;
                          setSimpleQuantity(q);
                          if (simplePrice && q) setSimpleAmount(String(parseFloat(q) * parseFloat(simplePrice)));
                        }}
                        placeholder="0"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", textAlign: "right", fontSize: "13px", fontWeight: 600 }}
                      />
                    </div>
                    <div style={{ width: "100px" }}>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#64748b", letterSpacing: "0.06em" }}>Price</label>
                      <input
                        type="number"
                        value={simplePrice}
                        onChange={e => {
                          const p = e.target.value;
                          setSimplePrice(p);
                          if (simpleQuantity && p) setSimpleAmount(String(parseFloat(simpleQuantity) * parseFloat(p)));
                        }}
                        placeholder=""
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", textAlign: "right", fontSize: "13px", fontWeight: 600 }}
                      />
                    </div>
                  </>
                )}
                <div style={{ width: "130px" }}>
                  <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#64748b", letterSpacing: "0.06em" }}>Amount (₹)</label>
                  <input
                    type="number"
                    value={simpleAmount}
                    onChange={e => setSimpleAmount(e.target.value)}
                    placeholder=""
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", textAlign: "right", fontSize: "14px", fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <VoucherGrid ledgers={mappedLedgers} isContra={type === "contra"} initialRows={voucherLines} onChange={setVoucherLines} />
          )}

          {/* Narration */}
          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#64748b", letterSpacing: "0.06em" }}>Narration</label>
            <textarea
              value={narration}
              onChange={e => setNarration(e.target.value)}
              placeholder="Optional description..."
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px", fontSize: "13px", resize: "none", fontFamily: "inherit" }}
              rows={2}
            />
          </div>

          {error && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "8px", fontWeight: 600 }}>⚠ {error}</div>}
        </div>

        {/* â”€â”€ Footer â”€â”€ */}
        <div style={{ padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Ctrl+S to save · Esc to close</span>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!isBalanced || isSaving}
            style={{ padding: "8px 24px", opacity: (isBalanced && !isSaving) ? 1 : 0.4, display: "flex", alignItems: "center", gap: "6px" }}
          >
            {isSaving ? (
              <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? "Saving..." : "Save Voucher"}
          </button>
        </div>
      </div>
    </div>
  );
}


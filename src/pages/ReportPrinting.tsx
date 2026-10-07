import React, { useState, useEffect, useMemo } from "react";
import { getStoredAccounts, getStoredLedgers, getStoredVouchers, getStoredGroups, getStoredEntries, formatDateDDMMMYYYY } from "../logic";
import { getTrialBalance, getBatchLedgers, getBatchVouchers, type LedgerPrintData, type VoucherPrintData } from "../services/reportPrinting";
import { getBalanceSheet } from "../services/balanceSheet";
import { getProfitLoss } from "../services/profitLoss";
import { useFY } from "../FYContext";
import { useFamily } from "../contexts/FamilyContext";
import { Printer, FileText, ChevronDown, Check, Users, Download } from "lucide-react";
import { downloadTallyXml } from "../services/tallyExportService";
import { downloadItrScheduleCg } from "../services/itrExportService";

type ReportType = "balance_sheet" | "profit_loss" | "trial_balance" | "ledger_statement" | "voucher_book";

export default function ReportPrinting() {
  const { selectedFY, reportFilter, customRange, selectedAccountId, setSelectedAccountId } = useFY();
  const { activeFamilyId } = useFamily();

  // General States
  const [reportType, setReportType] = useState<ReportType>(() => {
    if (window.location.pathname.includes("ledger-printing")) {
      return "ledger_statement";
    }
    return "balance_sheet";
  });
  const [showZeroValues, setShowZeroValues] = useState(false);

  // Ledger Statement Customizations
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<string[]>([]);
  const [showNarrationLedger, setShowNarrationLedger] = useState(true);
  const [pageBreakLedger, setPageBreakLedger] = useState(true);
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Voucher Book Customizations
  const [selectedVoucherTypes, setSelectedVoucherTypes] = useState<string[]>(["receipt", "payment", "journal", "contra"]);
  const [showNarrationVoucher, setShowNarrationVoucher] = useState(true);

  // Loaded Report Data States
  const [bsData, setBsData] = useState<any>(null);
  const [plData, setPlData] = useState<any>(null);
  const [tbData, setTbData] = useState<any>(null);
  const [ledgersData, setLedgersData] = useState<LedgerPrintData[]>([]);
  const [vouchersData, setVouchersData] = useState<VoucherPrintData[]>([]);
  const [loading, setLoading] = useState(false);

  const accounts = getStoredAccounts().filter((a) => a.familyId === activeFamilyId);
  const allLedgers = getStoredLedgers(selectedAccountId);

  // Sync selected account
  useEffect(() => {
    if (accounts.length > 0) {
      if (!accounts.some((a) => a.id === selectedAccountId)) {
        setSelectedAccountId(accounts[0].id);
      }
    } else {
      setSelectedAccountId("");
    }
  }, [accounts, selectedAccountId]);

  // Sync all ledger selection on load
  useEffect(() => {
    if (allLedgers.length > 0) {
      setSelectedLedgerIds(allLedgers.map((l) => l.id));
    } else {
      setSelectedLedgerIds([]);
    }
  }, [selectedAccountId]);

  const getDatesForFY = (fyStr: string) => {
    if (!fyStr) return { start: "", end: "" };
    const start = fyStr.split("-")[0];
    return { start: `${start}-04-01`, end: `${parseInt(start) + 1}-03-31` };
  };
  const getLastFY = (fyStr: string) => {
    if (!fyStr) return "";
    const [start, end] = fyStr.split("-");
    return `${parseInt(start) - 1}-${parseInt(end) - 1}`;
  };
  const getPreviousFY = (fyStr: string) => {
    if (!fyStr) return "";
    const [start, end] = fyStr.split("-");
    return `${parseInt(start) - 2}-${parseInt(end) - 2}`;
  };

  const effectiveDates = useMemo(() => {
    if (reportFilter === "current") return getDatesForFY(selectedFY);
    if (reportFilter === "last") return getDatesForFY(getLastFY(selectedFY));
    if (reportFilter === "previous") return getDatesForFY(getPreviousFY(selectedFY));
    return customRange;
  }, [selectedFY, reportFilter, customRange]);

  const selectedAccountName = useMemo(() => {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    return acc ? acc.accountName : "";
  }, [accounts, selectedAccountId]);

  // Fetch report data dynamically
  const loadReportData = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      if (reportType === "balance_sheet") {
        const bs = await getBalanceSheet(effectiveDates.start, effectiveDates.end, selectedAccountId);
        // Calculate dynamic accumulated P&L opening and current period balances
        const plCurrent = await getProfitLoss(effectiveDates.start, effectiveDates.end, selectedAccountId);
        
        // Accumulate prior profit
        const groups = getStoredGroups(selectedAccountId);
        const ledgers = getStoredLedgers(selectedAccountId);
        const entries = getStoredEntries();
        const vouchers = getStoredVouchers();
        
        // Resolve root type of any group
        const getGroupType = (groupId: string): string => {
          let current: any = groups.find((g: any) => g.id === groupId)
          while (current) {
            if (current.type) return current.type
            current = groups.find((g: any) => g.id === current?.parent)
          }
          return "ASSET"
        }

        const voucherMap: Record<string, any> = {};
        vouchers.forEach((v: any) => voucherMap[v.id] = v);

        // Sum net P&L balance before startDate
        let priorIncome = 0;
        let priorExpense = 0;
        
        ledgers.forEach((l: any) => {
          const type = getGroupType(l.groupId);
          if (type !== 'INCOME' && type !== 'EXPENSE') return;

          let dr = 0;
          let cr = 0;

          entries.forEach((e: any) => {
            if (String(e.ledgerId) === String(l.id)) {
              const v = voucherMap[e.voucherId];
              const entryDate = e.date || v?.date;
              const entryAcid = e.accountId || v?.accountId;
              if (entryDate && entryDate < effectiveDates.start) {
                if (selectedAccountId && entryAcid !== selectedAccountId) return;
                dr += e.debit || 0;
                cr += e.credit || 0;
              }
            }
          });

          if (type === 'INCOME') {
            priorIncome += (cr - dr);
          } else {
            priorExpense += (dr - cr);
          }
        });

        const plPrior = priorIncome - priorExpense;

        setBsData({
          ...bs,
          plPrior,
          plCurrent: plCurrent.netProfit,
        });
      } else if (reportType === "profit_loss") {
        const pl = await getProfitLoss(effectiveDates.start, effectiveDates.end, selectedAccountId);
        setPlData(pl);
      } else if (reportType === "trial_balance") {
        const tb = await getTrialBalance(effectiveDates.end, selectedAccountId);
        setTbData(tb);
      } else if (reportType === "ledger_statement") {
        const ledgers = await getBatchLedgers(selectedLedgerIds, effectiveDates.start, effectiveDates.end, selectedAccountId);
        setLedgersData(ledgers);
      } else if (reportType === "voucher_book") {
        const vouchers = await getBatchVouchers(selectedVoucherTypes, effectiveDates.start, effectiveDates.end, selectedAccountId);
        setVouchersData(vouchers);
      }
    } catch (e) {
      console.error("Error generating report data", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReportData();
  }, [reportType, selectedAccountId, effectiveDates, selectedLedgerIds, selectedVoucherTypes]);

  const cleanLedgerName = (name: string): string => {
    let cleaned = name.replace(/\s*\(?ISIN\s+[A-Z0-9]{12}\)?/gi, "");
    cleaned = cleaned.replace(/\s*\([A-Z]{2}[A-Z0-9]{10}\)/gi, "");
    cleaned = cleaned.replace(/\s*\(\d[\d\s\/,.-]*\)/gi, "");
    cleaned = cleaned.trim().replace(/\s*-\s*$/, "");
    return cleaned.trim();
  };

  const formatCurrency = (val: number) => {
    return Math.abs(val).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const printTimeStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${formatDateDDMMMYYYY(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, [loading]);

  const handlePrint = () => {
    window.print();
  };

  // Toggle helpers
  const handleLedgerSelectToggle = (id: string) => {
    setSelectedLedgerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleVoucherTypeToggle = (type: string) => {
    setSelectedVoucherTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const filteredLedgerOptions = allLedgers.filter((l) =>
    l.name.toLowerCase().includes(ledgerSearch.toLowerCase())
  );

  // Recursive BS Group Renderer
  const renderBSGroup = (group: any, level = 0, isPLGroup = false): React.ReactNode => {
    if (!showZeroValues && Math.abs(group.balance) < 0.1) return null;

    const hasChildren = group.children.length > 0 || group.ledgers.length > 0;
    const paddingLeft = level * 8;

    const sortedLedgers = [...group.ledgers].sort((a: any, b: any) => a.name.localeCompare(b.name));
    const sortedChildren = [...group.children].sort((a: any, b: any) => a.name.localeCompare(b.name));

    return (
      <div key={group.id} style={{ paddingLeft }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: level === 0 ? 700 : 500, fontSize: "11px", margin: "3px 0", color: "#1e293b" }}>
          <span>{cleanLedgerName(group.name)}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(group.balance)}</span>
        </div>
        
        {/* Custom display for Profit & Loss node to show opening & current period breakdown */}
        {group.id === "profit_loss" && bsData && (
          <div style={{ paddingLeft: 12, borderLeft: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "10px", margin: "2px 0" }}>
              <span>Opening Balance</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(bsData.plPrior)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "10px", margin: "2px 0" }}>
              <span>Current Period</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(bsData.plCurrent)}</span>
            </div>
          </div>
        )}

        {/* Regular child nodes if not the custom P&L layout */}
        {group.id !== "profit_loss" && (
          <div style={{ borderLeft: hasChildren ? "1px solid #e2e8f0" : "none", paddingLeft: hasChildren ? 6 : 0 }}>
            {sortedLedgers.map((l: any) => {
              const displayVal = l.displayBalance ?? l.balance;
              if (!showZeroValues && Math.abs(displayVal) < 0.1) return null;
              return (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: "10px", margin: "2px 0" }}>
                  <span>{cleanLedgerName(l.name)}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(displayVal)}</span>
                </div>
              );
            })}
            {sortedChildren.map((child: any) => renderBSGroup(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Recursive Trial Balance Row Renderer
  const renderTBRow = (node: any, level = 0): React.ReactNode => {
    if (!showZeroValues && Math.abs(node.debit) < 0.01 && Math.abs(node.credit) < 0.01) return null;
    const paddingLeft = level * 16 + 12;

    return (
      <React.Fragment key={node.id}>
        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
          <td style={{ padding: "5px 12px", paddingLeft, fontWeight: 700, fontSize: "11px", color: "#1e293b" }}>
            {cleanLedgerName(node.name)}
          </td>
          <td style={{ padding: "5px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "11px" }}>
            {node.debit >= 0.01 ? formatCurrency(node.debit) : "—"}
          </td>
          <td style={{ padding: "5px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "11px" }}>
            {node.credit >= 0.01 ? formatCurrency(node.credit) : "—"}
          </td>
        </tr>
        
        {/* Render child ledgers */}
        {node.ledgers.map((l: any) => {
          if (!showZeroValues && Math.abs(l.debit) < 0.01 && Math.abs(l.credit) < 0.01) return null;
          return (
            <tr key={l.id} style={{ borderBottom: "1px solid #f8fafc" }}>
              <td style={{ padding: "4px 12px", paddingLeft: paddingLeft + 16, color: "#475569", fontSize: "10px" }}>
                {cleanLedgerName(l.name)}
              </td>
              <td style={{ padding: "4px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#475569", fontSize: "10px" }}>
                {l.debit >= 0.01 ? formatCurrency(l.debit) : "—"}
              </td>
              <td style={{ padding: "4px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#475569", fontSize: "10px" }}>
                {l.credit >= 0.01 ? formatCurrency(l.credit) : "—"}
              </td>
            </tr>
          );
        })}

        {/* Render child groups */}
        {node.children.map((child: any) => renderTBRow(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="report-printing-layout" style={{ display: "flex", height: "calc(100vh - 60px)", background: "#f1f5f9" }}>
      
      {/* ── CONTROL PANEL (LEFT) ── */}
      <div className="print-hide" style={{
        width: "320px",
        background: "white",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0
      }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={18} color="#3b82f6" /> Report Customizer
          </h2>
          <p style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Configure layout options for print output.</p>
        </div>

        {/* Scrollable controls */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Member Selection */}
          <div className="form-group">
            <label className="form-label">Member / Account</label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #cbd5e1", padding: "6px 10px", borderRadius: "6px" }}>
              <Users size={14} color="#64748b" />
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{ width: "100%", border: "none", outline: "none", fontSize: "12px", fontWeight: 700 }}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.accountName.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Report Type Selector */}
          <div className="form-group">
            <label className="form-label">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              style={{ width: "100%", border: "1px solid #cbd5e1", padding: "6px 8px", borderRadius: "6px", fontSize: "12px", outline: "none", fontWeight: 600 }}
            >
              <option value="balance_sheet">Balance Sheet</option>
              <option value="profit_loss">Profit &amp; Loss</option>
              <option value="trial_balance">Trial Balance</option>
              <option value="ledger_statement">Ledger Statement (Batch)</option>
              <option value="voucher_book">Voucher Book</option>
            </select>
          </div>

          <div style={{ borderTop: "1px dashed #e2e8f0", margin: "4px 0" }} />

          {/* Dynamic Settings */}
          {(reportType === "balance_sheet" || reportType === "profit_loss" || reportType === "trial_balance") && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
              <input type="checkbox" checked={showZeroValues} onChange={(e) => setShowZeroValues(e.target.checked)} />
              Show Zero Value Accounts
            </label>
          )}

          {/* Ledger Statement Batch Multi-Select list */}
          {reportType === "ledger_statement" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                <input type="checkbox" checked={showNarrationLedger} onChange={(e) => setShowNarrationLedger(e.target.checked)} />
                Show Narrations
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                <input type="checkbox" checked={pageBreakLedger} onChange={(e) => setPageBreakLedger(e.target.checked)} />
                Page Break between Ledgers
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label className="form-label">Select Ledgers ({selectedLedgerIds.length})</label>
                <input
                  type="text"
                  placeholder="Search ledgers..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: "5px", fontSize: "11px", outline: "none" }}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    onClick={() => setSelectedLedgerIds(allLedgers.map((l) => l.id))}
                    style={{ flex: 1, padding: "3px", fontSize: "10px", fontWeight: 600, cursor: "pointer", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedLedgerIds([])}
                    style={{ flex: 1, padding: "3px", fontSize: "10px", fontWeight: 600, cursor: "pointer", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px", marginTop: "6px" }}>
                  {filteredLedgerOptions.map((l) => (
                    <label key={l.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px", fontSize: "11px", color: "#475569", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedLedgerIds.includes(l.id)}
                        onChange={() => handleLedgerSelectToggle(l.id)}
                      />
                      <span>{cleanLedgerName(l.name)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voucher Book settings */}
          {reportType === "voucher_book" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                <input type="checkbox" checked={showNarrationVoucher} onChange={(e) => setShowNarrationVoucher(e.target.checked)} />
                Show Narrations
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label className="form-label">Voucher Types</label>
                {["receipt", "payment", "journal", "contra"].map((t) => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#475569", cursor: "pointer", textTransform: "capitalize" }}>
                    <input
                      type="checkbox"
                      checked={selectedVoucherTypes.includes(t)}
                      onChange={() => handleVoucherTypeToggle(t)}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Print Trigger */}
        {/* Print & CA Export Suite Buttons (Sticky Bottom) */}
        <div style={{ padding: "20px", borderTop: "1px solid #f1f5f9", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={handlePrint}
            className="btn-primary"
            style={{ width: "100%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px", fontWeight: 700 }}
          >
            <Printer size={16} /> Print Report
          </button>

          <button
            onClick={() => downloadTallyXml(selectedFY, selectedAccountId ? Number(selectedAccountId) : undefined)}
            style={{ width: "100%", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "12px", fontWeight: 700, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#334155", cursor: "pointer" }}
          >
            📥 Export to Tally XML
          </button>

          <button
            onClick={() => downloadItrScheduleCg(selectedFY)}
            style={{ width: "100%", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "12px", fontWeight: 700, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", color: "#166534", cursor: "pointer" }}
          >
            📊 Export ITR Schedule CG (.xlsx)
          </button>
        </div>
      </div>

      {/* ── LIVE PRINT PREVIEW AREA (RIGHT) ── */}
      <div className="report-preview-container" style={{
        flex: 1,
        overflowY: "auto",
        padding: "40px",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start"
      }}>
        
        {/* Paper Sheet Preview container */}
        <div id="print-sheet" style={{
          background: "white",
          width: "800px",
          minHeight: "1000px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          borderRadius: "8px",
          padding: "50px 60px",
          position: "relative",
          boxSizing: "border-box"
        }}>
          
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px", color: "#64748b", fontSize: "13px" }}>
              Generating live print preview...
            </div>
          ) : (
            <>
              {/* Header block (MProfit format) */}
              <div style={{ textAlign: "center", marginBottom: "32px", borderBottom: "1px solid #94a3b8", paddingBottom: "16px" }}>
                <h1 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px", color: "#0f172a", textAlign: "center" }}>
                  {selectedAccountName || "Member Name"}
                </h1>
                
                {reportType === "balance_sheet" && (
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Balance Sheet as on {formatDateDDMMMYYYY(effectiveDates.end)}
                  </div>
                )}
                {reportType === "profit_loss" && (
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Profit &amp; Loss Statement Period: {formatDateDDMMMYYYY(effectiveDates.start)} to {formatDateDDMMMYYYY(effectiveDates.end)}
                  </div>
                )}
                {reportType === "trial_balance" && (
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Trial Balance Period: {formatDateDDMMMYYYY(effectiveDates.start)} to {formatDateDDMMMYYYY(effectiveDates.end)}
                  </div>
                )}
                {reportType === "ledger_statement" && (
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Ledger Summary Statement Period: {formatDateDDMMMYYYY(effectiveDates.start)} to {formatDateDDMMMYYYY(effectiveDates.end)}
                  </div>
                )}
                {reportType === "voucher_book" && (
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Voucher Report Book Period: {formatDateDDMMMYYYY(effectiveDates.start)} to {formatDateDDMMMYYYY(effectiveDates.end)}
                  </div>
                )}

                <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "4px" }}>
                  Print Date &amp; Time: {printTimeStr}
                </div>
              </div>

              {/* ── BALANCE SHEET REPORT ── */}
              {reportType === "balance_sheet" && bsData && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0 }}>
                    {/* LIABILITIES */}
                    <div style={{ paddingRight: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "12px", borderBottom: "1px solid #475569", paddingBottom: "6px", color: "#0f172a" }}>
                        <span>Liabilities</span>
                        <span>Amount</span>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        {bsData.liabilities.length === 0 ? (
                          <div style={{ fontSize: "11px", fontStyle: "italic", color: "#94a3b8" }}>No liabilities.</div>
                        ) : (
                          bsData.liabilities.map((g: any) => renderBSGroup(g))
                        )}
                      </div>
                    </div>

                    {/* Vertical Divider */}
                    <div style={{ width: "1px", background: "#cbd5e1", minHeight: "100%" }} />

                    {/* ASSETS */}
                    <div style={{ paddingLeft: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "12px", borderBottom: "1px solid #475569", paddingBottom: "6px", color: "#0f172a" }}>
                        <span>Assets</span>
                        <span>Amount</span>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        {bsData.assets.length === 0 ? (
                          <div style={{ fontSize: "11px", fontStyle: "italic", color: "#94a3b8" }}>No assets.</div>
                        ) : (
                          bsData.assets.map((g: any) => renderBSGroup(g))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, marginTop: "24px", borderTop: "2px solid #0f172a", paddingTop: "8px", fontWeight: "bold", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingRight: "15px" }}>
                      <span>Total Liabilities &amp; Equity</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(bsData.totalLiabilities)}</span>
                    </div>
                    <div style={{ width: "1px" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "15px" }}>
                      <span>Total Assets</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(bsData.totalAssets)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PROFIT & LOSS REPORT ── */}
              {reportType === "profit_loss" && plData && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0 }}>
                    {/* EXPENSES */}
                    <div style={{ paddingRight: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "12px", borderBottom: "1px solid #475569", paddingBottom: "6px", color: "#0f172a" }}>
                        <span>Expense</span>
                        <span>Amount</span>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        {plData.expenses.length === 0 ? (
                          <div style={{ fontSize: "11px", fontStyle: "italic", color: "#94a3b8" }}>No expenses.</div>
                        ) : (
                          plData.expenses.map((g: any) => renderBSGroup(g))
                        )}
                        {/* Net Profit Display */}
                        {plData.netProfit >= 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px", color: "#059669", marginTop: "12px", background: "#f0fdf4", padding: "4px 8px", borderRadius: "4px" }}>
                            <span>Excess of Income over Expenditure (Net Profit)</span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(plData.netProfit)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vertical Divider */}
                    <div style={{ width: "1px", background: "#cbd5e1", minHeight: "100%" }} />

                    {/* INCOMES */}
                    <div style={{ paddingLeft: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "12px", borderBottom: "1px solid #475569", paddingBottom: "6px", color: "#0f172a" }}>
                        <span>Income</span>
                        <span>Amount</span>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        {plData.incomes.length === 0 ? (
                          <div style={{ fontSize: "11px", fontStyle: "italic", color: "#94a3b8" }}>No incomes.</div>
                        ) : (
                          plData.incomes.map((g: any) => renderBSGroup(g))
                        )}
                        {/* Net Loss Display */}
                        {plData.netProfit < 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px", color: "#dc2626", marginTop: "12px", background: "#fef2f2", padding: "4px 8px", borderRadius: "4px" }}>
                            <span>Excess of Expenditure over Income (Net Loss)</span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(Math.abs(plData.netProfit))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, marginTop: "24px", borderTop: "2px solid #0f172a", paddingTop: "8px", fontWeight: "bold", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingRight: "15px" }}>
                      <span>Total Expense</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(plData.netProfit >= 0 ? plData.totalExpense + plData.netProfit : plData.totalExpense)}
                      </span>
                    </div>
                    <div style={{ width: "1px" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "15px" }}>
                      <span>Total Income</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(plData.netProfit < 0 ? plData.totalIncome + Math.abs(plData.netProfit) : plData.totalIncome)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TRIAL BALANCE REPORT ── */}
              {reportType === "trial_balance" && tbData && (
                <div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #0f172a" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>Account Name</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>Debit</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tbData.tree.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>No balances.</td>
                        </tr>
                      ) : (
                        tbData.tree.map((g: any) => renderTBRow(g))
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #0f172a", borderBottom: "2px solid #0f172a", fontWeight: "bold" }}>
                        <td style={{ padding: "8px 12px", fontSize: "12px" }}>Grand Total</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "12px" }}>
                          {formatCurrency(tbData.totalDebit)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "12px" }}>
                          {formatCurrency(tbData.totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── LEDGER STATEMENT (BATCH) ── */}
              {reportType === "ledger_statement" && (
                <div>
                  {ledgersData.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "12px" }}>
                      No ledgers selected or no transaction history available for the selected period.
                    </div>
                  ) : (
                    ledgersData.map((led: LedgerPrintData, idx: number) => {
                      let totalDr = 0;
                      let totalCr = 0;
                      led.transactions.forEach(t => {
                        totalDr += t.debit;
                        totalCr += t.credit;
                      });

                      const belongsToAsset = led.openingBalance >= 0; // estimate
                      const opDr = led.openingBalance >= 0 ? led.openingBalance : 0;
                      const opCr = led.openingBalance < 0 ? Math.abs(led.openingBalance) : 0;

                      return (
                        <div
                          key={led.id}
                          className="ledger-print-block"
                          style={{
                            pageBreakAfter: pageBreakLedger && idx < ledgersData.length - 1 ? "always" : "auto",
                            marginBottom: "40px",
                          }}
                        >
                          <div style={{ borderBottom: "2px solid #475569", paddingBottom: "4px", marginBottom: "12px" }}>
                            <h3 style={{ fontSize: "14px", fontWeight: 800, margin: 0, color: "#1e293b" }}>
                              Ledger: {cleanLedgerName(led.name)}
                            </h3>
                            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                              Group: {led.groupName}
                            </div>
                          </div>

                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #94a3b8" }}>
                                <th style={{ padding: "6px 8px", fontSize: "11px", color: "#0f172a", fontWeight: 700 }}>Date</th>
                                <th style={{ padding: "6px 8px", fontSize: "11px", color: "#0f172a", fontWeight: 700 }}>Account Name</th>
                                <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "11px", color: "#0f172a", fontWeight: 700 }}>Debit</th>
                                <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "11px", color: "#0f172a", fontWeight: 700 }}>Credit</th>
                                <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "11px", color: "#0f172a", fontWeight: 700 }}>Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Opening Balance Row */}
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "5px 8px", fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}>{formatDateDDMMMYYYY(effectiveDates.start)}</td>
                                <td style={{ padding: "5px 8px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>Opening Balance</td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "11px", color: "#475569" }}>
                                  {opDr > 0 ? formatCurrency(opDr) : "—"}
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "11px", color: "#475569" }}>
                                  {opCr > 0 ? formatCurrency(opCr) : "—"}
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                                  {formatCurrency(led.openingBalance)}
                                </td>
                              </tr>

                              {/* Transaction list */}
                              {led.transactions.map((t, tIdx) => (
                                <tr key={tIdx} style={{ borderBottom: "1px solid #f8fafc" }}>
                                  <td style={{ padding: "4px 8px", fontSize: "10px", color: "#475569", whiteSpace: "nowrap" }}>{formatDateDDMMMYYYY(t.date)}</td>
                                  <td style={{ padding: "4px 8px", fontSize: "10px", color: "#334155" }}>
                                    <div>{t.againstLedger}</div>
                                    {showNarrationLedger && t.narration && (
                                      <div style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic", marginTop: "2px" }}>
                                        Narr: {t.narration}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                                    {t.debit > 0 ? formatCurrency(t.debit) : "—"}
                                  </td>
                                  <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#dc2626", fontVariantNumeric: "tabular-nums" }}>
                                    {t.credit > 0 ? formatCurrency(t.credit) : "—"}
                                  </td>
                                  <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", fontWeight: 600, color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
                                    {formatCurrency(t.balance)}
                                  </td>
                                </tr>
                              ))}

                              {/* Totals for Period */}
                              <tr style={{ background: "#fafafa", borderTop: "1px solid #94a3b8", fontWeight: "bold" }}>
                                <td colSpan={2} style={{ padding: "6px 8px", fontSize: "10px", textAlign: "right", color: "#64748b" }}>Totals for the Period:</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", color: "#059669" }}>{formatCurrency(totalDr)}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", color: "#dc2626" }}>{formatCurrency(totalCr)}</td>
                                <td></td>
                              </tr>

                              {/* Closing Balance */}
                              <tr style={{ background: "#f8fafc", borderTop: "1px solid #cbd5e1", fontWeight: "bold" }}>
                                <td colSpan={2} style={{ padding: "6px 8px", fontSize: "11px", textAlign: "right", color: "#1e293b" }}>Closing Balance:</td>
                                <td colSpan={2} style={{ padding: "6px 8px", textAlign: "right", fontSize: "11px" }} />
                                <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "11px", color: "#1d4ed8" }}>{formatCurrency(led.closingBalance)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── VOUCHER BOOK REPORT ── */}
              {reportType === "voucher_book" && (
                <div>
                  {vouchersData.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "12px" }}>
                      No vouchers found for selected types and period range.
                    </div>
                  ) : (
                    vouchersData.map((v: VoucherPrintData) => (
                      <div
                        key={v.id}
                        className="voucher-print-block"
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "16px",
                          marginBottom: "24px",
                          background: "#fafcff",
                          pageBreakInside: "avoid"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #cbd5e1", paddingBottom: "8px", marginBottom: "12px" }}>
                          <div>
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Date:</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, marginLeft: "4px", color: "#334155" }}>{formatDateDDMMMYYYY(v.date)}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Voucher No:</span>
                            <span style={{
                              fontSize: "11px", fontWeight: 800, marginLeft: "4px",
                              color: v.type === "receipt" ? "#059669" : v.type === "payment" ? "#dc2626" : v.type === "journal" ? "#7c3aed" : "#0284c7"
                            }}>{v.voucherNo}</span>
                          </div>
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <th style={{ padding: "4px 8px", fontSize: "10px", color: "#64748b" }}>Ledger Account Name</th>
                              <th style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#64748b" }}>Qty</th>
                              <th style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#64748b" }}>Price</th>
                              <th style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#059669" }}>Debit</th>
                              <th style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#dc2626" }}>Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {v.lines.map((l, lIdx) => (
                              <tr key={lIdx} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "4px 8px", fontSize: "10px", color: "#334155", fontWeight: 500 }}>
                                  {cleanLedgerName(l.ledgerName)}
                                  {l.narration && (
                                    <div style={{ fontSize: "8px", color: "#94a3b8", fontStyle: "italic", marginLeft: "4px" }}>
                                      {l.narration}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#475569" }}>
                                  {l.quantity && l.quantity > 0 ? l.quantity : "—"}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#475569" }}>
                                  {l.price && l.price > 0 ? formatCurrency(l.price) : "—"}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#059669" }}>
                                  {l.debit > 0 ? formatCurrency(l.debit) : "—"}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "10px", color: "#dc2626" }}>
                                  {l.credit > 0 ? formatCurrency(l.credit) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ fontWeight: "bold", borderTop: "1px solid #cbd5e1" }}>
                              <td colSpan={3} style={{ padding: "5px 8px", fontSize: "10px", textAlign: "right", color: "#475569" }}>Total:</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px", color: "#059669" }}>{formatCurrency(v.totalAmount)}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px", color: "#dc2626" }}>{formatCurrency(v.totalAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>

                        {showNarrationVoucher && v.narration && (
                          <div style={{ marginTop: "8px", fontSize: "10px", color: "#475569", background: "#f1f5f9", padding: "6px 10px", borderRadius: "4px" }}>
                            <strong>Narr:</strong> {v.narration}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

            </>
          )}

        </div>
      </div>

      {/* ── PRINT-SPECIFIC CSS RULES ── */}
      <style>{`
        @page {
          margin: 15mm 20mm; /* Adds 15mm top/bottom and 20mm left/right blank margins on printed paper */
          @bottom-right {
            content: "Page " counter(page);
            font-size: 9px;
            font-family: 'Inter', sans-serif;
            color: #64748b;
          }
        }
        @media print {
          /* Hide sidebar, navbar, and print controls */
          .print-hide {
            display: none !important;
          }
          
          /* Reset container margins & sizes for print sheet */
          body, html, #root, .app-layout, .app-layout > div, .main-content, main, .report-printing-layout, .report-preview-container {
            background: transparent !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            display: block !important;
            position: relative !important;
          }
          
          #print-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 5mm 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            position: relative !important;
          }

          /* Ensure elements break pages properly */
          .ledger-print-block {
            page-break-inside: avoid;
          }
          .voucher-print-block {
            page-break-inside: avoid;
          }
        }
      `}</style>
      
    </div>
  );
}

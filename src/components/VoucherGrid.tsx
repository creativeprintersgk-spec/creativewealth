import { useState, useEffect, useRef, useCallback } from "react"
import { v4 as uuid } from "uuid"
import { getLedgerWithBalance, type VoucherLine } from "../logic"

export type LedgerOption = {
  id: string
  name: string
  type: string
  accountingType: string
}

type LedgerType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE'

function getEffect(type: LedgerType, isDebit: boolean): 'increase' | 'decrease' | '' {
  if (type === 'ASSET' || type === 'EXPENSE') return isDebit ? 'increase' : 'decrease'
  if (type === 'LIABILITY' || type === 'INCOME') return isDebit ? 'decrease' : 'increase'
  return ''
}

function getHint(type: LedgerType, isDebit: boolean): string {
  const effect = getEffect(type, isDebit)
  if (!effect) return ''
  const label = type === 'ASSET' ? 'Asset' : type === 'EXPENSE' ? 'Expense' : type === 'INCOME' ? 'Income' : 'Liability'
  return `${label} ${effect === 'increase' ? '▲' : '▼'}`
}

const emptyRow = (): VoucherLine => ({ id: uuid(), ledgerId: null, ledgerName: "", debit: 0, credit: 0, narration: "" })

export default function VoucherGrid({
  ledgers,
  onChange,
  isContra = false,
  initialRows
}: {
  ledgers: LedgerOption[]
  onChange: (rows: VoucherLine[]) => void
  isContra?: boolean
  initialRows?: any[]
}) {
  const [rows, setRows] = useState<VoucherLine[]>(
    (initialRows && initialRows.length > 0) ? initialRows : [emptyRow(), emptyRow()]
  )
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [focusedIndex, setFocusedIndex] = useState(0)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { onChange(rows) }, [rows])

  const allowedLedgers = isContra
    ? ledgers.filter(l => l.type === "bank" || l.type === "cash")
    : ledgers

  const filteredLedgers = allowedLedgers.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const updateRow = useCallback((id: string, field: string, value: any) => {
    setRows(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r
        const newRow = { ...r, [field]: value }
        if (field === "debit" && value > 0) newRow.credit = 0
        if (field === "credit" && value > 0) newRow.debit = 0
        return newRow
      })

      // Auto-balance: when Dr is entered on last row, ensure there's a next row
      const rowIdx = updated.findIndex(r => r.id === id)
      const isLast = rowIdx === updated.length - 1
      if ((field === "debit" || field === "credit") && value > 0 && isLast) {
        updated.push(emptyRow())
      }

      return updated
    })
  }, [])

  const removeRow = (id: string) => {
    setRows(prev => {
      const filtered = prev.filter(r => r.id !== id)
      return filtered.length === 0 ? [emptyRow()] : filtered
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, field: 'ledger' | 'debit' | 'credit') => {
    // Tab / Enter navigation
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (activeDropdown === rowId && filteredLedgers.length > 0) {
        // Confirm selection from dropdown
        e.preventDefault()
        const selected = filteredLedgers[focusedIndex] || filteredLedgers[0]
        updateRow(rowId, "ledgerId", selected.id)
        updateRow(rowId, "ledgerName", selected.name)
        setActiveDropdown(null)
        setSearchQuery("")
        // Move focus to debit
        setTimeout(() => inputRefs.current[`${rowId}-debit`]?.focus(), 50)
        return
      }
      if (field === 'debit') {
        e.preventDefault()
        inputRefs.current[`${rowId}-credit`]?.focus()
        return
      }
      if (field === 'credit') {
        e.preventDefault()
        const idx = rows.findIndex(r => r.id === rowId)
        const nextRow = rows[idx + 1]
        if (nextRow) inputRefs.current[`${nextRow.id}-ledger`]?.focus()
        return
      }
    }

    // Arrow key navigation in dropdown
    if (activeDropdown === rowId) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, filteredLedgers.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Escape') { setActiveDropdown(null); setSearchQuery("") }
    }
  }

  const totalDebit = rows.reduce((s, r) => s + (r.debit || 0), 0)
  const totalCredit = rows.reduce((s, r) => s + (r.credit || 0), 0)
  const difference = totalDebit - totalCredit
  const isBalanced = Math.abs(difference) < 0.01 && totalDebit > 0

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "visible", background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "52%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "32px" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "16px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ledger Account</th>
            <th style={{ padding: "16px 12px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em" }}>Debit (Dr)</th>
            <th style={{ padding: "16px 12px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em" }}>Credit (Cr)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const ledgerMeta = row.ledgerId ? allowedLedgers.find(l => l.id === row.ledgerId) : null
            const balRaw = row.ledgerId ? getLedgerWithBalance(row.ledgerId) : null
            const currentBalance = balRaw && !Array.isArray(balRaw)
              ? balRaw.closingBalance
              : 0
            const hasEntry = (row.debit || 0) > 0 || (row.credit || 0) > 0
            const isDebit = (row.debit || 0) > 0
            const effect = (ledgerMeta && hasEntry) ? getEffect(ledgerMeta.accountingType as LedgerType, isDebit) : ''
            const hint = (ledgerMeta && hasEntry) ? getHint(ledgerMeta.accountingType as LedgerType, isDebit) : ''

            return (
              <tr
                key={row.id}
                style={{ borderBottom: "1px solid #f1f5f9" }}
                className="voucher-row"
              >
                {/* Ledger Column */}
                <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      ref={el => { inputRefs.current[`${row.id}-ledger`] = el }}
                      type="text"
                      placeholder={`Line ${index + 1}...`}
                      value={activeDropdown === row.id ? searchQuery : (row.ledgerName || "")}
                      onFocus={() => { setActiveDropdown(row.id); setSearchQuery(row.ledgerName || ""); setFocusedIndex(0) }}
                      onBlur={() => setTimeout(() => { if (activeDropdown === row.id) { setActiveDropdown(null); setSearchQuery("") } }, 150)}
                      onChange={e => { setSearchQuery(e.target.value); setFocusedIndex(0); if (row.ledgerId) updateRow(row.id, "ledgerId", null) }}
                      onKeyDown={e => handleKeyDown(e, row.id, 'ledger')}
                      style={{
                        width: "100%", padding: "6px 10px", fontSize: "13px",
                        border: activeDropdown === row.id ? "1px solid hsl(213,94%,55%)" : "1px solid #e2e8f0",
                        borderRadius: "5px", outline: "none",
                        background: row.ledgerId ? "#f0f9ff" : "white"
                      }}
                    />
                    {/* Dropdown */}
                    {activeDropdown === row.id && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 500,
                        background: "white", border: "1px solid #e2e8f0", borderRadius: "7px",
                        marginTop: "4px", boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                        maxHeight: "200px", overflowY: "auto"
                      }}>
                        {filteredLedgers.length === 0 ? (
                          <div style={{ padding: "10px 14px", fontSize: "12px", color: "#94a3b8" }}>No ledger found</div>
                        ) : filteredLedgers.map((l, i) => (
                          <div
                            key={l.id}
                            onMouseDown={() => {
                              updateRow(row.id, "ledgerId", l.id)
                              updateRow(row.id, "ledgerName", l.name)
                              setActiveDropdown(null)
                              setSearchQuery("")
                              setTimeout(() => inputRefs.current[`${row.id}-debit`]?.focus(), 50)
                            }}
                            style={{
                              padding: "8px 14px", cursor: "pointer", fontSize: "13px",
                              background: i === focusedIndex ? "#f0f9ff" : "white",
                              borderBottom: "1px solid #f8fafc",
                              display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}
                            onMouseEnter={() => setFocusedIndex(i)}
                          >
                            <span style={{ fontWeight: 500 }}>{l.name}</span>
                            <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>{l.accountingType}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Prominent balance with live projection */}
                    {ledgerMeta && (() => {
                      const afterBalance = currentBalance + (row.debit || 0) - (row.credit || 0);
                      const fmtBal = (v: number) => `\u20b9${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${v >= 0 ? "Dr" : "Cr"}`;
                      const amtChange = (row.debit || 0) + (row.credit || 0);
                      const changeLabel = row.debit ? `+Dr \u20b9${row.debit.toLocaleString("en-IN")}` : row.credit ? `+Cr \u20b9${row.credit.toLocaleString("en-IN")}` : '';
                      const changeColor = row.debit ? "#15803d" : "#b91c1c";
                      const changeBg = row.debit ? "#dcfce7" : "#fee2e2";

                      return (
                        <div style={{ marginTop: "7px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                            Cur. bal: <span style={{ color: currentBalance >= 0 ? "#0f766e" : "#b91c1c" }}>{fmtBal(currentBalance)}</span>
                          </span>
                          {amtChange > 0 && (
                            <>
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>→</span>
                              <span style={{ fontSize: "12px", fontWeight: 800, color: afterBalance >= 0 ? "#0f766e" : "#b91c1c" }}>
                                {fmtBal(afterBalance)}
                              </span>
                              <span style={{
                                fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
                                background: changeBg, color: changeColor
                              }}>
                                {changeLabel}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </td>

                {/* Debit */}
                <td style={{ padding: "6px 10px", verticalAlign: "top" }}>
                  <input
                    ref={el => { inputRefs.current[`${row.id}-debit`] = el }}
                    type="number"
                    placeholder="0.00"
                    value={row.debit || ""}
                    onChange={e => updateRow(row.id, "debit", parseFloat(e.target.value) || 0)}
                    onKeyDown={e => handleKeyDown(e, row.id, 'debit')}
                    style={{
                      width: "100%", padding: "6px 10px", textAlign: "right",
                      border: "1px solid #e2e8f0", borderRadius: "5px",
                      fontSize: "13px", fontWeight: 600, color: "#059669",
                      outline: "none", background: (row.debit || 0) > 0 ? "#f0fdf4" : "white"
                    }}
                  />
                </td>

                {/* Credit */}
                <td style={{ padding: "6px 10px", verticalAlign: "top" }}>
                  <input
                    ref={el => { inputRefs.current[`${row.id}-credit`] = el }}
                    type="number"
                    placeholder="0.00"
                    value={row.credit || ""}
                    onChange={e => updateRow(row.id, "credit", parseFloat(e.target.value) || 0)}
                    onKeyDown={e => handleKeyDown(e, row.id, 'credit')}
                    style={{
                      width: "100%", padding: "6px 10px", textAlign: "right",
                      border: "1px solid #e2e8f0", borderRadius: "5px",
                      fontSize: "13px", fontWeight: 600, color: "#dc2626",
                      outline: "none", background: (row.credit || 0) > 0 ? "#fff1f2" : "white"
                    }}
                  />
                </td>

                {/* Delete — shows only on hover via CSS */}
                <td style={{ padding: "6px 4px", textAlign: "center", verticalAlign: "top" }}>
                  <button
                    onClick={() => removeRow(row.id)}
                    className="row-delete-btn"
                    style={{
                      background: "none", border: "none", color: "#cbd5e1",
                      cursor: "pointer", fontSize: "14px", padding: "6px 4px",
                      lineHeight: 1
                    }}
                    title="Remove row"
                  >✕</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Footer: Totals + Difference — aligned under columns */}
      <table style={{ width: "100%", borderCollapse: "collapse", borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
        <colgroup>
          <col style={{ width: "52%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "32px" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ padding: "10px 12px" }}>
              <button
                onClick={() => setRows(r => [...r, emptyRow()])}
                style={{
                  color: "hsl(213,94%,55%)", background: "white", border: "1px solid #e2e8f0",
                  borderRadius: "5px", padding: "4px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 600
                }}
              >+ Add Row</button>
            </td>
            <td style={{ padding: "10px 12px", textAlign: "right" }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#059669" }}>
                ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </td>
            <td style={{ padding: "10px 12px", textAlign: "right" }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#dc2626" }}>
                ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </td>
            <td style={{ padding: "10px 4px", textAlign: "center" }}>
              {!isBalanced && totalDebit > 0 && (
                <span style={{
                  fontSize: "10px", fontWeight: 800, color: "#f59e0b",
                  background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap"
                }}>≠</span>
              )}
              {isBalanced && (
                <span style={{
                  fontSize: "10px", fontWeight: 800, color: "#059669",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: "4px", padding: "2px 6px"
                }}>✓</span>
              )}
            </td>
          </tr>
          {!isBalanced && totalDebit > 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "4px 12px 8px", textAlign: "right" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b" }}>
                  Diff: ₹{Math.abs(difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </td>
            </tr>
          )}
          {isBalanced && (
            <tr>
              <td colSpan={4} style={{ padding: "4px 12px 8px", textAlign: "right" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669" }}>✓ BALANCED</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <style>{`
        .voucher-row .row-delete-btn { opacity: 0; transition: opacity 0.15s; }
        .voucher-row:hover .row-delete-btn { opacity: 1; color: #ef4444; }
      `}</style>
    </div>
  )
}

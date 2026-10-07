import React, { useEffect, useState, useCallback } from "react"
import { getBalanceSheet, getComparativeBalanceSheet } from "../services/balanceSheet"
import { useFY } from "../FYContext"
import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, createVoucher, getStoredAccounts, formatDateDDMMMYYYY } from "../logic"
import { v4 as uuid } from "uuid"
import LedgerDrilldownModal from "../LedgerDrilldownModal"
import VoucherModal from "../VoucherModal"
import { useFamily } from "../contexts/FamilyContext"
import {
  Users, ChevronRight, ChevronDown, Folder, FileText,
  ArrowUpDown, TrendingUp, TrendingDown, ShieldCheck,
  Scale, Wallet, BarChart2, RefreshCw, ChevronsUpDown,
  CheckCircle2, AlertTriangle, Eye, EyeOff, Download, Printer
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function fmtIN(n: number, decimals = 2) {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000)    return `₹${(n / 100_000).toFixed(2)} L`
  if (abs >= 1_000)      return `₹${(n / 1_000).toFixed(1)} K`
  return `₹${fmtIN(n)}`
}

function cleanName(name: string): string {
  let s = name.replace(/\s*\(?ISIN\s+[A-Z0-9]{12}\)?/gi, '')
  s = s.replace(/\s*\([A-Z]{2}[A-Z0-9]{10}\)/gi, '')
  s = s.replace(/\s*\(\d[\d\s\/,.-]*\)/gi, '')
  return s.trim().replace(/\s*-\s*$/, '').trim()
}

function sign(n: number) { return n >= 0 ? '+' : '' }

/* ─────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`,
      border: `1px solid ${accent}30`,
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 160,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 8, right: 12, opacity: 0.12 }}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 32, color: accent })}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: accent, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

/* Amount cell with colour logic */
function Amt({ v, bold, size, dimmed, minWidth }: { v: number; bold?: boolean; size?: number; dimmed?: boolean; minWidth?: number }) {
  return (
    <span style={{
      fontVariantNumeric: 'tabular-nums',
      fontWeight: bold ? 750 : 600,
      fontSize: size ?? 12,
      color: dimmed ? '#475569' : '#000000',
      whiteSpace: 'nowrap',
      minWidth: minWidth ? minWidth : undefined,
      textAlign: minWidth ? 'right' : undefined,
      display: minWidth ? 'inline-block' : undefined
    }}>
      {fmtIN(v)}
    </span>
  )
}

function VarCell({ variance, pct }: { variance: number; pct: number }) {
  const c = variance >= 0 ? '#16a34a' : '#dc2626'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 10, color: c, whiteSpace: 'nowrap' }}>
        {sign(variance)}{fmtIN(variance)}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: c,
        background: variance >= 0 ? '#f0fdf4' : '#fef2f2',
        padding: '1px 4px', borderRadius: 20, whiteSpace: 'nowrap'
      }}>
        {sign(pct)}{(pct || 0).toFixed(1)}%
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function BalanceSheet() {
  const { selectedFY, reportFilter, customRange, selectedAccountId, setSelectedAccountId, globalRefreshTrigger } = useFY()
  const { activeFamilyId } = useFamily()

  const [data, setData] = useState<any>(null)
  const [isComparative, setIsComparative] = useState(false)
  const [compareFY, setCompareFY] = useState<string>('2023-2024')
  const [showZeroValues, setShowZeroValues] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId)

  useEffect(() => {
    if (accounts.length > 0) {
      if (!accounts.some(a => a.id === selectedAccountId)) {
        setSelectedAccountId(accounts[0].id)
      }
    } else {
      setSelectedAccountId('')
    }
  }, [accounts.length, selectedAccountId])

  const getDatesForFY = (fyStr: string) => {
    const [start] = fyStr.split("-")
    return { start: `${start}-04-01`, end: `${parseInt(start) + 1}-03-31` }
  }
  const getLastFY = (fyStr: string) => {
    const [s, e] = fyStr.split("-")
    return `${parseInt(s) - 1}-${parseInt(e) - 1}`
  }
  const getPreviousFY = (fyStr: string) => {
    const [s, e] = fyStr.split("-")
    return `${parseInt(s) - 2}-${parseInt(e) - 2}`
  }

  const effectiveDates = (() => {
    if (reportFilter === 'current')  return getDatesForFY(selectedFY)
    if (reportFilter === 'last')     return getDatesForFY(getLastFY(selectedFY))
    if (reportFilter === 'previous') return getDatesForFY(getPreviousFY(selectedFY))
    return customRange
  })()

  useEffect(() => { setCompareFY(getLastFY(selectedFY)) }, [selectedFY])
  useEffect(() => { load() }, [selectedFY, reportFilter, customRange.start, customRange.end, selectedAccountId, globalRefreshTrigger, isComparative, compareFY])

  async function load() {
    if (!selectedAccountId && accounts.length > 0) return
    if (isComparative) {
      const compDates = getDatesForFY(compareFY)
      const res = await getComparativeBalanceSheet(effectiveDates.end, compDates.end, selectedAccountId)
      setData(res)
    } else {
      const res = await getBalanceSheet(effectiveDates.start, effectiveDates.end, selectedAccountId)
      setData(res)
    }
  }

  function getAllGroupIds(groups: any[]): string[] {
    const ids: string[] = []
    function traverse(g: any) {
      ids.push(g.id)
      if (g.children) g.children.forEach(traverse)
    }
    groups.forEach(traverse)
    return ids
  }

  const allGroupIds = data ? [...getAllGroupIds(data.assets), ...getAllGroupIds(data.liabilities)] : []
  const areAllExpanded = allGroupIds.length > 0 && allGroupIds.every(id => expanded[id])

  function handleToggleAll() {
    if (areAllExpanded) {
      setExpanded({})
    } else {
      const next: Record<string, boolean> = {}
      allGroupIds.forEach(id => { next[id] = true })
      setExpanded(next)
    }
  }

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  /* ── Export handlers ── */
  function flattenNode(node: any, level = 0, side: 'Liability' | 'Asset'): any[] {
    if (!showZeroValues && Math.abs(node.balance) < 0.1) return []
    let rows: any[] = []
    
    rows.push({
      Side: side,
      Level: level,
      Type: 'Group',
      Name: "  ".repeat(level) + cleanName(node.name),
      Balance: node.balance,
      ...(isComparative ? { Previous: node.prevBalance || 0, Variance: node.variance || 0, Pct: node.pctChange || 0 } : {})
    })

    node.ledgers?.forEach((l: any) => {
      const displayBal = l.displayBalance ?? l.balance
      const prevBal = l.prevDisplayBalance ?? l.prevBalance ?? 0
      if (!showZeroValues && Math.abs(displayBal) < 0.1 && (!isComparative || Math.abs(prevBal) < 0.1)) return
      rows.push({
        Side: side,
        Level: level + 1,
        Type: 'Ledger',
        Name: "  ".repeat(level + 1) + cleanName(l.name),
        Balance: displayBal,
        ...(isComparative ? { Previous: prevBal, Variance: l.variance || 0, Pct: l.pctChange || 0 } : {})
      })
    })

    node.children?.forEach((c: any) => {
      rows.push(...flattenNode(c, level + 1, side))
    })

    return rows
  }

  async function handleExportExcel() {
    if (!data) return
    try {
      const XLSX = await import('xlsx')
      const liabs = data.liabilities.flatMap((g: any) => flattenNode(g, 0, 'Liability'))
      const assets = data.assets.flatMap((g: any) => flattenNode(g, 0, 'Asset'))
      const exportData = [...liabs, ...assets]
      
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet")
      XLSX.writeFile(wb, `Balance_Sheet_${selectedFY}.xlsx`)
    } catch (e) {
      console.error(e)
      alert("Failed to export Excel.")
    }
  }

  async function handleExportPDF() {
    if (!data) return
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF('p', 'pt', 'a4')
      
      const liabs = data.liabilities.flatMap((g: any) => flattenNode(g, 0, 'Liability'))
      const assets = data.assets.flatMap((g: any) => flattenNode(g, 0, 'Asset'))
      const rows = [...liabs, ...assets]
      
      doc.setFontSize(16)
      doc.text(`Balance Sheet - FY ${selectedFY}`, 40, 40)
      
      doc.setFontSize(10)
      doc.text(isComparative ? `Compared with FY ${compareFY}` : '', 40, 60)
      
      const headers = isComparative 
        ? [["Side", "Name", "FY " + selectedFY, "FY " + compareFY, "Variance", "% Change"]]
        : [["Side", "Name", "Balance"]]
        
      const body = rows.map(r => {
        if (isComparative) {
          return [r.Side, r.Name, fmtIN(r.Balance), fmtIN(r.Previous), fmtIN(r.Variance), r.Pct ? r.Pct.toFixed(1) + '%' : '']
        }
        return [r.Side, r.Name, fmtIN(r.Balance)]
      })
      
      autoTable(doc, {
        startY: 70,
        head: headers,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [49, 46, 129] },
        didParseCell: (hookData: any) => {
          if (hookData.section === 'body' && hookData.column.index === 1) {
            const rowData = rows[hookData.row.index]
            if (rowData && rowData.Type === 'Group') {
              hookData.cell.styles.fontStyle = 'bold'
            }
          }
        }
      })
      
      doc.save(`Balance_Sheet_${selectedFY}.pdf`)
    } catch (e) {
      console.error(e)
      alert("Failed to export PDF.")
    }
  }

  /* ── Row renderers ── */
  function renderGroup(group: any, level = 0): React.ReactElement | null {
    if (!showZeroValues && Math.abs(group.balance) < 0.1) return null

    const isOpen = !!expanded[group.id]
    const hasChildren = group.children.length > 0 || group.ledgers.length > 0
    const sortedLedgers  = [...group.ledgers].sort((a: any, b: any) => a.name.localeCompare(b.name))
    const sortedChildren = [...group.children].sort((a: any, b: any) => a.name.localeCompare(b.name))

    // Visual depth cues
    const isRoot = level === 0
    const folderColor = isRoot ? '#6366f1' : level === 1 ? '#3b82f6' : '#64748b'
    const rowBg = isRoot ? 'linear-gradient(90deg, #f8faff 0%, #ffffff 100%)' : 'transparent'
    const rowBorder = isRoot ? '1px solid #e8eaf6' : 'none'

    return (
      <div key={group.id} style={{ marginBottom: isRoot ? 1 : 0 }}>
        <div
          onClick={() => {
            if (group.ledgers.length === 1 && group.children.length === 0) {
              setSelectedLedgerId(group.ledgers[0].id)
            } else if (hasChildren) {
              toggle(group.id)
            }
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isRoot ? '1px 4px' : level === 1 ? '0px 2px' : '0px 1px',
            borderRadius: isRoot ? 5 : 3,
            background: rowBg,
            border: rowBorder,
            cursor: hasChildren || (group.ledgers.length === 1) ? 'pointer' : 'default',
            gap: 8,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => {
            if (!isRoot) e.currentTarget.style.background = 'rgba(99,102,241,0.04)'
          }}
          onMouseLeave={e => {
            if (!isRoot) e.currentTarget.style.background = 'transparent'
          }}
        >
          {/* Left: icon + name */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            {/* Toggle caret */}
            <span style={{ width: 16, flexShrink: 0, color: '#475569', display: 'flex', alignItems: 'center' }}>
              {hasChildren
                ? (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
                : null}
            </span>
            {/* Icon */}
            <span style={{ flexShrink: 0 }}>
              <Folder size={isRoot ? 14 : 12} color={folderColor} fill={isRoot ? `${folderColor}20` : 'none'} />
            </span>
            {/* Name */}
            <span style={{
              fontSize: isRoot ? 12.5 : level === 1 ? 12 : 11.5,
              fontWeight: isRoot ? 800 : 700,
              color: '#000000',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }} title={cleanName(group.name)}>
              {cleanName(group.name)}
            </span>
          </span>

          {/* Right: amounts */}
          {isComparative ? (
            <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 140px', gap: 8, flexShrink: 0, textAlign: 'right' }}>
              <Amt v={group.balance} bold={isRoot} size={isRoot ? 13 : 12} />
              <Amt v={group.prevBalance || 0} dimmed size={isRoot ? 12.5 : 11.5} />
              <VarCell variance={group.variance || 0} pct={group.pctChange || 0} />
            </div>
          ) : (
            <Amt v={group.balance} bold={isRoot} size={isRoot ? 13 : 12} minWidth={140} />
          )}
        </div>

        {/* Children */}
        {isOpen && (
          <div style={{
            marginLeft: 14,
            borderLeft: '1px solid #e8eaf6',
            paddingLeft: 6,
            marginTop: 0,
            marginBottom: 0
          }}>
            {sortedLedgers.map((l: any) => {
              const displayBal = l.displayBalance ?? l.balance
              const prevBal = l.prevDisplayBalance ?? l.prevBalance ?? 0
              if (!showZeroValues && Math.abs(displayBal) < 0.1 && (!isComparative || Math.abs(prevBal) < 0.1)) return null
              const isReadOnly = l.readOnly
              const isExpense  = l.groupType === 'EXPENSE'
              const ledgerColor = isReadOnly ? '#8b5cf6' : '#3b82f6'

              return (
                <div
                  key={l.id}
                  onClick={() => !isReadOnly && setSelectedLedgerId(l.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '2px 2px',
                    borderRadius: 3,
                    cursor: isReadOnly ? 'default' : 'pointer',
                    gap: 8,
                    transition: 'background 0.12s',
                    background: isReadOnly ? 'rgba(139,92,246,0.03)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isReadOnly) e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }}
                  onMouseLeave={e => { if (!isReadOnly) e.currentTarget.style.background = isReadOnly ? 'rgba(139,92,246,0.03)' : 'transparent' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <FileText size={11} color={isReadOnly ? '#8b5cf6' : '#64748b'} style={{ flexShrink: 0 }} />
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: isReadOnly ? '#6d28d9' : '#000000',
                      fontStyle: isReadOnly ? 'italic' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={cleanName(l.name)}>
                      {cleanName(l.name)}
                    </span>
                    {isExpense && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 800, color: '#dc2626',
                        background: '#fef2f2', padding: '0px 3px',
                        borderRadius: 2, flexShrink: 0, letterSpacing: '0.05em'
                      }}>EXP</span>
                    )}
                    {!isReadOnly && (
                      <span style={{ fontSize: 10, color: '#2563eb', flexShrink: 0, opacity: 0.7 }} title="View Ledger">↗</span>
                    )}
                  </span>

                  {isComparative ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 140px', gap: 8, flexShrink: 0, textAlign: 'right' }}>
                      <span style={{
                        fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 650,
                        color: isReadOnly ? (displayBal >= 0 ? '#059669' : '#dc2626') : '#000000',
                        whiteSpace: 'nowrap'
                      }}>
                        {fmtIN(displayBal)}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: '#475569', whiteSpace: 'nowrap' }}>
                        {fmtIN(prevBal)}
                      </span>
                      <VarCell variance={l.variance || 0} pct={l.pctChange || 0} />
                    </div>
                  ) : (
                    <span style={{
                      fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 650, flexShrink: 0,
                      color: isReadOnly
                        ? (displayBal >= 0 ? '#059669' : '#dc2626')
                        : isExpense ? '#dc2626' : '#000000',
                      marginLeft: 8, whiteSpace: 'nowrap',
                      minWidth: 140, textAlign: 'right', display: 'inline-block'
                    }}>
                      {fmtIN(displayBal)}
                    </span>
                  )}
                </div>
              )
            })}
            {sortedChildren.map((child: any) => renderGroup(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  /* ── Year close logic (unchanged) ── */
  async function handleYearClose() {
    if (!window.confirm(`Close Financial Year ${selectedFY}?\n\nThis will post a closing journal entry transferring all Income and Expense balances to Capital Account.`)) return

    const allGroups  = getStoredGroups()
    const allLedgers = getStoredLedgers()
    const allEntries = getStoredEntries()
    const allVouchers = getStoredVouchers()

    const getGroupType = (groupId: string): string => {
      let current = allGroups.find((g: any) => g.id === groupId)
      while (current) {
        if (current.type) return current.type
        current = allGroups.find((g: any) => g.id === current?.parent)
      }
      return "ASSET"
    }

    function getFinancialYear(dateStr: string) {
      if (!dateStr) return "1900-1901"
      const d = new Date(dateStr)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`
    }

    const capitalLedger = allLedgers.find((l: any) =>
      getGroupType(l.groupId) === 'LIABILITY' && l.name.toLowerCase().includes('capital')
    )
    if (!capitalLedger) {
      alert("Could not find a Capital Account ledger. Please create one under Capital Account group first.")
      return
    }

    const fyLedgers = allLedgers.filter((l: any) => {
      const rootType = getGroupType(l.groupId)
      return rootType === 'INCOME' || rootType === 'EXPENSE'
    })

    const lines: any[] = []
    let netPL = 0

    for (const ledger of fyLedgers) {
      const rootType = getGroupType(ledger.groupId)
      const ledgerEntries = allEntries.filter((e: any) => {
        const voucher = allVouchers.find((v: any) => v.id === e.voucherId)
        return e.ledgerId === ledger.id && voucher && getFinancialYear(voucher.date) === selectedFY
      })

      let balance = 0
      for (const entry of ledgerEntries) {
        balance += ((entry as any).side === 'dr' ? 1 : -1) * ((entry as any).amount || 0)
      }

      if (Math.abs(balance) < 0.01) continue

      if (rootType === 'INCOME') {
        lines.push({ id: uuid(), ledgerId: ledger.id, side: 'dr', amount: Math.abs(balance) })
        netPL += balance
      } else {
        lines.push({ id: uuid(), ledgerId: ledger.id, side: 'cr', amount: Math.abs(balance) })
        netPL -= balance
      }
    }

    if (lines.length === 0) {
      alert("No Income/Expense entries found for this FY to close.")
      return
    }

    lines.push({
      id: uuid(),
      ledgerId: capitalLedger.id,
      side: netPL >= 0 ? 'cr' : 'dr',
      amount: Math.abs(netPL)
    })

    const endYearStr = selectedFY.split("-")[1]
    const endYear = endYearStr.length === 2 ? `20${endYearStr}` : endYearStr
    const closeDate = `${endYear}-03-31`

    await createVoucher({
      id: uuid(),
      date: closeDate,
      type: "journal",
      narration: `Year End Closing Entry — FY ${selectedFY}`,
      lines,
    })

    alert(`✅ FY ${selectedFY} closed. Net P&L transferred to ${capitalLedger.name}.`)
    load()
  }

  /* ── Loading state ── */
  if (!data) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', flexDirection: 'column', gap: 12
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid #e2e8f0', borderTopColor: '#6366f1',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ color: '#64748b', fontSize: 14 }}>Loading Balance Sheet…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const isBalanced    = Math.abs(data.totalAssets - data.totalLiabilities) < 0.01
  const totalNet      = data.totalAssets
  const plGroup       = data.liabilities?.find((g: any) => g.name?.toLowerCase().includes('profit') || g.name?.toLowerCase().includes('p&l') || g.name?.toLowerCase().includes('p & l'))
  const plValue       = plGroup?.balance || 0
  const displayFY     = reportFilter === 'last' ? getLastFY(selectedFY) : reportFilter === 'previous' ? getPreviousFY(selectedFY) : selectedFY
  const dateLabel     = isComparative
    ? `Comparative: FY ${displayFY} vs FY ${compareFY}`
    : reportFilter === 'custom'
      ? `From ${formatDateDDMMMYYYY(effectiveDates.start)} to ${formatDateDDMMMYYYY(effectiveDates.end)}`
      : `As at 31 March — FY ${displayFY}`

  return (
    <div style={{ padding: '16px 20px', background: '#f1f5f9', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .bs-row-hover:hover { background: rgba(99,102,241,0.04) !important; }
        .bs-ledger-hover:hover { background: rgba(59,130,246,0.05) !important; }
      `}</style>

      {/* ─── Shared Max-Width Container for Header & Main Card ─── */}
      <div style={{
        maxWidth: isComparative ? 1600 : 1380,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>

        {/* ─── Single Compact Header Bar (replaces banner + stat cards + separate toolbar) ─── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e40af 100%)',
          borderRadius: 10,
          padding: '10px 16px',
          marginBottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: '0 3px 14px rgba(99,102,241,0.18)',
          position: 'sticky',
          top: 10,
          zIndex: 20,
          flexWrap: 'nowrap'
        }}>
        {/* Left: title + net worth + balanced */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scale size={14} color="#a5b4fc" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Balance Sheet</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Worth</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>₹{fmtIN(totalNet)}</span>
          </div>
          {plValue !== 0 && (
            <>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&amp;L</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: plValue >= 0 ? '#86efac' : '#fca5a5'
                }}>
                  {plValue >= 0 ? '+' : ''}{fmtCompact(plValue)}
                </span>
              </div>
            </>
          )}
          {isBalanced ? (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#4ade80',
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: 20, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
            }}>
              <CheckCircle2 size={11} color="#4ade80" /> BALANCED
            </span>
          ) : (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#fca5a5',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 20, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
            }}>
              <AlertTriangle size={11} color="#f87171" /> UNBALANCED
            </span>
          )}
        </div>

        {/* Right: view controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Comparative toggle */}
          <button
            onClick={() => setIsComparative(!isComparative)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              border: isComparative ? '1px solid #a5b4fc' : '1px solid rgba(255,255,255,0.2)',
              background: isComparative ? '#eef2ff' : 'rgba(255,255,255,0.08)',
              color: isComparative ? '#4f46e5' : '#c7d2fe',
              transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
          >
            <ArrowUpDown size={11} /> Comparative
          </button>

          {/* Compare FY picker */}
          {isComparative && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: 6, border: '1px solid #a5b4fc' }}>
              <span style={{ fontSize: 10, color: '#c7d2fe', fontWeight: 600 }}>vs:</span>
              <select
                value={compareFY}
                onChange={e => setCompareFY(e.target.value)}
                style={{ background: 'transparent', border: 'none', fontSize: 11, fontWeight: 700, color: '#c7d2fe', outline: 'none', cursor: 'pointer' }}
              >
                <option value="2025-2026" style={{ color: '#1e293b' }}>FY 2025-26</option>
                <option value="2024-2025" style={{ color: '#1e293b' }}>FY 2024-25</option>
                <option value="2023-2024" style={{ color: '#1e293b' }}>FY 2023-24</option>
                <option value="2022-2023" style={{ color: '#1e293b' }}>FY 2022-23</option>
                <option value="2021-2022" style={{ color: '#1e293b' }}>FY 2021-22</option>
              </select>
            </div>
          )}

          {/* Show Zeros */}
          <button
            onClick={() => setShowZeroValues(!showZeroValues)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              border: showZeroValues ? '1px solid #a5b4fc' : '1px solid rgba(255,255,255,0.2)',
              background: showZeroValues ? '#eef2ff' : 'rgba(255,255,255,0.08)',
              color: showZeroValues ? '#4f46e5' : '#c7d2fe',
              transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
          >
            {showZeroValues ? <Eye size={11} /> : <EyeOff size={11} />}
            {showZeroValues ? 'Hide Zeros' : 'Show Zeros'}
          </button>

          {/* Expand All */}
          <button
            onClick={handleToggleAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#c7d2fe',
              transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
          >
            <ChevronsUpDown size={11} />
            {areAllExpanded ? 'Collapse' : 'Expand All'}
          </button>

          {/* PDF */}
          <button
            onClick={handleExportPDF}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#c7d2fe',
              transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
          >
            <Printer size={11} /> PDF
          </button>
          
          {/* Excel */}
          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#c7d2fe',
              transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
          >
            <Download size={11} /> Excel
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '4px 8px', fontSize: 11,
              borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#c7d2fe'
            }}
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* ─── Main Card ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        width: '100%'
      }}>

        {/* ── Column Headers (Comparative) ── */}
        {isComparative && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2px 1fr',
            gap: 0,
            background: '#f8fafc',
            borderBottom: '1px solid #e8eaf6',
            padding: '8px 0'
          }}>
            {/* Lib headers */}
            <div style={{ paddingLeft: 20, display: 'flex', justifyContent: 'space-between', paddingRight: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Liabilities &amp; Equity
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 140px', gap: 8, textAlign: 'right' }}>
                {[displayFY, compareFY, 'Variance / %'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</span>
                ))}
              </div>
            </div>
            <div style={{ background: '#e2e8f0' }} />
            {/* Assets headers */}
            <div style={{ paddingLeft: 20, display: 'flex', justifyContent: 'space-between', paddingRight: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Assets
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 140px', gap: 8, textAlign: 'right' }}>
                {[displayFY, compareFY, 'Variance / %'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Two-column ledger body ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0 }}>

          {/* LIABILITIES */}
          <div style={{ padding: '12px 20px 16px 20px' }}>
            {!isComparative && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Liabilities &amp; Equity
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 140, textAlign: 'right', display: 'inline-block' }}>
                  Balance
                </span>
              </div>
            )}
            {data.liabilities.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No liability balances for this period.</div>
              : data.liabilities.map((g: any) => renderGroup(g))
            }
          </div>

          {/* Vertical divider */}
          <div style={{ background: 'linear-gradient(180deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)' }} />

          {/* ASSETS */}
          <div style={{ padding: '12px 20px 16px 20px' }}>
            {!isComparative && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Assets
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 140, textAlign: 'right', display: 'inline-block' }}>
                  Balance
                </span>
              </div>
            )}
            {data.assets.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No asset balances for this period.</div>
              : data.assets.map((g: any) => renderGroup(g))
            }
          </div>
        </div>

        {/* ── Totals Bar ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr',
          background: '#f8fafc',
          borderTop: '2px solid #1e1b4b',
          marginTop: 4
        }}>
          {/* Liabilities total */}
          <div style={{
            padding: '6px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 850, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Liabilities &amp; Equity
            </span>
            {isComparative ? (
              <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 140px', gap: 8, textAlign: 'right' }}>
                <Amt v={data.totalLiabilities} bold size={14.5} />
                <Amt v={data.prevTotalLiabilities || 0} dimmed size={14} />
                <VarCell variance={data.liabilitiesVariance || 0} pct={data.liabilitiesPctChange || 0} />
              </div>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 850, color: '#000000', fontVariantNumeric: 'tabular-nums', minWidth: 140, textAlign: 'right', display: 'inline-block' }}>
                ₹{fmtIN(data.totalLiabilities)}
              </span>
            )}
          </div>

          <div style={{ background: '#1e1b4b' }} />

          {/* Assets total */}
          <div style={{
            padding: '6px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 850, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Assets
              </span>
              {isBalanced && (
                <span style={{
                  fontSize: 10.5, fontWeight: 800, color: '#16a34a',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  padding: '1px 6px', borderRadius: 10, letterSpacing: '0.06em'
                }}>✓ BALANCED</span>
              )}
            </div>
            {isComparative ? (
              <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 140px', gap: 8, textAlign: 'right' }}>
                <Amt v={data.totalAssets} bold size={14.5} />
                <Amt v={data.prevTotalAssets || 0} dimmed size={14} />
                <VarCell variance={data.assetsVariance || 0} pct={data.assetsPctChange || 0} />
              </div>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 850, color: '#000000', fontVariantNumeric: 'tabular-nums', minWidth: 140, textAlign: 'right', display: 'inline-block' }}>
                ₹{fmtIN(data.totalAssets)}
              </span>
            )}
          </div>
        </div>

      </div>

    </div>

      {/* ─── Modals ─── */}
      {selectedLedgerId && (
        <div style={{ position: 'relative', zIndex: 1000 }}>
          <LedgerDrilldownModal
            key={`${selectedLedgerId}-${refreshKey}`}
            ledgerId={selectedLedgerId}
            startDate={effectiveDates.start}
            endDate={effectiveDates.end}
            accountId={selectedAccountId}
            onClose={() => setSelectedLedgerId(null)}
            onVoucherClick={(vid) => setSelectedVoucherId(vid)}
            onNewVoucher={() => setSelectedVoucherId('new')}
          />
        </div>
      )}

      {selectedVoucherId && (
        <div style={{ position: 'relative', zIndex: 2000 }}>
          <VoucherModal
            voucherId={selectedVoucherId === 'new' ? undefined : selectedVoucherId}
            selectedLedger={selectedLedgerId || undefined}
            accountId={selectedAccountId}
            onClose={() => setSelectedVoucherId(null)}
            onSaved={() => {
              setSelectedVoucherId(null)
              setRefreshKey(k => k + 1)
              load()
            }}
          />
        </div>
      )}
    </div>
  )
}

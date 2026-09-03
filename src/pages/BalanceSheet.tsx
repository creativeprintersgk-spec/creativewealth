import React, { useEffect, useState } from "react"
import { getBalanceSheet } from "../services/balanceSheet"
import { useFY } from "../FYContext"
import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, createVoucher, getStoredAccounts } from "../logic"
import { v4 as uuid } from "uuid"
import LedgerDrilldownModal from "../LedgerDrilldownModal"
import VoucherModal from "../VoucherModal"
import { useFamily } from "../contexts/FamilyContext"
import { Users, ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react'

export default function BalanceSheet() {
  const { selectedFY, reportFilter, customRange, selectedAccountId, setSelectedAccountId, globalRefreshTrigger } = useFY()
  const { activeFamilyId } = useFamily()
  
  const [data, setData] = useState<{ assets: any[], liabilities: any[], totalAssets: number, totalLiabilities: number } | null>(null)
  
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);

  useEffect(() => {
    if (accounts.length > 0) {
      if (!accounts.some(a => a.id === selectedAccountId)) {
        setSelectedAccountId(accounts[0].id);
      }
    } else {
      setSelectedAccountId('');
    }
  }, [accounts, selectedAccountId]);

  // View Controls
  const [showZeroValues, setShowZeroValues] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  
  // Drill-down State
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const getDatesForFY = (fyStr: string) => {
     const [start] = fyStr.split("-")
     return { start: `${start}-04-01`, end: `${parseInt(start) + 1}-03-31` }
  }
  const getLastFY = (fyStr: string) => {
     const [start, end] = fyStr.split("-")
     return `${parseInt(start) - 1}-${parseInt(end) - 1}`
  }
  const getPreviousFY = (fyStr: string) => {
     const [start, end] = fyStr.split("-")
     return `${parseInt(start) - 2}-${parseInt(end) - 2}`
  }

  const effectiveDates = (() => {
    if (reportFilter === 'current') return getDatesForFY(selectedFY)
    if (reportFilter === 'last') return getDatesForFY(getLastFY(selectedFY))
    if (reportFilter === 'previous') return getDatesForFY(getPreviousFY(selectedFY))
    return customRange
  })()

  useEffect(() => { load() }, [selectedFY, reportFilter, customRange.start, customRange.end, selectedAccountId, globalRefreshTrigger])

  async function load() {
    if (!selectedAccountId && accounts.length > 0) return;
    const res = await getBalanceSheet(effectiveDates.start, effectiveDates.end, selectedAccountId)
    setData(res)
  }

  function cleanLedgerName(name: string): string {
    let cleaned = name.replace(/\s*\(?ISIN\s+[A-Z0-9]{12}\)?/gi, '');
    cleaned = cleaned.replace(/\s*\([A-Z]{2}[A-Z0-9]{10}\)/gi, '');
    cleaned = cleaned.replace(/\s*\(\d[\d\s\/,.-]*\)/gi, '');
    cleaned = cleaned.trim().replace(/\s*-\s*$/, '');
    return cleaned.trim();
  }

  function getAllGroupIds(groups: any[]): string[] {
    const ids: string[] = []
    function traverse(g: any) {
      ids.push(g.id)
      if (g.children) {
        g.children.forEach(traverse)
      }
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
      const newExpanded: Record<string, boolean> = {}
      allGroupIds.forEach(id => {
        newExpanded[id] = true
      })
      setExpanded(newExpanded)
    }
  }

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openLedger(ledgerId: string) {
    setSelectedLedgerId(ledgerId)
  }

  function renderGroup(group: any, level = 0): React.ReactElement | null {
    if (!showZeroValues && Math.abs(group.balance) < 0.1) return null

    const isOpen = !!expanded[group.id]
    const hasChildren = group.children.length > 0 || group.ledgers.length > 0

    // Sort ledgers and children alphabetically (ABCD-wise)
    const sortedLedgers = [...group.ledgers].sort((a: any, b: any) => a.name.localeCompare(b.name));
    const sortedChildren = [...group.children].sort((a: any, b: any) => a.name.localeCompare(b.name));

    return (
      <div key={group.id} style={{ marginBottom: level === 0 ? 8 : 4 }}>
        <div
          style={{
            fontWeight: level === 0 ? 700 : 600,
            fontSize: level === 0 ? 14 : 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: level === 0 ? '#1e293b' : '#475569',
            cursor: hasChildren ? 'pointer' : 'default',
            padding: level === 0 ? '6px 12px' : '4px 8px',
            borderRadius: 6,
            background: level === 0 ? 'rgba(241, 245, 249, 0.7)' : 'transparent',
            border: level === 0 ? '1px solid rgba(226, 232, 240, 0.5)' : 'none',
            gap: 8,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={() => {
            if (group.ledgers.length === 1 && group.children.length === 0) {
              openLedger(group.ledgers[0].id);
            } else if (hasChildren) {
              toggle(group.id);
            }
          }}
          onMouseEnter={e => { if (hasChildren && level > 0) e.currentTarget.style.background = 'rgba(241, 245, 249, 0.5)' }}
          onMouseLeave={e => { if (hasChildren && level > 0) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {hasChildren
              ? <span 
                  style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(group.id);
                  }}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              : <span style={{ display: 'inline-block', width: 16, flexShrink: 0 }} />}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }} title={cleanLedgerName(group.name)}>
              {level === 0 && <Folder size={15} color="#6366f1" />}
              {cleanLedgerName(group.name)}
            </span>
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8, fontWeight: level === 0 ? 800 : 600, color: level === 0 ? '#0f172a' : '#334155' }}>
            {group.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {isOpen && (
          <div style={{ 
            position: 'relative', 
            marginLeft: 16, 
            borderLeft: '1px solid #e2e8f0', 
            paddingLeft: 8,
            marginTop: 4
          }}>
            {sortedLedgers.map((l: any) => {
              if (!showZeroValues && Math.abs(l.displayBalance ?? l.balance) < 0.1) return null;
              return (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                    color: l.readOnly ? '#8b5cf6' : '#3b82f6',
                    fontStyle: l.readOnly ? 'italic' : 'normal',
                    cursor: l.readOnly ? 'default' : 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: l.readOnly ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                  onClick={() => !l.readOnly && openLedger(l.id)}
                  onMouseEnter={e => { if (!l.readOnly) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)' }}
                  onMouseLeave={e => { if (!l.readOnly) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <FileText size={13} color={l.readOnly ? '#8b5cf6' : '#94a3b8'} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={cleanLedgerName(l.name)}>
                      {cleanLedgerName(l.name)}
                    </span>
                    {l.groupType === 'EXPENSE' && (
                      <span style={{ fontSize: 8, color: '#dc2626', background: '#fef2f2', padding: '1px 4px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>EXP</span>
                    )}
                  </span>
                  <span style={{ color: l.readOnly ? (l.balance >= 0 ? '#059669' : '#dc2626') : (l.groupType === 'EXPENSE' ? '#dc2626' : '#4b5563'), flexShrink: 0, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {(l.displayBalance ?? l.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
            {sortedChildren.map((child: any) => renderGroup(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  async function handleYearClose() {
    if (!window.confirm(`Close Financial Year ${selectedFY}?\n\nThis will post a closing journal entry transferring all Income and Expense balances to Capital Account.`)) return

    const allGroups = getStoredGroups()
    const allLedgers = getStoredLedgers()
    const allEntries = getStoredEntries()
    const allVouchers = getStoredVouchers()

    // Resolve root type for any group by walking up the parent chain
    const getGroupType = (groupId: string): string => {
      let current = allGroups.find((g: any) => g.id === groupId)
      while (current) {
        if (current.type) return current.type
        current = allGroups.find((g: any) => g.id === current?.parent)
      }
      return "ASSET"
    }

    // Helper: FY from a date string
    function getFinancialYear(dateStr: string) {
      if (!dateStr) return "1900-1901"
      const d = new Date(dateStr)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`
    }

    // Capital account ledger
    const capitalLedger = allLedgers.find((l: any) =>
      getGroupType(l.groupId) === 'LIABILITY' && l.name.toLowerCase().includes('capital')
    )
    if (!capitalLedger) {
      alert("Could not find a Capital Account ledger. Please create one under Capital Account group first.")
      return
    }

    // Calculate each Income/Expense ledger balance up to and including selectedFY
    const entriesByLedger: Record<string, any[]> = {}
    allEntries.forEach((e: any) => {
      const v = allVouchers.find((v: any) => v.id === e.voucherId)
      if (!v) return
      const fy = getFinancialYear(v.date)
      if (fy <= selectedFY) {
        if (!entriesByLedger[e.ledgerId]) entriesByLedger[e.ledgerId] = []
        entriesByLedger[e.ledgerId].push(e)
      }
    })

    const getLedgerBalance = (ledger: any) => {
      let dr = 0;
      let cr = 0;
      ;(entriesByLedger[ledger.id] || []).forEach((e: any) => {
        dr += e.debit || 0
        cr += e.credit || 0
      })
      const type = getGroupType(ledger.groupId)
      // Income: net = CR - DR, Expense: net = DR - CR
      return type === 'INCOME' ? (cr - dr) : (dr - cr)
    }

    const lines: any[] = []

    allLedgers.forEach((l: any) => {
      const type = getGroupType(l.groupId)
      if (type !== 'INCOME' && type !== 'EXPENSE') return

      const bal = getLedgerBalance(l)
      if (bal === 0) return

      if (type === 'INCOME') {
        // Income has credit balance (bal > 0 means CR > DR). To close: DR the income ledger, CR capital.
        lines.push({ ledgerId: l.id, debit: Math.abs(bal), credit: 0 })
        lines.push({ ledgerId: capitalLedger.id, debit: 0, credit: Math.abs(bal) })
      } else {
        // Expense has debit balance (bal > 0 means DR > CR). To close: CR the expense ledger, DR capital.
        lines.push({ ledgerId: capitalLedger.id, debit: Math.abs(bal), credit: 0 })
        lines.push({ ledgerId: l.id, debit: 0, credit: Math.abs(bal) })
      }
    })

    if (lines.length === 0) {
      alert(`No Income or Expense balances found for FY ${selectedFY}.`)
      return
    }

    // Closing date = 31-Mar of end year
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

  if (!data) return <div style={{ padding: "2rem", color: '#6b7280' }}>Loading Balance Sheet...</div>

  const isBalanced = Math.abs(data.totalAssets - data.totalLiabilities) < 0.01

  return (
    <div style={{ padding: "2rem", background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ background: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", maxWidth: "1200px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "bold", margin: 0, color: '#111827' }}>Balance Sheet</h2>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
              {reportFilter === 'custom' ? `From ${effectiveDates.start} to ${effectiveDates.end}` : 
               reportFilter === 'previous' ? `As at 31 March — FY ${getPreviousFY(selectedFY)}` :
               `As at 31 March — FY ${reportFilter === 'last' ? getLastFY(selectedFY) : selectedFY}`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <Users size={16} color="#2563eb" />
              <select 
                value={selectedAccountId} 
                onChange={e => setSelectedAccountId(e.target.value)}
                style={{ background: 'transparent', border: 'none', fontSize: '12px', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.accountName.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#f8fafc', padding: '6px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <input type="checkbox" checked={showZeroValues} onChange={e => setShowZeroValues(e.target.checked)} /> Show Zero Values
            </label>
            <button onClick={handleToggleAll} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              {areAllExpanded ? 'Collapse All' : 'Expand All'}
            </button>
            {!isBalanced && (
              <span style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: 4 }}>
                ⚠️ Unbalanced by {Math.abs(data!.totalAssets - data!.totalLiabilities).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* Three-column layout for perfect centering */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0 }}>

          {/* LIABILITIES */}
          <div style={{ paddingRight: "20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 16 }}>
              Liabilities &amp; Equity
            </h3>
            {data.liabilities.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No liability balances for this FY.</div>
              : data.liabilities.map(g => renderGroup(g))
            }
          </div>

          {/* Vertical Divider */}
          <div style={{ width: "1px", background: "#e5e7eb", minHeight: "100%" }} />

          {/* ASSETS */}
          <div style={{ paddingLeft: "20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 16 }}>
              Assets
            </h3>
            {data.assets.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No asset balances for this FY.</div>
              : data.assets.map(g => renderGroup(g))
            }
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, marginTop: "32px", borderTop: "2px solid #111827", paddingTop: "16px" }}>
          <div style={{ paddingRight: "20px", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "15px" }}>
            <span>Total Liabilities &amp; Equity</span>
            <span>{data.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ width: "1px" }} />
          <div style={{ paddingLeft: "20px", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "15px" }}>
            <span>Total Assets</span>
            <span>{data.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

      </div>

      {/* Drill-down Modals */}
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
              setSelectedVoucherId(null);
              setRefreshKey(k => k + 1);
              load();
            }}
          />
        </div>
      )}
    </div>
  )
}


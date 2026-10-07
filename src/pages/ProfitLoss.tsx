import React, { useEffect, useState } from "react"
import { getProfitLoss } from "../services/profitLoss"
import { useFY } from "../FYContext"
import { getStoredAccounts, formatDateDDMMMYYYY } from "../logic"
import LedgerDrilldownModal from "../LedgerDrilldownModal"
import VoucherModal from "../VoucherModal"
import { useFamily } from "../contexts/FamilyContext"
import { Users } from 'lucide-react'

export default function ProfitLoss() {
  const { selectedFY, reportFilter, customRange, selectedAccountId, setSelectedAccountId, globalRefreshTrigger } = useFY()
  const { activeFamilyId } = useFamily()
  
  const [data, setData] = useState<{ incomes: any[], expenses: any[], totalIncome: number, totalExpense: number, netProfit: number } | null>(null)
  
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
    const res = await getProfitLoss(effectiveDates.start, effectiveDates.end, selectedAccountId)
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

  const allGroupIds = data ? [...getAllGroupIds(data.expenses), ...getAllGroupIds(data.incomes)] : []
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
      <div key={group.id} style={{ marginBottom: level === 0 ? 6 : 2 }}>
        <div
          style={{
            fontWeight: level === 0 ? 700 : 600,
            fontSize: level === 0 ? 14 : 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: level === 0 ? '#111827' : '#374151',
            cursor: hasChildren ? 'pointer' : 'default',
            padding: '2px 8px',
            borderRadius: 4,
            background: level === 0 ? '#f9fafb' : 'transparent',
            gap: 8,
          }}
          onClick={() => hasChildren && toggle(group.id)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            {hasChildren
              ? <span style={{ fontSize: 8, color: '#6b7280', display: 'inline-block', width: 12, flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
              : <span style={{ display: 'inline-block', width: 12, flexShrink: 0 }} />}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={cleanLedgerName(group.name)}>
              {cleanLedgerName(group.name)}
            </span>
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
            {group.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {isOpen && (
          <div style={{ 
            position: 'relative', 
            marginLeft: 14, 
            borderLeft: '1px solid #d1d5db', 
            paddingLeft: 6 
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
                    fontSize: 12,
                    color: l.readOnly ? '#7c3aed' : '#2563eb',
                    fontStyle: l.readOnly ? 'italic' : 'normal',
                    cursor: l.readOnly ? 'default' : 'pointer',
                    padding: '1px 8px',
                    borderRadius: 4,
                    background: l.readOnly ? 'rgba(124,58,237,0.05)' : 'transparent',
                    gap: 8,
                  }}
                  onClick={() => !l.readOnly && openLedger(l.id)}
                  onMouseEnter={e => { if (!l.readOnly) e.currentTarget.style.background = '#eff6ff' }}
                  onMouseLeave={e => { if (!l.readOnly) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={cleanLedgerName(l.name)}>
                      {cleanLedgerName(l.name)}
                    </span>
                  </span>
                  <span style={{ color: l.readOnly ? (l.balance >= 0 ? '#059669' : '#dc2626') : '#4b5563', flexShrink: 0, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
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

  if (!data) return <div style={{ padding: "2rem", color: '#6b7280' }}>Loading Profit &amp; Loss...</div>

  const isModalOpen = !!selectedLedgerId || !!selectedVoucherId
  const finalExpensesTotal = data.netProfit >= 0 ? data.totalExpense + data.netProfit : data.totalExpense
  const finalIncomesTotal = data.netProfit < 0 ? data.totalIncome + Math.abs(data.netProfit) : data.totalIncome

  return (
    <div style={{ padding: "2rem", background: "#f3f4f6", minHeight: "100vh" }}>
      <div className={isModalOpen ? "print-hide" : ""} style={{ background: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", maxWidth: "1200px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "bold", margin: 0, color: '#111827' }}>Profit &amp; Loss Statement</h2>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
              {reportFilter === 'custom' ? `From ${formatDateDDMMMYYYY(effectiveDates.start)} to ${formatDateDDMMMYYYY(effectiveDates.end)}` : 
               reportFilter === 'previous' ? `Period: 1 April to 31 March — FY ${getPreviousFY(selectedFY)}` :
               `Period: 1 April to 31 March — FY ${reportFilter === 'last' ? getLastFY(selectedFY) : selectedFY}`}
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
          </div>
        </div>

        {/* Three-column layout for perfect centering */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0 }}>

          {/* EXPENSES */}
          <div style={{ paddingRight: "20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 16 }}>
              Expenses &amp; Losses
            </h3>
            {data.expenses.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No expenses for this period.</div>
              : data.expenses.map(g => renderGroup(g))
            }
            
            {/* Net Profit display on Expense side to balance */}
            {data.netProfit >= 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', marginTop: 12, fontWeight: 700, fontSize: 12, color: '#059669', background: '#ecfdf5', borderRadius: 4 }}>
                <span>Net Profit</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {data.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Vertical Divider */}
          <div style={{ width: "1px", background: "#e5e7eb", minHeight: "100%" }} />

          {/* INCOMES */}
          <div style={{ paddingLeft: "20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 16 }}>
              Incomes &amp; Gains
            </h3>
            {data.incomes.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No incomes for this period.</div>
              : data.incomes.map(g => renderGroup(g))
            }
            
            {/* Net Loss display on Income side to balance */}
            {data.netProfit < 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', marginTop: 12, fontWeight: 700, fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 4 }}>
                <span>Net Loss</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.abs(data.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, marginTop: "32px", borderTop: "2px solid #111827", paddingTop: "16px" }}>
          <div style={{ paddingRight: "20px", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "15px" }}>
            <span>Total Expenses</span>
            <span>{finalExpensesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ width: "1px" }} />
          <div style={{ paddingLeft: "20px", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "15px" }}>
            <span>Total Incomes</span>
            <span>{finalIncomesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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

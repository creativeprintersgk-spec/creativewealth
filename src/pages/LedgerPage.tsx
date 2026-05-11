import React, { useState, useCallback, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Plus, ArrowLeft } from "lucide-react"
import { getLedgerWithBalance, getStoredLedgers, getStoredGroups, getStoredAccounts } from "../logic"
import VoucherModal from "../VoucherModal"
import LedgerModal from "../LedgerModal"
import { useFY } from "../FYContext"
import { useFamily } from "../contexts/FamilyContext"

export default function LedgerPage() {
  const { ledgerId: paramId } = useParams<{ ledgerId: string }>();
  const navigate = useNavigate();
  const { activeFamilyId } = useFamily();
  
  const [selectedLedgerId, setSelectedLedgerId] = useState(paramId || "Bank")
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [showModal, setShowModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [editingLedger, setEditingLedger] = useState<any>(null)
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null)
  const [, setRefresh] = useState(0)

  const ledgers = getStoredLedgers();
  const groups = getStoredGroups();

  useEffect(() => {
    if (paramId) {
      setSelectedLedgerId(paramId);
    }
  }, [paramId]);

  useEffect(() => {
    const currentIsValid = ledgers.find(l => l.id === selectedLedgerId || l.name === selectedLedgerId);
    if (!currentIsValid && ledgers.length > 0) {
      setSelectedLedgerId(ledgers[0].id);
    }
  }, [ledgers, selectedLedgerId]);

  const handleEdit = useCallback((id: string) => {
    setEditingVoucherId(id)
    setShowModal(true)
  }, [])

  const handleNew = useCallback(() => {
    setEditingVoucherId(null)
    setShowModal(true)
  }, [])

  const handleSaved = useCallback(() => {
    setShowModal(false)
    setEditingVoucherId(null)
    setRefresh(r => r + 1)
  }, [])

  const handleEditLedger = useCallback(() => {
    const ledger = ledgers.find(l => l.id === selectedLedgerId || l.name === selectedLedgerId);
    if (ledger) {
      setEditingLedger(ledger);
      setShowLedgerModal(true);
    }
  }, [ledgers, selectedLedgerId]);

  const handleLedgerSaved = useCallback(() => {
    setShowLedgerModal(false);
    setEditingLedger(null);
    setRefresh(r => r + 1);
  }, []);

  const { selectedFY, reportFilter, customRange } = useFY()

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

  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);

  const drilldownData = getLedgerWithBalance(selectedLedgerId, effectiveDates.start, effectiveDates.end, selectedAccountId)
  const data = Array.isArray(drilldownData) ? [] : drilldownData.transactions;
  const selectedLedger = ledgers.find(l => l.id === selectedLedgerId || l.name === selectedLedgerId);
  const selectedLedgerName = selectedLedger?.name || selectedLedgerId;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ 
              background: 'white', 
              border: '1px solid #eee', 
              borderRadius: '50%', 
              width: '32px', 
              height: '32px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ledger Account</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select 
                  value={selectedLedgerId} 
                  onChange={(e) => {
                    setSelectedLedgerId(e.target.value);
                    navigate(`/ledger/${e.target.value}`);
                  }}
                  style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 700, 
                    border: 'none', 
                    background: 'transparent', 
                    cursor: 'pointer',
                    color: '#1a1a1a',
                    outline: 'none',
                    padding: 0,
                    margin: 0
                  }}
                >
                  {ledgers.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button 
                  onClick={handleEditLedger}
                  style={{ 
                    fontSize: '0.75rem', 
                    color: '#2563eb', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    padding: '2px 4px'
                  }}
                >
                  Edit
                </button>
              </div>

              <div style={{ height: '24px', width: '1px', background: '#eee' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Account:</span>
                <select 
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontSize: '12px', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">Consolidated (All Members)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.accountName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={handleNew}>
          <Plus size={16} /> New Voucher
        </button>
      </div>

      {/* Summary Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Opening Balance</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {!Array.isArray(drilldownData) ? Math.abs(drilldownData.openingBalance).toLocaleString() : '0'}
            <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: '4px' }}>
              {!Array.isArray(drilldownData) && drilldownData.openingBalance >= 0 ? 'DR' : 'CR'}
            </span>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Debit</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#059669' }}>
            {data.reduce((sum: number, row: any) => sum + row.debit, 0).toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Credit</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#dc2626' }}>
            {data.reduce((sum: number, row: any) => sum + row.credit, 0).toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Closing Balance</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {!Array.isArray(drilldownData) ? Math.abs(drilldownData.closingBalance).toLocaleString() : '0'}
            <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: '4px' }}>
              {!Array.isArray(drilldownData) && drilldownData.closingBalance >= 0 ? 'DR' : 'CR'}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Date</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Type</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Against</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Debit</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Credit</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: '#999' }}>No transactions found for this ledger.</td>
              </tr>
            ) : (
              data.map((row: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }} className="hover-row">
                  <td style={{ padding: '1rem 1.5rem' }}>{row.date}</td>
                  <td style={{ padding: '1rem 1.5rem', textTransform: 'capitalize' }}>{row.voucherType}</td>
                  <td style={{ padding: '1rem 1.5rem', color: '#2563eb', cursor: 'pointer' }} onClick={() => handleEdit(row.voucherId)}>
                    {row.againstLedger}
                    {row.narration && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>{row.narration}</div>}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: row.debit > 0 ? '#059669' : '#ccc' }}>
                    {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: row.credit > 0 ? '#dc2626' : '#ccc' }}>
                    {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{Math.abs(row.balance).toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: '#999' }}>{row.balance >= 0 ? 'Dr' : 'Cr'}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <VoucherModal 
          onClose={() => setShowModal(false)} 
          onSaved={handleSaved} 
          voucherId={editingVoucherId || undefined}
          selectedLedger={selectedLedgerId}
        />
      )}
      
      {showLedgerModal && (
        <LedgerModal 
          onClose={() => setShowLedgerModal(false)} 
          onSaved={handleLedgerSaved}
          initialLedger={editingLedger}
        />
      )}
    </div>
  )
}

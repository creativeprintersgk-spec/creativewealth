import React, { useState, useCallback, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Plus, ArrowLeft, Printer } from "lucide-react"
import { getLedgerWithBalance, getStoredLedgers, getStoredGroups, getStoredAccounts } from "../logic"
import VoucherModal from "../VoucherModal"
import LedgerModal from "../LedgerModal"
import { useFY } from "../FYContext"
import { useFamily } from "../contexts/FamilyContext"
import { useTestMode } from "../contexts/TestModeContext"

export default function LedgerPage() {
  const { ledgerId: paramId } = useParams<{ ledgerId: string }>();
  const navigate = useNavigate();
  const { activeFamilyId } = useFamily();
  const { isTestMode, isTestEntry } = useTestMode();
  const [selectedLedgerId, setSelectedLedgerId] = useState(paramId || "Bank")
  const [showModal, setShowModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [editingLedger, setEditingLedger] = useState<any>(null)
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null)
  const [, setRefresh] = useState(0)

  const { selectedFY, reportFilter: globalFilter, customRange: globalRange, globalRefreshTrigger, selectedAccountId } = useFY()

  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);
  const ledgers = getStoredLedgers(selectedAccountId ? Number(selectedAccountId) : undefined);

  useEffect(() => {
    if (paramId) {
      setSelectedLedgerId(paramId);
    }
  }, [paramId]);

  useEffect(() => {
    const currentIsValid = ledgers.find(l => String(l.id) === String(selectedLedgerId) || l.name === selectedLedgerId);
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
    const ledger = ledgers.find(l => String(l.id) === String(selectedLedgerId) || l.name === selectedLedgerId);
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


  const [localReportFilter, setLocalReportFilter] = useState<string>(globalFilter || 'current')
  const [isDetailed, setIsDetailed] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const getDatesForFY = (fyStr: string) => {
    if (!fyStr) return { start: '', end: '' };
    const parts = fyStr.split("-");
    if (parts.length === 0) return { start: '', end: '' };
    const start = parts[0];
    return { start: `${start}-04-01`, end: `${parseInt(start) + 1}-03-31` };
  }
  const getLastFY = (fyStr: string) => {
    if (!fyStr) return '';
    const parts = fyStr.split("-");
    if (parts.length < 2) return '';
    const [start, end] = parts;
    return `${parseInt(start) - 1}-${parseInt(end) - 1}`;
  }
  const getPreviousFY = (fyStr: string) => {
    if (!fyStr) return '';
    const parts = fyStr.split("-");
    if (parts.length < 2) return '';
    const [start, end] = parts;
    return `${parseInt(start) - 2}-${parseInt(end) - 2}`;
  }

  // Update local filter when global filter changes
  useEffect(() => {
    setLocalReportFilter(globalFilter || 'current');
  }, [globalFilter]);

  const [localRange, setLocalRange] = useState<{ start: string; end: string }>(() => {
    if (globalFilter === 'current') return getDatesForFY(selectedFY);
    if (globalFilter === 'last') return getDatesForFY(getLastFY(selectedFY));
    if (globalFilter === 'previous') return getDatesForFY(getPreviousFY(selectedFY));
    return globalRange || { start: '', end: '' };
  });

  useEffect(() => {
    if (localReportFilter === 'current') {
      setLocalRange(getDatesForFY(selectedFY));
    } else if (localReportFilter === 'last') {
      setLocalRange(getDatesForFY(getLastFY(selectedFY)));
    } else if (localReportFilter === 'previous') {
      setLocalRange(getDatesForFY(getPreviousFY(selectedFY)));
    } else if (localReportFilter === 'custom') {
      setLocalRange(globalRange || { start: '', end: '' });
    }
  }, [localReportFilter, selectedFY, globalRange?.start, globalRange?.end]);

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    setLocalRange(prev => ({ ...prev, [type]: val }));
  };

  const drilldownData = getLedgerWithBalance(selectedLedgerId, localRange.start, localRange.end, selectedAccountId)
  const data = Array.isArray(drilldownData) ? [] : drilldownData.transactions;
  const selectedLedger = ledgers.find(l => String(l.id) === String(selectedLedgerId) || l.name === selectedLedgerId);
  const selectedLedgerName = selectedLedger?.name || selectedLedgerId;

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((row: any) => {
      return (
        (row.againstLedger && row.againstLedger.toLowerCase().includes(lower)) ||
        (row.narration && row.narration.toLowerCase().includes(lower)) ||
        (row.date && row.date.includes(lower)) ||
        (row.voucherType && row.voucherType.toLowerCase().includes(lower)) ||
        (row.debit > 0 && String(row.debit).includes(lower)) ||
        (row.credit > 0 && String(row.credit).includes(lower))
      );
    });
  }, [data, searchTerm]);

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
                  {ledgers.map(l => {
                    const accName = !selectedAccountId ? accounts.find(a => a.id === String(l.acid))?.accountName : '';
                    const displayName = accName ? `${l.name} (${accName})` : l.name;
                    return (
                      <option key={`${l.id}_${l.acid}`} value={l.id}>{displayName}</option>
                    );
                  })}
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
            {filteredData.reduce((sum: number, row: any) => sum + row.debit, 0).toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Credit</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#dc2626' }}>
            {filteredData.reduce((sum: number, row: any) => sum + row.credit, 0).toLocaleString()}
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

      {/* Controls: Date, Search, Toggle, Print */}
      <div className="print-hide" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        marginBottom: '1rem',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #eee',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Period selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginLeft: '6px' }}>Period:</span>
          <select
            value={localReportFilter}
            onChange={(e) => setLocalReportFilter(e.target.value)}
            style={{ padding: '4px 8px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
          >
            <option value="current">Current Year ({selectedFY})</option>
            <option value="last">Last Year ({getLastFY(selectedFY)})</option>
            <option value="previous">Previous Year ({getPreviousFY(selectedFY)})</option>
            <option value="custom">Custom Range</option>
          </select>

          {localReportFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '4px' }}>
              <input
                type="date"
                value={localRange.start}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>to</span>
              <input
                type="date"
                value={localRange.end}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
              />
            </div>
          )}
        </div>



        {/* Search box */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <input
            type="text"
            placeholder="Filter transactions (e.g. description, type, amount)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #eee',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>

        {/* Action buttons (Print, Details Toggle) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            onClick={() => setIsDetailed(!isDetailed)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: isDetailed ? 'hsl(213, 94%, 55%)' : '#e2e8f0',
              color: isDetailed ? 'white' : '#4b5563',
              background: isDetailed ? 'hsl(213, 94%, 55%)' : 'white',
            }}
          >
            {isDetailed ? 'Condensed View' : 'Detailed View'}
          </button>

          <button
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: '#666' }}>Date</th>
              <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: '#666' }}>Type</th>
              <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: '#666' }}>Against</th>
              <th style={{ padding: '6px 12px', textAlign: 'right', fontSize: '0.7rem', textTransform: 'uppercase', color: '#666' }}>Debit</th>
              <th style={{ padding: '6px 12px', textAlign: 'right', fontSize: '0.7rem', textTransform: 'uppercase', color: '#666' }}>Credit</th>
              <th style={{ padding: '6px 12px', textAlign: 'right', fontSize: '0.7rem', textTransform: 'uppercase', color: '#666' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>No transactions found for this ledger.</td>
              </tr>
            ) : (
              filteredData.map((row: any, idx: number) => {
                // Orange highlight: Test Mode — entry tagged with imp_rec_id='TEST' in Supabase
                const isTestRow = isTestEntry(row.impRecId);
                return (
                <tr key={idx} style={{
                  borderBottom: '1px solid #f5f5f5',
                  backgroundColor: isTestRow ? 'rgba(249,115,22,0.06)' : 'transparent',
                  borderLeft: isTestRow ? '3px solid #f97316' : '3px solid transparent',
                  color: isTestRow ? '#c2410c' : 'inherit',
                }} className="hover-row">
                  <td style={{ padding: '5px 12px', fontSize: '12px' }}>{row.date}</td>
                  <td style={{ padding: '5px 12px', textTransform: 'capitalize', fontSize: '12px' }}>{row.voucherType}</td>
                  <td style={{ padding: '5px 12px', color: isTestRow ? '#c2410c' : '#2563eb', cursor: 'pointer', fontSize: '12px' }} onClick={() => handleEdit(row.voucherId)}>
                    {row.againstLedger}
                    {isDetailed && row.narration && <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>{row.narration}</div>}
                    {isTestRow && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#f97316', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontWeight: 700, verticalAlign: 'middle' }}>TEST</span>}
                  </td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', color: row.debit > 0 ? '#059669' : '#ccc', fontSize: '12px' }}>
                    {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', color: row.credit > 0 ? '#dc2626' : '#ccc', fontSize: '12px' }}>
                    {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{Math.abs(row.balance).toLocaleString()}</div>
                    <div style={{ fontSize: '9px', color: '#999' }}>{row.balance >= 0 ? 'Dr' : 'Cr'}</div>
                  </td>
                </tr>
                );
              })
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

      <style>{`
        @media print {
          .sidebar, .print-hide, button {
            display: none !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .card {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin-bottom: 1rem !important;
          }
          table {
            width: 100% !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  )
}

import React, { useMemo, useState, useEffect } from 'react';
import { X, ExternalLink, Download, Plus, ArrowUpRight, ArrowDownLeft, Printer } from 'lucide-react';
import { getLedgerWithBalance, getStoredLedgers, getStoredGroups, getStoredVouchers, getStoredEntries } from './logic';
import { useFY } from './FYContext';

interface LedgerDrilldownModalProps {
  ledgerId: string;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  onClose: () => void;
  onVoucherClick: (voucherId: string) => void;
  onNewVoucher: () => void;
}

export default function LedgerDrilldownModal({ ledgerId, startDate, endDate, accountId, onClose, onVoucherClick, onNewVoucher }: LedgerDrilldownModalProps) {
  const { selectedFY, reportFilter: globalFilter, customRange: globalRange, globalRefreshTrigger } = useFY();
  const ledger = useMemo(() => getStoredLedgers().find(l => String(l.id) === String(ledgerId)), [ledgerId, getStoredLedgers()]);
  
  const [reportFilter, setReportFilter] = useState<string>(globalFilter || 'current');
  const [isDetailed, setIsDetailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const getDatesForFY = (fyStr: string) => {
     if (!fyStr) return { start: '', end: '' };
     const parts = fyStr.split("-");
     if (parts.length === 0) return { start: '', end: '' };
     const start = parts[0];
     return { start: `${start}-04-01`, end: `${parseInt(start) + 1}-03-31` };
  };
  const getLastFY = (fyStr: string) => {
     if (!fyStr) return '';
     const parts = fyStr.split("-");
     if (parts.length < 2) return '';
     const [start, end] = parts;
     return `${parseInt(start) - 1}-${parseInt(end) - 1}`;
  };
  const getPreviousFY = (fyStr: string) => {
     if (!fyStr) return '';
     const parts = fyStr.split("-");
     if (parts.length < 2) return '';
     const [start, end] = parts;
     return `${parseInt(start) - 2}-${parseInt(end) - 2}`;
  };

  const [localRange, setLocalRange] = useState({
    start: startDate || getDatesForFY(selectedFY).start,
    end: endDate || getDatesForFY(selectedFY).end
  });

  // Sync with props/selectedFY if they change
  useEffect(() => {
    setLocalRange({
      start: startDate || getDatesForFY(selectedFY).start,
      end: endDate || getDatesForFY(selectedFY).end
    });
  }, [startDate, endDate, selectedFY]);

  const handleFilterChange = (filterType: string) => {
    setReportFilter(filterType);
    if (filterType === 'current') {
      setLocalRange(getDatesForFY(selectedFY));
    } else if (filterType === 'last') {
      setLocalRange(getDatesForFY(getLastFY(selectedFY)));
    } else if (filterType === 'previous') {
      setLocalRange(getDatesForFY(getPreviousFY(selectedFY)));
    } else if (filterType === 'custom') {
      setLocalRange(globalRange || { start: '', end: '' });
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    setLocalRange(prev => ({ ...prev, [type]: val }));
  };

  const drilldownData = useMemo(() => 
    getLedgerWithBalance(ledgerId, localRange.start, localRange.end, accountId), 
    [ledgerId, localRange.start, localRange.end, accountId, globalRefreshTrigger]
  );

  const isArray = Array.isArray(drilldownData);
  const transactions = isArray ? [] : drilldownData.transactions;
  const groups = getStoredGroups();

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const lower = searchTerm.toLowerCase();
    return transactions.filter((t: any) => {
      return (
        (t.againstLedger && t.againstLedger.toLowerCase().includes(lower)) ||
        (t.narration && t.narration.toLowerCase().includes(lower)) ||
        (t.date && t.date.includes(lower)) ||
        (t.voucherType && t.voucherType.toLowerCase().includes(lower)) ||
        (t.debit > 0 && String(t.debit).includes(lower)) ||
        (t.credit > 0 && String(t.credit).includes(lower))
      );
    });
  }, [transactions, searchTerm]);

  const summary = useMemo(() => {
    if (!ledger || isArray) return { opening: 0, debit: 0, credit: 0, closing: 0 };
    
    let debit = 0;
    let credit = 0;
    filteredTransactions.forEach((t: any) => {
      debit += t.debit || 0;
      credit += t.credit || 0;
    });

    return {
      opening: drilldownData.openingBalance,
      debit,
      credit,
      closing: drilldownData.closingBalance
    };
  }, [ledger, filteredTransactions, drilldownData, isArray]);

  if (!ledger) return null;

  const formatCurrency = (val: number) => {
    return Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getDrCr = (val: number) => (val >= 0 ? 'Dr' : 'Cr');

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: '900px', maxWidth: '95vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              background: 'hsl(213, 94%, 95%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'hsl(213, 94%, 55%)'
            }}>
              <ExternalLink size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>{ledger.name}</h2>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {groups.find(g => g.id === ledger.groupId)?.name} | Period: {localRange.start} to {localRange.end}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <button 
               onClick={onNewVoucher}
               className="btn-primary print-hide" 
               style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
             >
              <Plus size={14} /> New Voucher
            </button>
             <button className="btn-secondary print-hide" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Export
            </button>
             <button 
               onClick={() => window.print()}
               className="btn-secondary print-hide" 
               style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
             >
              <Printer size={14} /> Print
            </button>
            <button className="modal-close print-hide" onClick={onClose} style={{ marginLeft: '8px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '16px',
          background: '#f9fafb', 
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Opening</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151', marginTop: '4px' }}>
              {formatCurrency(summary.opening)} <span style={{ fontSize: '12px', fontWeight: 500 }}>{getDrCr(summary.opening)}</span>
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Debit (+)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              {formatCurrency(summary.debit)}
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Credit (-)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
              {formatCurrency(summary.credit)}
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderBottom: '3px solid hsl(213, 94%, 55%)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Closing</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'hsl(213, 94%, 55%)', marginTop: '4px' }}>
              {formatCurrency(summary.closing)} <span style={{ fontSize: '12px', fontWeight: 500 }}>{getDrCr(summary.closing)}</span>
            </div>
          </div>
        </div>

        {/* Controls: Date, Search, Toggle */}
        <div className="print-hide" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 24px', 
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* Period selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginLeft: '6px' }}>Period:</span>
            <select 
              value={reportFilter} 
              onChange={(e) => handleFilterChange(e.target.value)}
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
            >
              <option value="current">Current Year ({selectedFY})</option>
              <option value="last">Last Year ({getLastFY(selectedFY)})</option>
              <option value="previous">Previous Year ({getPreviousFY(selectedFY)})</option>
              <option value="custom">Custom Range</option>
            </select>
            
            {reportFilter === 'custom' && (
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
                border: '1px solid #e2e8f0', 
                borderRadius: '6px',
                outline: 'none',
              }}
            />
          </div>

          {/* Toggle Details */}
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
        </div>

        {/* Transaction Table */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, boxShadow: '0 1px 0 #f0f0f0' }}>
              <tr>
                <th style={{ padding: '6px 16px', textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Voucher Type</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Account Name</th>
                {isDetailed && <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Narration</th>}
                <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Debit</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Credit</th>
                <th style={{ padding: '6px 16px', textAlign: 'right', fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr style={{ background: '#fcfcfc', borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 16px' }}></td>
                <td style={{ padding: '6px 8px' }}></td>
                <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#374151' }}>Opening Balance:</td>
                {isDetailed && <td style={{ padding: '6px 8px' }}></td>}
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                   {summary.opening > 0 ? formatCurrency(summary.opening) : '0.00'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                   {summary.opening < 0 ? formatCurrency(summary.opening) : '0.00'}
                </td>
                <td style={{ padding: '6px 16px' }}></td>
              </tr>

              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={isDetailed ? 7 : 6} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                    No transactions found in this period. 
                    {Math.abs(summary.opening) > 0 && (
                      <div style={{ marginTop: '8px', color: '#6b7280' }}>
                        (Note: The balance of Rs. {formatCurrency(Math.abs(summary.opening))} is from previous periods and is shown in the Opening Balance above.)
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t: any, i: number) => {
                  const isImported = t.narration && (t.narration.toLowerCase().includes("mutual fund cas") || t.narration.toLowerCase().includes("contract note"));
                  return (
                  <tr 
                    key={i} 
                    className="hover-row" 
                    style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer', backgroundColor: isImported ? '#e0f2fe' : 'transparent' }}
                    onClick={() => onVoucherClick(t.voucherId)}
                  >
                    <td style={{ padding: '5px 16px', fontSize: '12px', color: '#374151' }}>{t.date}</td>
                    <td style={{ padding: '5px 8px', fontSize: '12px' }}>
                      <span style={{ 
                        padding: '1px 6px', 
                        borderRadius: '3px', 
                        background: t.voucherType === 'receipt' ? '#ecfdf5' : t.voucherType === 'payment' ? '#fef2f2' : '#eff6ff',
                        color: t.voucherType === 'receipt' ? '#059669' : t.voucherType === 'payment' ? '#dc2626' : '#2563eb',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {t.voucherType}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', fontSize: '12px', color: '#1f2937', fontWeight: 500 }}>{t.againstLedger}</td>
                    {isDetailed && (
                      <td style={{ padding: '5px 8px', fontSize: '12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.narration}
                      </td>
                    )}
                    <td style={{ padding: '5px 8px', fontSize: '12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                      {t.debit > 0 ? formatCurrency(t.debit) : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', fontSize: '12px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                      {t.credit > 0 ? formatCurrency(t.credit) : '—'}
                    </td>
                    <td style={{ padding: '5px 16px', fontSize: '12px', textAlign: 'right', color: '#374151', fontWeight: 600 }}>
                      {formatCurrency(t.balance)} <span style={{ fontSize: '9px', fontWeight: 500, color: '#6b7280' }}>{getDrCr(t.balance)}</span>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '2px solid #e5e7eb' }}>
              <tr style={{ background: '#f9fafb' }}>
                <td colSpan={isDetailed ? 4 : 3} style={{ padding: '5px 16px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textAlign: 'right' }}>Totals for the period:</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#059669' }}>{formatCurrency(summary.debit)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(summary.credit)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={isDetailed ? 4 : 3} style={{ padding: '5px 16px', fontSize: '11px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>Closing Balance:</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: 'hsl(213, 94%, 55%)' }}>
                  {summary.closing > 0 ? formatCurrency(summary.closing) : '0.00'}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: 'hsl(213, 94%, 55%)' }}>
                  {summary.closing < 0 ? formatCurrency(summary.closing) : '0.00'}
                </td>
                <td style={{ padding: '5px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: 'hsl(213, 94%, 55%)' }}>
                  {formatCurrency(summary.closing)} <span style={{ fontSize: '9px', fontWeight: 500 }}>{getDrCr(summary.closing)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .modal-overlay, .modal-overlay * {
            visibility: visible;
          }
          .modal-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .modal-box {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-hide {
            display: none !important;
          }
          /* Ensure table is expanded and does not cut off or scroll */
          div {
            overflow: visible !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}

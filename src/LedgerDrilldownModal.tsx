import React, { useMemo } from 'react';
import { X, ExternalLink, Download, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
  const { selectedFY } = useFY();
  const ledger = useMemo(() => getStoredLedgers().find(l => l.id === ledgerId), [ledgerId, getStoredLedgers()]);
  
  const drilldownData = useMemo(() => 
    getLedgerWithBalance(ledgerId, startDate, endDate, accountId), 
    [ledgerId, startDate, endDate, accountId, getStoredVouchers(), getStoredEntries()]
  );

  const isArray = Array.isArray(drilldownData);
  const transactions = isArray ? [] : drilldownData.transactions;
  const groups = getStoredGroups();

  const summary = useMemo(() => {
    if (!ledger || isArray) return { opening: 0, debit: 0, credit: 0, closing: 0 };
    
    let debit = 0;
    let credit = 0;
    transactions.forEach((t: any) => {
      debit += t.debit || 0;
      credit += t.credit || 0;
    });

    return {
      opening: drilldownData.openingBalance,
      debit,
      credit,
      closing: drilldownData.closingBalance
    };
  }, [ledger, transactions, drilldownData, isArray]);

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
                {groups.find(g => g.id === ledger.groupId)?.name} | Period: {startDate} to {endDate}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <button 
               onClick={onNewVoucher}
               className="btn-primary" 
               style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
             >
              <Plus size={14} /> New Voucher
            </button>
             <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Export
            </button>
            <button className="modal-close" onClick={onClose} style={{ marginLeft: '8px' }}>
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
              ₹ {formatCurrency(summary.opening)} <span style={{ fontSize: '12px', fontWeight: 500 }}>{getDrCr(summary.opening)}</span>
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Debit (+)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              ₹ {formatCurrency(summary.debit)}
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Credit (-)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
              ₹ {formatCurrency(summary.credit)}
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderBottom: '3px solid hsl(213, 94%, 55%)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Closing</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'hsl(213, 94%, 55%)', marginTop: '4px' }}>
              ₹ {formatCurrency(summary.closing)} <span style={{ fontSize: '12px', fontWeight: 500 }}>{getDrCr(summary.closing)}</span>
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, boxShadow: '0 1px 0 #f0f0f0' }}>
              <tr>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Voucher Type</th>
                <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Account Name</th>
                <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Narration</th>
                <th style={{ padding: '12px 12px', textAlign: 'right', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Debit</th>
                <th style={{ padding: '12px 12px', textAlign: 'right', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Credit</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr style={{ background: '#fcfcfc', borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 24px' }}></td>
                <td style={{ padding: '12px 12px' }}></td>
                <td style={{ padding: '12px 12px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Opening Balance:</td>
                <td style={{ padding: '12px 12px' }}></td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                   {summary.opening > 0 ? formatCurrency(summary.opening) : '0.00'}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                   {summary.opening < 0 ? formatCurrency(summary.opening) : '0.00'}
                </td>
                <td style={{ padding: '12px 24px' }}></td>
              </tr>

              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                    No transactions found in this period.
                  </td>
                </tr>
              ) : (
                transactions.map((t: any, i: number) => (
                  <tr 
                    key={i} 
                    className="hover-row" 
                    style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}
                    onClick={() => onVoucherClick(t.voucherId)}
                  >
                    <td style={{ padding: '12px 24px', fontSize: '13px', color: '#374151' }}>{t.date}</td>
                    <td style={{ padding: '12px 12px', fontSize: '13px' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        background: t.voucherType === 'receipt' ? '#ecfdf5' : t.voucherType === 'payment' ? '#fef2f2' : '#eff6ff',
                        color: t.voucherType === 'receipt' ? '#059669' : t.voucherType === 'payment' ? '#dc2626' : '#2563eb',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {t.voucherType}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '13px', color: '#1f2937', fontWeight: 500 }}>{t.againstLedger}</td>
                    <td style={{ padding: '12px 12px', fontSize: '13px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.narration}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '13px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                      {t.debit > 0 ? formatCurrency(t.debit) : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '13px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                      {t.credit > 0 ? formatCurrency(t.credit) : '—'}
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '13px', textAlign: 'right', color: '#374151', fontWeight: 600 }}>
                      {formatCurrency(t.balance)} <span style={{ fontSize: '10px', fontWeight: 500, color: '#6b7280' }}>{getDrCr(t.balance)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '2px solid #e5e7eb' }}>
              <tr style={{ background: '#f9fafb' }}>
                <td colSpan={4} style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 700, color: '#6b7280', textAlign: 'right' }}>Totals for the period:</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#059669' }}>{formatCurrency(summary.debit)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(summary.credit)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>Closing Balance:</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '14px', fontWeight: 800, color: 'hsl(213, 94%, 55%)' }}>
                  {summary.closing > 0 ? formatCurrency(summary.closing) : '0.00'}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '14px', fontWeight: 800, color: 'hsl(213, 94%, 55%)' }}>
                  {summary.closing < 0 ? formatCurrency(summary.closing) : '0.00'}
                </td>
                <td style={{ padding: '12px 24px', textAlign: 'right', fontSize: '14px', fontWeight: 800, color: 'hsl(213, 94%, 55%)' }}>
                  {formatCurrency(summary.closing)} <span style={{ fontSize: '10px', fontWeight: 500 }}>{getDrCr(summary.closing)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

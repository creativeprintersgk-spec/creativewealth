import React, { useState } from 'react';
import { X, Calendar, User, Copy, Check, AlertTriangle, Info } from 'lucide-react';
import { getStoredAccounts, getYearEndClosingLines } from '../logic';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';

interface YearEndCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFY: string;
}

export default function YearEndCloseModal({ isOpen, onClose, selectedFY }: YearEndCloseModalProps) {
  const { activeFamilyId } = useFamily();
  const { selectedAccountId } = useFY();
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use selected account from global state or fallback to first family member
  const activeAccountId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : '');
  const currentAccount = accounts.find(a => a.id === activeAccountId);
  const accountName = currentAccount ? currentAccount.name : 'Unknown';

  // Get lines using our logic function
  const { lines, capitalLedger, netProfit, error } = activeAccountId 
    ? getYearEndClosingLines(selectedFY, activeAccountId)
    : { lines: [], capitalLedger: null, netProfit: 0, error: null };

  const endYearStr = selectedFY.split("-")[1];
  const endYear = endYearStr.length === 2 ? `20${endYearStr}` : endYearStr;
  const voucherDate = `${endYear}-03-31`;

  // Calculate totals
  const totalDebits = lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
  const totalCredits = lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);

  const handleCopy = async () => {
    const dataToCopy = {
      date: voucherDate,
      type: "journal",
      narration: `Year End Closing Entry — FY ${selectedFY}`,
      accountId: activeAccountId,
      accountName,
      netProfitOrLoss: netProfit,
      capitalLedger: capitalLedger ? { id: capitalLedger.id, name: capitalLedger.name } : null,
      lines: lines.map((l: any) => ({
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        debit: l.debit,
        credit: l.credit,
        isCapitalOffset: !!l.isCapitalOffset
      }))
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="#6366f1" />
              Year End Closing Voucher Preview
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Closing Entry for Financial Year <strong style={{ color: '#4f46e5' }}>{selectedFY}</strong>
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              padding: '6px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          
          {/* Top selection & meta block */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Member Account
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f1f5f9',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1e293b'
              }}>
                <User size={16} color="#4f46e5" />
                <span style={{ textTransform: 'uppercase' }}>{accountName}</span>
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Voucher Date</span>
              <div style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                {voucherDate}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Voucher Type</span>
              <div style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', fontSize: '13px', fontWeight: 500, color: '#334155', textTransform: 'uppercase' }}>
                journal
              </div>
            </div>
          </div>

          {/* Alert: Simulation mode notice */}
          <div style={{
            display: 'flex',
            gap: '12px',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            padding: '16px',
            borderRadius: '12px',
            color: '#b45309',
            alignItems: 'flex-start'
          }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>Simulation Mode — No Changes Posted</h4>
              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.9 }}>
                As requested, posting to the database is disabled. This modal displays the exact adjusting journal entry that would close all Income & Expense accounts for <strong>{accountName.toUpperCase()}</strong> and transfer the net profit/loss to the Capital Account.
              </p>
            </div>
          </div>

          {error ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2', color: '#b91c1c' }}>
              <Info size={32} style={{ margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{error}</p>
            </div>
          ) : lines.length === 0 ? (
            <div style={{ padding: '36px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', color: '#64748b' }}>
              <Info size={32} style={{ margin: '0 auto 12px auto', color: '#94a3b8' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: '#475569' }}>No Income or Expense Balances Found</p>
              <p style={{ fontSize: '12px', margin: 0, color: '#94a3b8' }}>
                All revenue and expense ledgers are already closed or have exactly zero balance for FY {selectedFY}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${netProfit >= 0 ? '#d1fae5' : '#fee2e2'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: netProfit >= 0 ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                      Net Financial Result
                    </span>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 800, color: netProfit >= 0 ? '#065f46' : '#991b1b' }}>
                      {netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: netProfit >= 0 ? '#065f46' : '#991b1b', fontVariantNumeric: 'tabular-nums' }}>
                      Rs. {Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                    <span>Capital Account to Offset:</span>
                    <strong style={{ color: '#0f172a' }}>{capitalLedger?.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                    <span>Offset Action:</span>
                    <strong style={{ color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
                      {netProfit >= 0 ? 'CREDIT (Increase Capital)' : 'DEBIT (Decrease Capital)'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Lines Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1fr 1fr 1fr',
                  background: '#f8fafc',
                  padding: '12px 16px',
                  fontWeight: 700,
                  fontSize: '12px',
                  color: '#475569',
                  borderBottom: '1px solid #e2e8f0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <span>Ledger Name</span>
                  <span style={{ textAlign: 'center' }}>Account Type</span>
                  <span style={{ textAlign: 'right' }}>Debit (Dr)</span>
                  <span style={{ textAlign: 'right' }}>Credit (Cr)</span>
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {lines.map((l: any, i: number) => {
                    const isCapital = !!l.isCapitalOffset;
                    return (
                      <div 
                        key={i} 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2.5fr 1fr 1fr 1fr',
                          padding: '12px 16px',
                          fontSize: '13px',
                          borderBottom: i === lines.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: isCapital ? '#f5f3ff' : 'transparent',
                          fontWeight: isCapital ? 600 : 400,
                          color: isCapital ? '#6d28d9' : '#1e293b'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.ledgerName}
                        </span>
                        <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: l.groupType === 'INCOME' ? '#059669' : l.groupType === 'EXPENSE' ? '#d97706' : '#6d28d9' }}>
                          {l.groupType}
                        </span>
                        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: l.debit > 0 ? '#1e293b' : '#cbd5e1' }}>
                          {l.debit > 0 ? l.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </span>
                        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: l.credit > 0 ? '#1e293b' : '#cbd5e1' }}>
                          {l.credit > 0 ? l.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Balanced Totals Summary */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1fr 1fr 1fr',
                  background: '#f8fafc',
                  padding: '14px 16px',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#0f172a',
                  borderTop: '2px solid #e2e8f0'
                }}>
                  <span>Voucher Totals (Balanced)</span>
                  <span />
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Narration Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Voucher Narration</span>
            <div style={{
              padding: '10px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#f8fafc',
              fontSize: '13px',
              color: '#334155',
              fontStyle: 'italic'
            }}>
              Year End Closing Entry — FY {selectedFY}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <button
            onClick={handleCopy}
            disabled={lines.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: lines.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: lines.length === 0 ? 0.5 : 1
            }}
            onMouseEnter={e => { if (lines.length > 0) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { if (lines.length > 0) e.currentTarget.style.background = 'white'; }}
          >
            {copied ? (
              <>
                <Check size={16} color="#059669" />
                <span style={{ color: '#059669' }}>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Draft JSON</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="btn-primary"
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

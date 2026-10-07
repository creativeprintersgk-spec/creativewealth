import React, { useMemo, useState, useEffect } from 'react';
import { X, ArrowRightLeft, ChevronDown, Calendar, Edit3, Plus } from 'lucide-react';
import { getAssetTransactions, getStoredLedgers, getStoredGroups, formatDateDDMMMYYYY } from '../../logic';
import PMSIncomeModal from './PMSIncomeModal';
import PMSCorporateActionModal from './PMSCorporateActionModal';
import PMSFDInvestmentModal from './PMSFDInvestmentModal';
import PMSPPFModal from './PMSPPFModal';
import PMSNCDBondModal from './PMSNCDBondModal';
import PMSGoldSilverModal from './PMSGoldSilverModal';
import PMSULIPModal from './PMSULIPModal';
import { useFY } from '../../FYContext';

interface Props {
  open: boolean;
  assetId: string;
  assetName: string;
  portfolioIds: string[];
  /** Asset type number (atty) — used to pick the right entry modal */
  atty?: number;
  onClose: () => void;
  onEditTransaction?: (
    voucherId: string,
    initialAssetId?: string,
    initialAssetName?: string,
    initialPortfolioId?: string
  ) => void;
}

export default function AssetLedgerModal({
  open,
  assetId,
  assetName,
  portfolioIds,
  atty,
  onClose,
  onEditTransaction,
}: Props) {
  // ⚠️ ALL hooks must come before any early return (React rules)
  const { triggerGlobalRefresh, globalRefreshTrigger } = useFY();

  // Determine asset category from atty and assetName
  const isFD = atty === 90 || atty === 30;
  const isPPF = atty === 130 || (assetName || '').toLowerCase().includes('ppf');
  const isNCD = atty === 110 || atty === 70 || (assetName || '').toLowerCase().includes('rbi') || (assetName || '').toLowerCase().includes('ncd');
  const isBond = atty === 100 || atty === 40;
  const isGold = atty === 150 || atty === 75;
  const isSilver = atty === 151 || atty === 77;
  const isMetalAsset = isGold || isSilver;
  const isULIP = atty === 95 || (assetName || '').toLowerCase().includes('ulip') || (assetName || '').toLowerCase().includes('policy');
  const isSpecialEntry = isFD || isPPF || isNCD || isBond || isMetalAsset || isULIP;
  const isNonUnitized = isPPF || isFD || isNCD || isULIP || Number(assetId) >= 500000;

  const defaultStart = isNonUnitized ? '1990-04-01' : '2026-04-01';
  const defaultPreset = isNonUnitized ? 'Till Current Financial Year (all)' : 'Current Financial Year';

  // Local date range state (Defaults to all history for PPF/NCD/FD so deposits & interest are visible)
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState('2027-03-31');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodPreset, setPeriodPreset] = useState(defaultPreset);
  
  // Date range inputs for Period modal
  const [tempStart, setTempStart] = useState(defaultStart);
  const [tempEnd, setTempEnd] = useState('2027-03-31');

  useEffect(() => {
    if (open) {
      setStartDate(defaultStart);
      setEndDate('2027-03-31');
      setPeriodPreset(defaultPreset);
      setTempStart(defaultStart);
      setTempEnd('2027-03-31');
    }
  }, [assetId, open, isNonUnitized, defaultStart, defaultPreset]);

  // UI Selection State
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isOtherTxnOpen, setIsOtherTxnOpen] = useState(false);
  const [infoRow, setInfoRow] = useState<any | null>(null);

  // Modal open states
  const [incomeModalVoucherId, setIncomeModalVoucherId] = useState<string | null>(null);
  const [corporateAction, setCorporateAction] = useState<string | null>(null);

  // New asset-type specific modals
  const [fdModalVoucherId, setFdModalVoucherId] = useState<string | null>(null);
  const [ppfModalVoucherId, setPpfModalVoucherId] = useState<string | null>(null);
  const [ncdModalVoucherId, setNcdModalVoucherId] = useState<{ voucherId: string | null; category: 'ncd' | 'bonds' } | null>(null);
  const [goldSilverModal, setGoldSilverModal] = useState<{ voucherId: string | null; metal: 'gold' | 'silver'; mode: 'addition' | 'sale' } | null>(null);
  const [ulipModalVoucherId, setUlipModalVoucherId] = useState<string | null>(null);

  // Handler: open the correct "new" entry modal for this asset type
  const handleNewEntry = (mode: 'addition' | 'sale' = 'addition') => {
    if (isFD) { setFdModalVoucherId('__new__'); return; }
    if (isPPF) { setPpfModalVoucherId('__new__'); return; }
    if (isNCD) { setNcdModalVoucherId({ voucherId: '__new__', category: 'ncd' }); return; }
    if (isBond) { setNcdModalVoucherId({ voucherId: '__new__', category: 'bonds' }); return; }
    if (isGold) { setGoldSilverModal({ voucherId: null, metal: 'gold', mode }); return; }
    if (isSilver) { setGoldSilverModal({ voucherId: null, metal: 'silver', mode }); return; }
    if (isULIP) { setUlipModalVoucherId('__new__'); return; }
    // Fallback: standard equity/MF transaction modal
    onEditTransaction?.('new', assetId, assetName, portfolioIds[0]);
  };

  // Handler: open correct edit modal for a clicked transaction
  const handleEditEntry = (vId: string) => {
    if (isFD) { setFdModalVoucherId(vId); return; }
    if (isPPF) { setPpfModalVoucherId(vId); return; }
    if (isNCD) { setNcdModalVoucherId({ voucherId: vId, category: 'ncd' }); return; }
    if (isBond) { setNcdModalVoucherId({ voucherId: vId, category: 'bonds' }); return; }
    if (isGold) { setGoldSilverModal({ voucherId: vId, metal: 'gold', mode: 'addition' }); return; }
    if (isSilver) { setGoldSilverModal({ voucherId: vId, metal: 'silver', mode: 'addition' }); return; }
    if (isULIP) { setUlipModalVoucherId(vId); return; }
    onEditTransaction?.(vId, assetId, assetName, portfolioIds[0]);
  };

  // Corporate action trty values — these have no accounting voucher, treat as read-only
  const CORPORATE_TRTY = new Set([45, 85, 40, 41, 42, 43, 47, 48, 49, 38, 39, 36, 37, 50, 51, 52]);

  // Fetch transactions and balances — re-runs whenever globalRefreshTrigger changes (after any save)
  const ledgerData = useMemo(() => {
    if (!open) return { openingQty: 0, openingCost: 0, closingQty: 0, closingCost: 0, transactions: [] };
    return getAssetTransactions(portfolioIds.map(Number), Number(assetId), startDate, endDate);
  }, [portfolioIds, assetId, open, startDate, endDate, globalRefreshTrigger]);

  const { openingQty, openingCost, closingQty, closingCost, transactions } = ledgerData;

  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset);
    const today = new Date();
    const currYear = today.getFullYear();
    
    switch (preset) {
      case 'Current Financial Year':
        // 2026-04-01 to 2027-03-31
        setTempStart('2026-04-01');
        setTempEnd('2027-03-31');
        break;
      case 'Last Financial Year':
        // 2025-04-01 to 2026-03-31
        setTempStart('2025-04-01');
        setTempEnd('2026-03-31');
        break;
      case 'Previous to Last Financial Year':
        // 2024-04-01 to 2025-03-31
        setTempStart('2024-04-01');
        setTempEnd('2025-03-31');
        break;
      case 'Till Current Financial Year (all)':
        setTempStart('1990-04-01');
        setTempEnd('2027-03-31');
        break;
    }
  };

  const handleApplyPeriod = () => {
    setStartDate(tempStart);
    setEndDate(tempEnd);
    setShowPeriodModal(false);
  };

  const formatDate = (dStr: string) => {
    return formatDateDDMMMYYYY(dStr);
  };

  const fmtQty = (q: number) => {
    if (q === 0) return '';
    return q.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const fmtAmt = (a: number) => {
    if (a === 0) return '';
    return a.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!open) return null;

  return (
    <>
      {/* ── MAIN MODAL OVERLAY ── */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60
      }}>
      <div style={{
        width: '1000px',
        maxWidth: '95vw',
        height: '85vh',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: '#3b82f6', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white'
            }}>
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{assetName}</h3>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Transaction Ledger • {assetId}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '8px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ACTION BAR */}
        <div style={{ padding: '8px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px', fontSize: '13px', fontWeight: 600, background: '#fff', alignItems: 'center' }}>
          {/* Primary action button — label changes by asset type */}
          <button 
            onClick={() => handleNewEntry('addition')} 
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} />
            {isULIP ? 'Add Renewal Premium' : isMetalAsset ? 'Add Purchase' : isFD ? 'New Investment' : isPPF ? 'New Contribution' : (isNCD || isBond) ? 'New Buy' : 'Buy Sell'}
          </button>

          {/* Gold/Silver Sale button — only shown for metal assets */}
          {isMetalAsset && (
            <button
              onClick={() => handleNewEntry('sale')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Add Sale
            </button>
          )}

          <button 
            onClick={() => {
              if (selectedTxId) {
                const tx = transactions.find(t => t.id === Number(selectedTxId));
                if (tx && (tx.trty === 62 || tx.type.toLowerCase().includes('dividend'))) {
                  setIncomeModalVoucherId(tx.voucherId);
                } else if (tx && CORPORATE_TRTY.has(tx.trty)) {
                  // Corporate actions (splits, bonus, merger) — read-only info
                  setInfoRow(tx);
                } else if (tx) {
                  handleEditEntry(tx.voucherId);
                }
              } else {
                alert("Please select a transaction row below to edit.");
              }
            }} 
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Edit3 size={14} /> Edit / View
          </button>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsOtherTxnOpen(!isOtherTxnOpen)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Other Transactions <ChevronDown size={14} />
            </button>
            {isOtherTxnOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', minWidth: '240px', zIndex: 100, padding: '4px', textAlign: 'left' }}>
                <button className="dropdown-item" onClick={() => { setCorporateAction('bonus'); setIsOtherTxnOpen(false); }}>Add Bonus Received</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('split'); setIsOtherTxnOpen(false); }}>Add Stock-Split Details</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('demerger'); setIsOtherTxnOpen(false); }}>Add Stock-D'Merger Details</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('merger'); setIsOtherTxnOpen(false); }}>Add Merger Details</button>
                <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                <button className="dropdown-item" onClick={() => { setCorporateAction('ipo'); setIsOtherTxnOpen(false); }}>IPO, Installation Payment, Op Bal.</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('buyback'); setIsOtherTxnOpen(false); }}>Buyback</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('reinvest'); setIsOtherTxnOpen(false); }}>Dividend Reinvest</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('repayment'); setIsOtherTxnOpen(false); }}>Repayment of Debt</button>
                <button className="dropdown-item" onClick={() => { setIncomeModalVoucherId('new'); setIsOtherTxnOpen(false); }}>Add Income for the Asset</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('writeoff'); setIsOtherTxnOpen(false); }}>Write Off</button>
                <button className="dropdown-item" onClick={() => { setCorporateAction('transfer'); setIsOtherTxnOpen(false); }}>Transfer this Asset to another Portfolio</button>
              </div>
            )}
          </div>
        </div>

        {/* PERIOD SELECTOR HEADER (YELLOW MPROFIT STYLE) */}
        <div style={{
          padding: '10px 24px',
          background: '#fef9c3', // Light yellow background
          borderBottom: '1px solid #fef08a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          fontWeight: 700,
          color: '#854d0e' // dark yellow text
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} />
            <span>Period — {formatDate(startDate)} to {formatDate(endDate)}</span>
          </div>
          <button 
            onClick={() => {
              setTempStart(startDate);
              setTempEnd(endDate);
              setShowPeriodModal(true);
            }}
            style={{
              padding: '4px 12px',
              background: '#ffffff',
              border: '1px solid #fde047',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#854d0e',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fefcbf'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            Change Period
          </button>
        </div>

        {/* TABLE CONTENT */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: '750px', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
              <tr>
                {[
                  { label: "Type", width: '12%', align: 'left' },
                  { label: "Date", width: '12%', align: 'left' },
                  { label: "Quantity", width: '15%', align: 'right' },
                  { label: "Price", width: '15%', align: 'right' },
                  { label: "Brokerage (Rs.)", width: '14%', align: 'right' },
                  { label: "Amount", width: '16%', align: 'right' },
                  { label: isSpecialEntry ? "Balance (₹)" : "Bal. Quant", width: '16%', align: 'right' }
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      padding: '12px 16px',
                      width: col.width,
                      textAlign: col.align as any,
                      fontWeight: 700,
                      color: '#64748b',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* 1. Opening Balance Row */}
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>
                <td style={{ padding: '12px 16px', width: '12%', color: '#0284c7' }}>Opening Bal.</td>
                <td style={{ padding: '12px 16px', width: '12%' }}></td>
                <td style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>{fmtQty(openingQty)}</td>
                <td style={{ padding: '12px 16px', width: '15%' }}></td>
                <td style={{ padding: '12px 16px', width: '14%' }}></td>
                <td style={{ padding: '12px 16px', width: '16%', textAlign: 'right' }}>{openingCost > 0 ? `${fmtAmt(openingCost)}` : ''}</td>
                <td style={{ padding: '12px 16px', width: '16%', textAlign: 'right', fontWeight: 800 }}>{openingQty > 0 ? fmtQty(openingQty) : (openingCost > 0 ? fmtAmt(openingCost) : '')}</td>
              </tr>

              {/* 2. Transaction Rows */}
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                    No transactions found within this period.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isSelected = selectedTxId === String(tx.id);
                  const isDividend = tx.trty === 62 || tx.type.toLowerCase().includes('dividend');
                  const isCorporate = CORPORATE_TRTY.has(tx.trty);
                  // For display: splits are neutral grey; only regular buy/sell get red/green
                  const isBuyColor = !isCorporate && [19, 20, 12, 25, 30, 46].includes(tx.trty);
                  const bgColor = isSelected ? '#eff6ff' : isDividend ? '#fef3c7' : isCorporate ? '#f0fdf4' : isBuyColor ? '#fee2e2' : '#dcfce7';
                  const textColor = isDividend ? '#92400e' : isCorporate ? '#166534' : isBuyColor ? '#991b1b' : '#166534';
                  const isImported = tx.narration && (tx.narration.toLowerCase().includes("mutual fund cas") || tx.narration.toLowerCase().includes("contract note"));
                  const rowBgColor = isSelected ? '#dbeafe' : isCorporate ? '#f0fdf4' : (isImported ? '#e0f2fe' : 'transparent');

                  const handleRowOpen = () => {
                    if (isDividend) {
                      setIncomeModalVoucherId(tx.voucherId);
                    } else if (isCorporate) {
                      setInfoRow(tx);
                    } else {
                      handleEditEntry(tx.voucherId);
                    }
                  };

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTxId(String(tx.id))}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer',
                        background: rowBgColor
                      }}
                      className="ledger-row"
                      onDoubleClick={handleRowOpen}
                    >
                      <td style={{ padding: '12px 16px', width: '12%' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 800, 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          background: bgColor,
                          color: textColor
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', width: '12%', fontWeight: 600, color: '#0f172a' }}>{formatDate(tx.date)}</td>
                      <td style={{ padding: '12px 16px', width: '15%', textAlign: 'right', fontWeight: 600 }}>{fmtQty(tx.quantity)}</td>
                      <td style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>{tx.price > 0 ? `${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}</td>
                      <td style={{ padding: '12px 16px', width: '14%', textAlign: 'right', color: '#94a3b8' }}>{tx.brokerage > 0 ? `${tx.brokerage.toLocaleString()}` : ''}</td>
                      <td style={{ padding: '12px 16px', width: '16%', textAlign: 'right', fontWeight: 600, color: isCorporate ? '#6b7280' : isBuyColor ? '#0f172a' : '#16a34a' }}>
                        {tx.amount > 0 ? `${fmtAmt(tx.amount)}` : (isCorporate ? <span style={{color:'#94a3b8',fontSize:'11px'}}>Cost basis transfer</span> : '')}
                      </td>
                      <td style={{ padding: '12px 16px', width: '16%', textAlign: 'right', fontWeight: 800, background: '#f8fafc' }}>
                        {tx.balanceQty > 0 ? fmtQty(tx.balanceQty) : (tx.balanceCost !== undefined ? fmtAmt(tx.balanceCost) : '')}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* 3. Closing Balance Row */}
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                <td style={{ padding: '12px 16px', width: '12%', color: '#059669' }}>Closing Bal.</td>
                <td style={{ padding: '12px 16px', width: '12%' }}></td>
                <td style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>{fmtQty(closingQty)}</td>
                <td style={{ padding: '12px 16px', width: '15%' }}></td>
                <td style={{ padding: '12px 16px', width: '14%' }}></td>
                <td style={{ padding: '12px 16px', width: '16%', textAlign: 'right' }}>{closingCost > 0 ? `${fmtAmt(closingCost)}` : ''}</td>
                <td style={{ padding: '12px 16px', width: '16%', textAlign: 'right', fontWeight: 800 }}>{closingQty > 0 ? fmtQty(closingQty) : (closingCost > 0 ? fmtAmt(closingCost) : '')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          background: '#f8fafc'
        }}>
          <div style={{ color: '#64748b' }}>
            Showing {transactions.length} transactions in selected period
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#64748b' }}>{isSpecialEntry || closingQty === 0 ? 'Closing Value:' : 'Closing Qty:'}</span>
              <span style={{ fontWeight: 800 }}>{closingQty > 0 ? fmtQty(closingQty) : `₹${closingCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHANGE PERIOD DIALOG */}
      {showPeriodModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '380px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Change Period</h3>
              <button onClick={() => setShowPeriodModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Period Preset</label>
                <select 
                  value={periodPreset} 
                  onChange={e => handlePresetChange(e.target.value)} 
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                >
                  <option value="Current Financial Year">Current Financial Year</option>
                  <option value="Last Financial Year">Last Financial Year</option>
                  <option value="Previous to Last Financial Year">Previous to Last Financial Year</option>
                  <option value="Till Current Financial Year (all)">Till Current Financial Year (all)</option>
                  <option value="User Defined">User Defined</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>From</label>
                  <input type="date" value={tempStart} onChange={e => { setTempStart(e.target.value); setPeriodPreset('User Defined'); }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>To</label>
                  <input type="date" value={tempEnd} onChange={e => { setTempEnd(e.target.value); setPeriodPreset('User Defined'); }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowPeriodModal(false)} style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', background: '#fff' }}>Cancel</button>
              <button onClick={handleApplyPeriod} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* INCOME/DIVIDEND MODAL */}
      {incomeModalVoucherId && (
        <PMSIncomeModal
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          voucherId={incomeModalVoucherId === 'new' ? undefined : incomeModalVoucherId}
          onClose={() => setIncomeModalVoucherId(null)}
          onSaved={async () => {
            setIncomeModalVoucherId(null);
            await triggerGlobalRefresh();
          }}
        />
      )}

      {/* CORPORATE ACTION MODAL */}
      {corporateAction && (
        <PMSCorporateActionModal
          actionType={corporateAction}
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          onClose={() => setCorporateAction(null)}
          onSaved={async () => {
            setCorporateAction(null);
            await triggerGlobalRefresh();
          }}
        />
      )}

      {/* READ-ONLY INFO POPUP for Split/Bonus/Corporate Actions */}
      {infoRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '440px', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ background: '#059669', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '15px' }}>{infoRow.type}</div>
                <div style={{ color: '#a7f3d0', fontSize: '12px', marginTop: '2px' }}>Corporate Action — Read Only</div>
              </div>
              <button onClick={() => setInfoRow(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Date', formatDate(infoRow.date)],
                    ['Type', infoRow.type],
                    ['Quantity', fmtQty(infoRow.quantity)],
                    ['Amount / Cost Basis', infoRow.amount > 0 ? `Rs. ${fmtAmt(infoRow.amount)}` : '—'],
                    ['Balance After', fmtQty(infoRow.balanceQty) + ' shares'],
                    ['Portfolio', infoRow.portfolioName],
                    ['Transaction ID', String(infoRow.id)],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b', fontWeight: 600, width: '45%' }}>{label}</td>
                      <td style={{ padding: '10px 0', fontWeight: 700, color: '#0f172a' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '16px', background: '#fef3c7', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#92400e' }}>
                ℹ️ Corporate actions (splits, bonus, mergers) are imported from MProfit and cannot be edited directly. To modify, delete this record from MProfit data and re-import.
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setInfoRow(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .ledger-row:hover { background-color: #f1f5f9 !important; }
        .dropdown-item { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #475569; border-radius: 6px; cursor: pointer; transition: background 0.1s; }
        .dropdown-item:hover { background: #f1f5f9; color: #0f172a; }
      `}</style>
    </div>

      {/* ── ASSET-TYPE SPECIFIC MODALS ── */}

      {/* FD Investment Modal */}
      {fdModalVoucherId && (
        <PMSFDInvestmentModal
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          voucherId={fdModalVoucherId === '__new__' ? undefined : fdModalVoucherId}
          onClose={() => setFdModalVoucherId(null)}
          onSaved={async () => {
            setFdModalVoucherId(null);
            await triggerGlobalRefresh();
          }}
        />
      )}

      {/* PPF/EPF Modal */}
      {ppfModalVoucherId && (
        <PMSPPFModal
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          voucherId={ppfModalVoucherId === '__new__' ? undefined : ppfModalVoucherId}
          onClose={() => setPpfModalVoucherId(null)}
          onSaved={async () => {
            setPpfModalVoucherId(null);
            await triggerGlobalRefresh();
          }}
        />
      )}

      {/* NCD / Bond Modal */}
      {ncdModalVoucherId && (
        <PMSNCDBondModal
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          voucherId={ncdModalVoucherId.voucherId === '__new__' ? undefined : (ncdModalVoucherId.voucherId ?? undefined)}
          assetCategory={ncdModalVoucherId.category}
          onClose={() => setNcdModalVoucherId(null)}
          onSaved={async () => {
            setNcdModalVoucherId(null);
            await triggerGlobalRefresh();
          }}
        />
      )}

      {/* Gold / Silver Modal */}
      {goldSilverModal && (
        <PMSGoldSilverModal
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          voucherId={goldSilverModal.voucherId ?? undefined}
          metal={goldSilverModal.metal}
          initialMode={goldSilverModal.mode}
          onClose={() => setGoldSilverModal(null)}
          onSaved={async () => {
            setGoldSilverModal(null);
            await triggerGlobalRefresh();
          }}
        />
      )}

      {/* ULIP Policy / Renewal Modal */}
      {ulipModalVoucherId && (
        <PMSULIPModal
          assetId={assetId}
          assetName={assetName}
          portfolioIds={portfolioIds}
          voucherId={ulipModalVoucherId === '__new__' ? undefined : ulipModalVoucherId}
          initialMode="renewal"
          onClose={() => setUlipModalVoucherId(null)}
          onSaved={async () => {
            setUlipModalVoucherId(null);
            await triggerGlobalRefresh();
          }}
        />
      )}
    </>
  );
}

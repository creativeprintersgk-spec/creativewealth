import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Sparkles, 
  Building2, 
  Check, 
  Filter,
  CreditCard,
  TrendingUp,
  Download
} from 'lucide-react';
import { useFY } from '../FYContext';
import { state, getStoredPortfolios, getStoredLedgers } from '../logic';
import { 
  computeExpectedDividends, 
  postDividendVoucher,
  type DividendReconItem 
} from '../services/dividendReconService';

export default function DividendReconciliation() {
  const navigate = useNavigate();
  const { currentFY } = useFY();
  const portfolios = getStoredPortfolios();

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'reconciled'>('all');
  const [dividendList, setDividendList] = useState<DividendReconItem[]>([]);
  const [bankSelections, setBankSelections] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = () => {
    const pId = selectedPortfolioId ? Number(selectedPortfolioId) : undefined;
    const items = computeExpectedDividends(pId, currentFY);
    setDividendList(items);

    // Initialize bank selections
    const initialBanks: Record<string, string> = {};
    items.forEach(item => {
      if (item.bankLedgerId) {
        initialBanks[item.id] = item.bankLedgerId;
      }
    });
    setBankSelections(initialBanks);
  };

  useEffect(() => {
    loadData();
  }, [selectedPortfolioId, currentFY]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return dividendList.filter(item => {
      if (selectedFilter === 'pending') return !item.isReconciled;
      if (selectedFilter === 'reconciled') return item.isReconciled;
      return true;
    });
  }, [dividendList, selectedFilter]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalGross = 0;
    let totalReconciled = 0;
    let totalPending = 0;
    let totalTds = 0;

    dividendList.forEach(item => {
      totalGross += item.grossAmount;
      totalTds += item.tdsAmount;
      if (item.isReconciled) {
        totalReconciled += item.grossAmount;
      } else {
        totalPending += item.grossAmount;
      }
    });

    return { totalGross, totalReconciled, totalPending, totalTds };
  }, [dividendList]);

  // Available bank ledgers for the active account
  const bankLedgers = useMemo(() => {
    return state.acmac1.filter((l: any) => 
      !l.is_group && (l.parent_id === 60 || l.name.toLowerCase().includes('bank'))
    );
  }, []);

  const handlePostSingle = async (item: DividendReconItem) => {
    const bankId = bankSelections[item.id] || item.bankLedgerId;
    if (!bankId) {
      alert(`Please select a Bank Account for ${item.companyName}`);
      return;
    }

    setProcessingId(item.id);
    try {
      await postDividendVoucher(item, bankId);
      setSuccessToast(`Dividend of ₹${item.grossAmount} for ${item.symbol} posted successfully!`);
      loadData();
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert(`Error posting dividend: ${err.message || String(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePostAllPending = async () => {
    const pendingItems = dividendList.filter(item => !item.isReconciled);
    if (pendingItems.length === 0) {
      alert("No pending dividends to reconcile.");
      return;
    }

    if (!confirm(`Are you sure you want to 1-click reconcile and post ${pendingItems.length} dividend vouchers?`)) {
      return;
    }

    setIsBatchProcessing(true);
    let successCount = 0;
    for (const item of pendingItems) {
      const bankId = bankSelections[item.id] || item.bankLedgerId || bankLedgers[0]?.id;
      if (bankId) {
        try {
          await postDividendVoucher(item, String(bankId));
          successCount++;
        } catch (e) {
          console.error(`Failed to reconcile dividend for ${item.symbol}:`, e);
        }
      }
    }
    setIsBatchProcessing(false);
    loadData();
    setSuccessToast(`Successfully posted ${successCount} dividend vouchers to your double-entry ledgers!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* ── Top Navigation & Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              padding: '8px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              💰 Automated Dividend Reconciliation
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Auto-calculate expected dividends based on record-date holding quantities and 1-click post to double-entry ledgers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={loadData}
            style={{
              background: '#fff',
              border: '1px solid #cbd5e1',
              padding: '10px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569'
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          <button
            onClick={handlePostAllPending}
            disabled={isBatchProcessing || stats.totalPending === 0}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: (isBatchProcessing || stats.totalPending === 0) ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              opacity: (isBatchProcessing || stats.totalPending === 0) ? 0.6 : 1
            }}
          >
            <Sparkles size={16} /> {isBatchProcessing ? 'Reconciling...' : '1-Click Reconcile All Pending'}
          </button>
        </div>
      </div>

      {/* ── Toast Notification ── */}
      {successToast && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #6ee7b7',
          color: '#065f46',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '14px'
        }}>
          <CheckCircle size={18} color="#059669" /> {successToast}
        </div>
      )}

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Total Expected</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            ₹{stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Calculated for FY {currentFY}</div>
        </div>

        <div style={{ background: '#fff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Reconciled (Posted)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>
            ₹{stats.totalReconciled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>In double-entry ledgers</div>
        </div>

        <div style={{ background: '#fff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Pending Action</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706' }}>
            ₹{stats.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>Awaiting reconciliation</div>
        </div>

        <div style={{ background: '#fff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Total TDS (26AS)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#475569' }}>
            ₹{stats.totalTds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Tax credit receivable</div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div style={{
        background: '#fff',
        padding: '14px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginRight: '8px' }}>Portfolio:</label>
            <select
              value={selectedPortfolioId}
              onChange={e => setSelectedPortfolioId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff'
              }}
            >
              <option value="">All Portfolios</option>
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.portfolioName || p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setSelectedFilter('all')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background: selectedFilter === 'all' ? '#fff' : 'transparent',
                color: selectedFilter === 'all' ? '#0f172a' : '#64748b',
                boxShadow: selectedFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              All ({dividendList.length})
            </button>
            <button
              onClick={() => setSelectedFilter('pending')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background: selectedFilter === 'pending' ? '#fff' : 'transparent',
                color: selectedFilter === 'pending' ? '#d97706' : '#64748b',
                boxShadow: selectedFilter === 'pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Pending ({dividendList.filter(d => !d.isReconciled).length})
            </button>
            <button
              onClick={() => setSelectedFilter('reconciled')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background: selectedFilter === 'reconciled' ? '#fff' : 'transparent',
                color: selectedFilter === 'reconciled' ? '#16a34a' : '#64748b',
                boxShadow: selectedFilter === 'reconciled' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Reconciled ({dividendList.filter(d => d.isReconciled).length})
            </button>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Showing <strong>{filteredItems.length}</strong> items
        </div>
      </div>

      {/* ── Reconciliation Table ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '14px 18px' }}>Security & Portfolio</th>
              <th style={{ padding: '14px 18px' }}>Record Date</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Held Qty</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Rate (₹/sh)</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Gross Amount</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>TDS (₹)</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Net Credit</th>
              <th style={{ padding: '14px 18px' }}>Target Bank A/c</th>
              <th style={{ padding: '14px 18px' }}>Status</th>
              <th style={{ padding: '14px 18px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No dividend entries found matching the active filters.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.companyName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {item.symbol} &bull; {item.portfolioName}
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#334155', fontWeight: 600 }}>
                    {item.recordDate}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700 }}>
                    {item.holdingQuantity.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: '#475569' }}>
                    ₹{item.dividendPerShare.toFixed(2)}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    ₹{item.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: item.tdsAmount > 0 ? '#ef4444' : '#64748b' }}>
                    {item.tdsAmount > 0 ? `-₹${item.tdsAmount.toFixed(2)}` : '₹0.00'}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                    ₹{item.netBankAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {item.isReconciled ? (
                      <span style={{ color: '#475569', fontSize: '12px' }}>{item.bankLedgerName || 'Bank'}</span>
                    ) : (
                      <select
                        value={bankSelections[item.id] || item.bankLedgerId || ''}
                        onChange={e => setBankSelections(prev => ({ ...prev, [item.id]: e.target.value }))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          background: '#fff',
                          maxWidth: '160px'
                        }}
                      >
                        <option value="">Select Bank...</option>
                        {bankLedgers.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {item.isReconciled ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#dcfce7',
                        color: '#15803d',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        <Check size={12} /> Reconciled
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#fef3c7',
                        color: '#b45309',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        Pending
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    {item.isReconciled ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Done</span>
                    ) : (
                      <button
                        onClick={() => handlePostSingle(item)}
                        disabled={processingId === item.id}
                        style={{
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: processingId === item.id ? 'not-allowed' : 'pointer',
                          opacity: processingId === item.id ? 0.7 : 1
                        }}
                      >
                        {processingId === item.id ? 'Posting...' : 'Post Voucher'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

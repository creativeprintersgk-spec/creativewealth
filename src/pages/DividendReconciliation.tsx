import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  RefreshCw, 
  Building2, 
  Check, 
  Filter,
  CreditCard,
  TrendingUp,
  Download,
  Search,
  Coins,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';
import { useFY } from '../FYContext';
import { useFamily } from '../contexts/FamilyContext';
import { state, getStoredPortfolios, getStoredAccounts, formatDateDDMMMYYYY } from '../logic';
import { 
  computeEligibleFamilyPayouts, 
  postPayoutVoucher,
  undoPayoutVoucher,
  getCleanBankAccountsForMember,
  type EligiblePayoutItem 
} from '../services/corporatePayoutsService';

export default function DividendReconciliation() {
  const navigate = useNavigate();
  const { currentFY, selectedFY } = useFY();
  const { activeFamilyId } = useFamily();
  const effectiveFY = selectedFY || currentFY || '2026-2027';

  // ── Filters & View State ──
  const [selectedAccountId, setSelectedAccountId] = useState<string>(''); // '' = All Family Members
  const [selectedAssetType, setSelectedAssetType] = useState<'ALL' | 'EQUITY' | 'SGB' | 'BOND'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RECONCILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Data lists
  const [payoutList, setPayoutList] = useState<EligiblePayoutItem[]>([]);
  const [bankSelections, setBankSelections] = useState<Record<string, string>>({});
  const [customRates, setCustomRates] = useState<Record<string, number>>({});
  const [customTdsValues, setCustomTdsValues] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Available family members for dropdown
  const familyMembers = useMemo(() => {
    return getStoredAccounts(false);
  }, []);

  const loadData = () => {
    const acidNum = selectedAccountId ? Number(selectedAccountId) : undefined;
    const items = computeEligibleFamilyPayouts(acidNum, effectiveFY);
    setPayoutList(items);

    // Initialize bank selections and default TDS
    const initialBanks: Record<string, string> = {};
    const initialTds: Record<string, number> = {};
    items.forEach(item => {
      if (item.bankLedgerId) {
        initialBanks[item.id] = item.bankLedgerId;
      }
      initialTds[item.id] = item.tdsAmount;
    });
    setBankSelections(prev => ({ ...initialBanks, ...prev }));
    setCustomTdsValues(prev => ({ ...initialTds, ...prev }));
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('wealthcore-sync-complete', handleSync);
    const t1 = setTimeout(loadData, 500);
    const t2 = setTimeout(loadData, 1500);
    const t3 = setTimeout(loadData, 3000);
    return () => {
      window.removeEventListener('wealthcore-sync-complete', handleSync);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [selectedAccountId, effectiveFY, activeFamilyId]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return payoutList.filter(item => {
      // Asset Type filter
      if (selectedAssetType === 'EQUITY' && item.securityType !== 'EQUITY') return false;
      if (selectedAssetType === 'SGB' && item.securityType !== 'SGB') return false;
      if (selectedAssetType === 'BOND' && !['BOND', 'GSEC'].includes(item.securityType)) return false;

      // Status filter
      if (statusFilter === 'PENDING' && item.isReconciled) return false;
      if (statusFilter === 'RECONCILED' && !item.isReconciled) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.securityName.toLowerCase().includes(q) ||
          item.symbol.toLowerCase().includes(q) ||
          item.isin.toLowerCase().includes(q) ||
          item.accountName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [payoutList, selectedAssetType, statusFilter, searchQuery]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalGross = 0;
    let totalReconciled = 0;
    let totalPending = 0;
    let totalTds = 0;

    payoutList.forEach(item => {
      const rate = typeof customRates[item.id] === 'number' ? customRates[item.id] : item.payoutRate;
      const gross = item.isReconciled ? item.grossAmount : Number((item.holdingQuantity * rate).toFixed(2));
      const currentTds = typeof customTdsValues[item.id] === 'number' ? customTdsValues[item.id] : item.tdsAmount;
      totalGross += gross;
      totalTds += currentTds;
      if (item.isReconciled) {
        totalReconciled += gross;
      } else {
        totalPending += gross;
      }
    });

    return { totalGross, totalReconciled, totalPending, totalTds };
  }, [payoutList, customTdsValues, customRates]);

  // Single Action: Post Payout Double Entry
  const handlePostPayout = async (item: EligiblePayoutItem) => {
    const bankId = bankSelections[item.id] || item.bankLedgerId;
    if (!bankId) {
      alert(`Please select a Bank Account for ${item.securityName}`);
      return;
    }

    const rate = typeof customRates[item.id] === 'number' ? customRates[item.id] : item.payoutRate;
    const finalGross = item.isReconciled ? item.grossAmount : Number((item.holdingQuantity * rate).toFixed(2));
    const currentTds = customTdsValues[item.id] ?? item.tdsAmount;
    setProcessingId(item.id);

    try {
      await postPayoutVoucher(item, bankId, currentTds, finalGross, rate);
      setToastMessage(`✓ ${item.securityType === 'EQUITY' ? 'Dividend' : 'Interest'} of ₹${finalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })} posted to accounting ledgers!`);
      loadData();
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert(`Error posting entry: ${err.message || String(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Undo Payout Double Entry
  const handleUndoPayout = async (item: EligiblePayoutItem) => {
    if (!item.reconciledVoucherId) {
      alert('No recorded voucher found to undo.');
      return;
    }
    if (!confirm(`Undo reconciliation entry for ${item.securityName}? This will remove the voucher from bank and dividend ledgers.`)) {
      return;
    }
    setProcessingId(item.id);
    try {
      await undoPayoutVoucher(item);
      setToastMessage(`✓ Reverted reconciliation voucher for ${item.securityName}.`);
      loadData();
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert(`Error undoing payout: ${err.message || String(err)}`);
    } finally {
      setProcessingId(null);
    }
  };



  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f8fafc', padding: '24px 32px' }}>
      
      {/* ── TOP BREADCRUMB & TOOLBAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
            <span>Wealth Workspace</span>
            <ChevronRight size={12} />
            <span style={{ color: '#0f172a', fontWeight: 700 }}>Corporate Actions & Income Recon</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💰 Income Reconciliation
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1' }}>
              Record Date Settled
            </span>
          </h1>
        </div>

        {/* Filters: Family/Member & FY Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Member / Family Selector */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginRight: '6px' }}>MEMBER:</span>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 700,
                color: '#0f172a',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="">Pramesh R Shah Family (All Members)</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name || m.accountName}</option>
              ))}
            </select>
          </div>

          {/* Refresh Data */}
          <button
            onClick={loadData}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              padding: '8px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              color: '#475569',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

        </div>
      </div>

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #6ee7b7',
          color: '#065f46',
          padding: '10px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '13px'
        }}>
          <CheckCircle size={16} color="#059669" /> {toastMessage}
        </div>
      )}

      {/* ── SUMMARY KPI CARDS (DASHBOARD THEME) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Total Expected Income
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            ₹{stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            FY {effectiveFY} &bull; {payoutList.length} Entitlements
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Reconciled (Received)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>
            ₹{stats.totalReconciled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
            Credited to Double-Entry Ledgers
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Pending Action
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706' }}>
            ₹{stats.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>
            Awaiting 1-Click Voucher Post
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Total TDS (Tax Deducted)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#475569' }}>
            ₹{stats.totalTds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Debited to TDS Receivable
          </div>
        </div>

      </div>

      {/* ── FILTER & SEGMENT TABS BAR ── */}
      <div style={{
        background: '#fff',
        padding: '12px 18px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            onClick={() => setSelectedAssetType('ALL')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: selectedAssetType === 'ALL' ? '#fff' : 'transparent',
              color: selectedAssetType === 'ALL' ? '#0f172a' : '#64748b',
              boxShadow: selectedAssetType === 'ALL' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            All Payouts ({payoutList.length})
          </button>
          <button
            onClick={() => setSelectedAssetType('EQUITY')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: selectedAssetType === 'EQUITY' ? '#fff' : 'transparent',
              color: selectedAssetType === 'EQUITY' ? '#0f172a' : '#64748b',
              boxShadow: selectedAssetType === 'EQUITY' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            📈 Equities ({payoutList.filter(p => p.securityType === 'EQUITY').length})
          </button>
          <button
            onClick={() => setSelectedAssetType('SGB')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: selectedAssetType === 'SGB' ? '#fff' : 'transparent',
              color: selectedAssetType === 'SGB' ? '#0f172a' : '#64748b',
              boxShadow: selectedAssetType === 'SGB' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            🥇 SGB Gold Bonds ({payoutList.filter(p => p.securityType === 'SGB').length})
          </button>
          <button
            onClick={() => setSelectedAssetType('BOND')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: selectedAssetType === 'BOND' ? '#fff' : 'transparent',
              color: selectedAssetType === 'BOND' ? '#0f172a' : '#64748b',
              boxShadow: selectedAssetType === 'BOND' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            🏛️ Bonds & G-Secs ({payoutList.filter(p => ['BOND', 'GSEC'].includes(p.securityType)).length})
          </button>
        </div>

        {/* Status Chips & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Status filter */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                border: 'none',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: statusFilter === 'ALL' ? '#fff' : 'transparent',
                color: statusFilter === 'ALL' ? '#0f172a' : '#64748b'
              }}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              style={{
                border: 'none',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: statusFilter === 'PENDING' ? '#fff' : 'transparent',
                color: statusFilter === 'PENDING' ? '#d97706' : '#64748b'
              }}
            >
              Pending ({payoutList.filter(p => !p.isReconciled).length})
            </button>
            <button
              onClick={() => setStatusFilter('RECONCILED')}
              style={{
                border: 'none',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: statusFilter === 'RECONCILED' ? '#fff' : 'transparent',
                color: statusFilter === 'RECONCILED' ? '#16a34a' : '#64748b'
              }}
            >
              Reconciled ({payoutList.filter(p => p.isReconciled).length})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search stock, bond, ISIN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                background: '#fff'
              }}
            />
          </div>

        </div>
      </div>

      {/* ── MAIN RECONCILIATION DATA TABLE ── */}
      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', minWidth: '1180px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              <th style={{ padding: '12px 14px', minWidth: '220px', maxWidth: '270px' }}>Security & ISIN</th>
              <th style={{ padding: '12px 14px', minWidth: '130px', whiteSpace: 'nowrap' }}>Member</th>
              <th style={{ padding: '12px 14px', minWidth: '110px', whiteSpace: 'nowrap' }}>Record Date</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '80px' }}>Held Qty</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '95px' }}>Declared Rate</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '105px' }}>Gross Amount</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '85px' }}>TDS (₹)</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '105px' }}>Net Credit</th>
              <th style={{ padding: '12px 14px', minWidth: '260px' }}>Target Bank & Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  No payout declarations found for assets held on Record Date under active filters.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const memberBanks = getCleanBankAccountsForMember(item.accountId);
                const effectiveRate = typeof customRates[item.id] === 'number' ? customRates[item.id] : item.payoutRate;
                const effectiveGross = item.isReconciled ? item.grossAmount : Number((item.holdingQuantity * effectiveRate).toFixed(2));
                const currentTds = customTdsValues[item.id] ?? item.tdsAmount;
                const netAmount = Number((effectiveGross - currentTds).toFixed(2));

                const typeBadge = item.securityType === 'EQUITY' 
                  ? { bg: '#dcfce7', color: '#15803d', label: 'EQ' }
                  : item.securityType === 'SGB'
                    ? { bg: '#fef3c7', color: '#b45309', label: 'SGB' }
                    : { bg: '#e0e7ff', color: '#3730a3', label: 'BND' };

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s' }}>
                    
                    {/* Security & ISIN (STRICTLY MAX 2 ROWS) */}
                    <td style={{ padding: '10px 14px', maxWidth: '270px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 5px',
                          borderRadius: '4px',
                          background: typeBadge.bg,
                          color: typeBadge.color,
                          flexShrink: 0
                        }}>
                          {typeBadge.label}
                        </span>
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                          <div style={{
                            fontWeight: 800,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }} title={item.securityName}>
                            {item.securityName}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.symbol} &bull; <span style={{ fontFamily: 'monospace', color: '#475569' }}>{item.isin}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Member Only (No Portfolio) */}
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.accountName}</div>
                    </td>

                    {/* Record Date (DD-MMM-YYYY) */}
                    <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {formatDateDDMMMYYYY(item.recordDate)}
                    </td>

                    {/* Held Qty on Record Date */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {item.holdingQuantity.toLocaleString('en-IN')}
                    </td>

                    {/* Declared Rate */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {item.isReconciled ? (
                        <span style={{ color: '#475569', fontWeight: 600 }}>₹{effectiveRate.toFixed(2)}</span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          value={customRates[item.id] !== undefined ? customRates[item.id] : effectiveRate}
                          placeholder="0.00"
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setCustomRates(prev => ({ ...prev, [item.id]: isNaN(val) ? 0 : val }));
                          }}
                          style={{
                            width: '70px',
                            padding: '4px 6px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#0f172a',
                            outline: 'none'
                          }}
                          title="Click to adjust declared rate"
                        />
                      )}
                    </td>

                    {/* Gross Amount */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      ₹{effectiveGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* TDS (Editable Input, Not Compulsory) */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {item.isReconciled ? (
                        <span style={{ color: currentTds > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                          ₹{currentTds.toFixed(2)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTds === 0 ? '' : currentTds}
                          placeholder="0.00"
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            setCustomTdsValues(prev => ({ ...prev, [item.id]: val }));
                          }}
                          style={{
                            width: '75px',
                            padding: '4px 6px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: currentTds > 0 ? '#dc2626' : '#0f172a',
                            outline: 'none'
                          }}
                        />
                      )}
                    </td>

                    {/* Net Credit */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                      ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Target Bank A/c & Confirmation (Merged with RECD action) */}
                    <td style={{ padding: '10px 14px' }}>
                      {item.isReconciled ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#334155',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '150px'
                          }} title={item.bankLedgerName || 'Bank A/c'}>
                            {item.bankLedgerName || 'Bank A/c'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              whiteSpace: 'nowrap'
                            }}>
                              <Check size={12} /> RECD
                            </span>
                            {item.reconciledVoucherId && (
                              <button
                                onClick={() => handleUndoPayout(item)}
                                disabled={processingId === item.id}
                                title="Undo this reconciliation entry"
                                style={{
                                  background: '#fff',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  padding: '3px 7px',
                                  borderRadius: '5px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: processingId === item.id ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <RotateCcw size={11} /> Undo
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={bankSelections[item.id] || item.bankLedgerId || ''}
                            onChange={e => setBankSelections(prev => ({ ...prev, [item.id]: e.target.value }))}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '11.5px',
                              background: '#fff',
                              flex: 1,
                              minWidth: '140px',
                              maxWidth: '190px',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          >
                            <option value="">Select Bank...</option>
                            {memberBanks.map((b: any) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handlePostPayout(item)}
                            disabled={processingId === item.id}
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: processingId === item.id ? 'not-allowed' : 'pointer',
                              opacity: processingId === item.id ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {processingId === item.id ? 'Posting...' : 'RECD'}
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

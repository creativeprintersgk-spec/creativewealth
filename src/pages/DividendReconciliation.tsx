import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
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
  ArrowUpRight
} from 'lucide-react';
import { useFY } from '../FYContext';
import { useFamily } from '../contexts/FamilyContext';
import { state, getStoredPortfolios, getStoredAccounts } from '../logic';
import { 
  computeEligibleFamilyPayouts, 
  postPayoutVoucher,
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
  const [customTdsValues, setCustomTdsValues] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
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

  // Available bank accounts per member (parent_id 60 = Bank Accounts in WealthCore)
  const getBankAccountsForMember = (acid: number) => {
    return (state.acmac1 || []).filter((l: any) => 
      !l.is_group && 
      Number(l.acid) === Number(acid) && 
      Number(l.parent_id) === 60
    );
  };

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
      const currentTds = typeof customTdsValues[item.id] === 'number' ? customTdsValues[item.id] : item.tdsAmount;
      totalGross += item.grossAmount;
      totalTds += currentTds;
      if (item.isReconciled) {
        totalReconciled += item.grossAmount;
      } else {
        totalPending += item.grossAmount;
      }
    });

    return { totalGross, totalReconciled, totalPending, totalTds };
  }, [payoutList, customTdsValues]);

  // Single Action: Post Payout Double Entry
  const handlePostPayout = async (item: EligiblePayoutItem) => {
    const bankId = bankSelections[item.id] || item.bankLedgerId;
    if (!bankId) {
      alert(`Please select a Bank Account for ${item.securityName}`);
      return;
    }

    const currentTds = customTdsValues[item.id] ?? item.tdsAmount;
    setProcessingId(item.id);

    try {
      await postPayoutVoucher(item, bankId, currentTds);
      setToastMessage(`✓ ${item.securityType === 'EQUITY' ? 'Dividend' : 'Interest'} of ₹${item.grossAmount.toLocaleString('en-IN')} posted to accounting ledgers!`);
      loadData();
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert(`Error posting entry: ${err.message || String(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Batch Action: Reconcile All Pending
  const handleReconcileAllPending = async () => {
    const pendingItems = payoutList.filter(item => !item.isReconciled);
    if (pendingItems.length === 0) {
      alert("No pending payouts to reconcile.");
      return;
    }

    if (!confirm(`Confirm 1-Click posting of ${pendingItems.length} dividend/interest double-entry vouchers to accounting?`)) {
      return;
    }

    setIsBatchProcessing(true);
    let successCount = 0;

    for (const item of pendingItems) {
      const memberBanks = getBankAccountsForMember(item.accountId);
      const bankId = bankSelections[item.id] || item.bankLedgerId || memberBanks[0]?.id;
      const currentTds = customTdsValues[item.id] ?? item.tdsAmount;

      if (bankId) {
        try {
          await postPayoutVoucher(item, String(bankId), currentTds);
          successCount++;
        } catch (e) {
          console.error(`Failed to reconcile payout for ${item.symbol}:`, e);
        }
      }
    }

    setIsBatchProcessing(false);
    loadData();
    setToastMessage(`✓ Successfully posted ${successCount} double-entry vouchers to your accounts!`);
    setTimeout(() => setToastMessage(null), 4000);
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

          {/* 1-Click Reconcile Pending */}
          <button
            onClick={handleReconcileAllPending}
            disabled={isBatchProcessing || stats.totalPending === 0}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              cursor: (isBatchProcessing || stats.totalPending === 0) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              opacity: (isBatchProcessing || stats.totalPending === 0) ? 0.6 : 1
            }}
          >
            <Sparkles size={14} /> {isBatchProcessing ? 'Reconciling...' : '1-Click Reconcile All'}
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
              <th style={{ padding: '12px 14px', minWidth: '220px' }}>Security & ISIN</th>
              <th style={{ padding: '12px 14px', minWidth: '150px' }}>Member / Portfolio</th>
              <th style={{ padding: '12px 14px', minWidth: '100px', whiteSpace: 'nowrap' }}>Record Date</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '85px' }}>Held Qty</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '100px' }}>Declared Rate</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '110px' }}>Gross Amount</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '95px' }}>TDS (₹)</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '110px' }}>Net Credit</th>
              <th style={{ padding: '12px 14px', minWidth: '170px' }}>Target Bank A/c</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', minWidth: '110px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  No payout declarations found for assets held on Record Date under active filters.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const memberBanks = getBankAccountsForMember(item.accountId);
                const currentTds = customTdsValues[item.id] ?? item.tdsAmount;
                const netAmount = Number((item.grossAmount - currentTds).toFixed(2));

                const typeBadge = item.securityType === 'EQUITY' 
                  ? { bg: '#dcfce7', color: '#15803d', label: 'EQ' }
                  : item.securityType === 'SGB'
                    ? { bg: '#fef3c7', color: '#b45309', label: 'SGB' }
                    : { bg: '#e0e7ff', color: '#3730a3', label: 'BND' };

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s' }}>
                    
                    {/* Security & ISIN */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: typeBadge.bg,
                          color: typeBadge.color
                        }}>
                          {typeBadge.label}
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.securityName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {item.symbol} &bull; <span style={{ fontFamily: 'monospace', color: '#475569' }}>{item.isin}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Member & Portfolio */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#334155' }}>{item.accountName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{item.portfolioName}</div>
                    </td>

                    {/* Record Date */}
                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>
                      {item.recordDate}
                    </td>

                    {/* Held Qty on Record Date */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {item.holdingQuantity.toLocaleString('en-IN')}
                    </td>

                    {/* Declared Rate */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>
                      ₹{item.payoutRate.toFixed(2)}
                    </td>

                    {/* Gross Amount */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      ₹{item.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* TDS (Editable Input, Not Compulsory) */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
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
                            width: '80px',
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
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                      ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Target Bank A/c */}
                    <td style={{ padding: '12px 16px' }}>
                      {item.isReconciled ? (
                        <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                          {item.bankLedgerName || 'Bank A/c'}
                        </span>
                      ) : (
                        <select
                          value={bankSelections[item.id] || item.bankLedgerId || ''}
                          onChange={e => setBankSelections(prev => ({ ...prev, [item.id]: e.target.value }))}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '11.5px',
                            background: '#fff',
                            width: '100%',
                            minWidth: '160px',
                            maxWidth: '210px',
                            fontWeight: 600,
                            outline: 'none'
                          }}
                        >
                          <option value="">Select Bank...</option>
                          {memberBanks.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Action: RECD / Reconciled */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                          <Check size={12} /> RECD
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePostPayout(item)}
                          disabled={processingId === item.id}
                          style={{
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: processingId === item.id ? 'not-allowed' : 'pointer',
                            opacity: processingId === item.id ? 0.7 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)'
                          }}
                        >
                          {processingId === item.id ? 'Posting...' : 'RECD'}
                        </button>
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

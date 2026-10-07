import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  PieChart, 
  Layers, 
  RefreshCw, 
  ArrowUpRight, 
  FolderOpen, 
  ShieldCheck, 
  Coins, 
  BarChart3,
  ExternalLink,
  Users,
  CheckCircle2
} from 'lucide-react';
import { 
  getStoredPortfolios, 
  getHoldings, 
  getStoredAccounts, 
  syncLivePrices, 
  state,
} from '../logic';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeFamily } = useFamily();
  const { selectedAccountId, globalRefreshTrigger } = useFY();

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Listen to global sync and trigger updates
  useEffect(() => {
    const handleSync = () => setTick(t => t + 1);
    window.addEventListener('wealthcore-sync-complete', handleSync);
    setTick(t => t + 1);
    return () => window.removeEventListener('wealthcore-sync-complete', handleSync);
  }, []);

  // Auto-sync prices if not yet synced
  useEffect(() => {
    if (Object.keys(state.priceMap || {}).length < 20) {
      setSyncStatus('Syncing prices...');
      syncLivePrices((msg) => setSyncStatus(msg), true)
        .catch(console.warn)
        .finally(() => {
          setSyncStatus(null);
          setTick(t => t + 1);
        });
    }
  }, []);

  const handleManualSync = () => {
    if (syncStatus) return;
    setSyncStatus('Syncing prices...');
    syncLivePrices((msg) => setSyncStatus(msg), true)
      .catch(console.warn)
      .finally(() => {
        setSyncStatus(null);
        setTick(t => t + 1);
      });
  };

  // Get all accounts and portfolios
  const allAccounts = useMemo(() => getStoredAccounts(), [tick, globalRefreshTrigger]);
  const familyAccounts = useMemo(() => {
    const famId = String(activeFamily?.id || '1');
    return allAccounts.filter(a => String(a.familyId) === famId);
  }, [allAccounts, activeFamily?.id]);

  const selectedAccount = useMemo(() => {
    return familyAccounts.find(a => String(a.id) === selectedAccountId) || null;
  }, [familyAccounts, selectedAccountId]);

  // Determine portfolios in scope
  const scopedPortfolios = useMemo(() => {
    const all = getStoredPortfolios();
    const famId = String(activeFamily?.id || '1');

    if (selectedAccountId) {
      // If a specific member account is selected in top navbar, show their linked portfolios
      const matching = all.filter(p => String(p.accountId) === String(selectedAccountId));
      if (matching.length > 0) return matching;
    }

    // Default: all portfolios belonging to this family (all client_id === famId or linked accounts)
    return all.filter(p => String(p.client_id) === famId || familyAccounts.some(acc => String(acc.id) === String(p.accountId)));
  }, [selectedAccountId, familyAccounts, activeFamily?.id, tick, globalRefreshTrigger]);

  const pfIds = useMemo(() => scopedPortfolios.map(p => Number(p.id)), [scopedPortfolios]);

  // Real holdings for all scoped portfolios
  const holdings = useMemo(() => {
    if (pfIds.length === 0) return [];
    return getHoldings(pfIds);
  }, [pfIds, tick, globalRefreshTrigger]);

  // Real aggregate summary calculated from real live holdings
  const summary = useMemo(() => {
    if (holdings.length === 0) {
      return {
        totalInvested: 0,
        currentValue: 0,
        overallGain: 0,
        overallGainPct: 0,
        todaysGain: 0,
        todaysGainPct: 0,
        assetTypeBreakdown: []
      };
    }

    const totalInvested = holdings.reduce((s, h) => s + (h.amtInvested || 0), 0);
    const currentValue = holdings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
    const overallGain = currentValue - totalInvested;
    const overallGainPct = totalInvested > 0 ? (overallGain / totalInvested) * 100 : 0;
    const todaysGain = holdings.reduce((s, h) => s + (h.todaysGain || 0), 0);
    const todaysGainPct = currentValue > 0 ? (todaysGain / (currentValue - todaysGain)) * 100 : 0;

    // Group by asset category
    const categoryMap: Record<string, { name: string; invested: number; value: number; color: string; count: number }> = {
      'bonds': { name: 'Traded Bonds & G-Secs', invested: 0, value: 0, color: '#3b82f6', count: 0 },
      'stocks': { name: 'Direct Equity (Stocks)', invested: 0, value: 0, color: '#10b981', count: 0 },
      'mf_eq': { name: 'Mutual Funds (Equity)', invested: 0, value: 0, color: '#8b5cf6', count: 0 },
      'mf_debt': { name: 'Mutual Funds (Debt / Liquid)', invested: 0, value: 0, color: '#06b6d4', count: 0 },
      'bullion': { name: 'Precious Metals (Gold & Silver)', invested: 0, value: 0, color: '#f59e0b', count: 0 },
      'other': { name: 'Other Investments & Fixed Income', invested: 0, value: 0, color: '#ec4899', count: 0 },
    };

    holdings.forEach(h => {
      const val = h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0);
      const inv = h.amtInvested || 0;
      const type = h.assetType;

      if ([100, 40, 110, 115].includes(type)) {
        categoryMap['bonds'].invested += inv;
        categoryMap['bonds'].value += val;
        categoryMap['bonds'].count++;
      } else if ([50].includes(type)) {
        categoryMap['stocks'].invested += inv;
        categoryMap['stocks'].value += val;
        categoryMap['stocks'].count++;
      } else if ([60, 66, 81].includes(type)) {
        categoryMap['mf_eq'].invested += inv;
        categoryMap['mf_eq'].value += val;
        categoryMap['mf_eq'].count++;
      } else if ([61, 62].includes(type)) {
        categoryMap['mf_debt'].invested += inv;
        categoryMap['mf_debt'].value += val;
        categoryMap['mf_debt'].count++;
      } else if ([75, 77, 150, 151].includes(type)) {
        categoryMap['bullion'].invested += inv;
        categoryMap['bullion'].value += val;
        categoryMap['bullion'].count++;
      } else {
        categoryMap['other'].invested += inv;
        categoryMap['other'].value += val;
        categoryMap['other'].count++;
      }
    });

    const breakdown = Object.values(categoryMap)
      .filter(c => c.value > 0 || c.invested > 0)
      .map(c => ({
        ...c,
        pct: currentValue > 0 ? (c.value / currentValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalInvested,
      currentValue,
      overallGain,
      overallGainPct,
      todaysGain,
      todaysGainPct,
      assetTypeBreakdown: breakdown
    };
  }, [holdings]);

  // Real breakdown of top individual portfolios by valuation
  const portfolioBreakdown = useMemo(() => {
    return scopedPortfolios.map(p => {
      const pHoldings = getHoldings([Number(p.id)]);
      const inv = pHoldings.reduce((s, h) => s + (h.amtInvested || 0), 0);
      const val = pHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
      const gain = val - inv;
      const gainPct = inv > 0 ? (gain / inv) * 100 : 0;
      const acc = familyAccounts.find(a => String(a.id) === String(p.accountId));

      return {
        id: p.id,
        name: p.portfolioName || p.investor_name || `Portfolio ${p.id}`,
        memberName: acc?.accountName || 'Family Account',
        invested: inv,
        value: val,
        gain,
        gainPct,
        holdingsCount: pHoldings.length
      };
    })
    .filter(p => p.value > 0 || p.invested > 0)
    .sort((a, b) => b.value - a.value);
  }, [scopedPortfolios, familyAccounts, tick]);

  // Top 6 largest asset allocations
  const topHoldings = useMemo(() => {
    return [...holdings]
      .sort((a, b) => (b.currentValue || b.amtInvested) - (a.currentValue || a.amtInvested))
      .slice(0, 6);
  }, [holdings]);

  const fmt = (n: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n || 0);
  };

  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 10000000) {
      return `₹${(n / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(n) >= 100000) {
      return `₹${(n / 100000).toFixed(2)} L`;
    }
    return fmt(n);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--bbg-text-main)' }}>
      
      {/* ── HEADER & CONTEXT BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--bbg-text-main)' }}>
              <LayoutDashboard size={28} color="#2563eb" />
              Wealth Overview
            </h1>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: 700, 
              padding: '4px 10px', 
              borderRadius: '0px', 
              background: 'var(--bbg-active-bg)', 
              color: '#1d4ed8', 
              border: '1px solid #bfdbfe' 
            }}>
              {selectedAccount ? `Member: ${selectedAccount.accountName}` : `Family: ${activeFamily?.familyName || 'Pramesh R Shah Family'}`}
            </span>
          </div>
          <p style={{ color: 'var(--bbg-text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>
            Live portfolio valuation, real-time market gains, and verified asset allocations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleManualSync}
            disabled={!!syncStatus}
            className="btn-secondary"
            style={{ 
              height: '36px', 
              padding: '0 14px', 
              fontSize: '12px', 
              fontWeight: 600, 
              gap: '6px', 
              borderRadius: '0px',
              cursor: syncStatus ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={syncStatus ? 'animate-spin' : ''} />
            {syncStatus || 'Refresh Live Quotes'}
          </button>

          <button
            onClick={() => navigate('/pms')}
            className="btn-primary"
            style={{ height: '36px', padding: '0 16px', fontSize: '12px', fontWeight: 700, gap: '6px', borderRadius: '0px' }}
          >
            Open PMS Workspace <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* ── TOP KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        
        {/* Total Net Worth */}
        <div  style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden', background: 'var(--bbg-surface)', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--bbg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Portfolio Value
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '0px', background: 'var(--bbg-active-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} color="#2563eb" />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--bbg-text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {fmt(summary.currentValue)}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: summary.todaysGain >= 0 ? '#16a34a' : '#dc2626' }}>
            {summary.todaysGain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{summary.todaysGain >= 0 ? '+' : ''}{fmt(summary.todaysGain)}</span>
            <span style={{ opacity: 0.85 }}>({summary.todaysGainPct >= 0 ? '+' : ''}{summary.todaysGainPct.toFixed(2)}% Today)</span>
          </div>
        </div>

        {/* Invested Capital */}
        <div  style={{ padding: '20px 24px', background: 'var(--bbg-surface)', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--bbg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Invested Capital
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '0px', background: 'var(--bbg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coins size={18} color="var(--bbg-text-muted)" />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--bbg-text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {fmt(summary.totalInvested)}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--bbg-text-muted)' }}>
            Across {holdings.length} Active Holdings
          </div>
        </div>

        {/* Total Overall Gain */}
        <div  style={{ padding: '20px 24px', background: 'var(--bbg-surface)', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--bbg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unrealised Profit
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '0px', background: summary.overallGain >= 0 ? 'var(--bbg-surface)' : 'var(--bbg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {summary.overallGain >= 0 ? <TrendingUp size={18} color="#16a34a" /> : <TrendingDown size={18} color="#dc2626" />}
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: summary.overallGain >= 0 ? '#16a34a' : '#dc2626', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {summary.overallGain >= 0 ? '+' : ''}{fmt(summary.overallGain)}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: summary.overallGain >= 0 ? '#16a34a' : '#dc2626' }}>
            {summary.overallGainPct >= 0 ? '+' : ''}{summary.overallGainPct.toFixed(2)}% Overall Return
          </div>
        </div>

        {/* Portfolios Scope */}
        <div  style={{ padding: '20px 24px', background: 'var(--bbg-surface)', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--bbg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Portfolios
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '0px', background: 'var(--bbg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={18} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--bbg-text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {scopedPortfolios.length}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--bbg-text-muted)' }}>
            {familyAccounts.length} Family Member Accounts
          </div>
        </div>

      </div>

      {/* ── MIDDLE GRID: REAL ASSET ALLOCATION & REAL PORTFOLIOS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Real Asset Allocation Breakdown */}
        <div style={{ background: 'var(--bbg-surface)', padding: '24px', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 800, color: 'var(--bbg-text-main)' }}>
              <PieChart size={18} color="#2563eb" />
              Verified Asset Allocation
            </div>
            <span style={{ fontSize: '12px', color: 'var(--bbg-text-muted)', fontWeight: 600 }}>
              100% of Live Capital
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {summary.assetTypeBreakdown.map((cat, idx) => (
              <div key={idx} style={{ background: 'var(--bbg-surface)', padding: '12px 16px', borderRadius: '0px', border: '1px solid var(--bbg-hover-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '0px', background: cat.color }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--bbg-text-main)' }}>{cat.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--bbg-text-muted)' }}>({cat.count} holdings)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--bbg-text-main)' }}>{fmt(cat.value)}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', marginLeft: '8px' }}>
                      {cat.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {/* Visual Progress Bar */}
                <div style={{ height: '8px', background: 'var(--bbg-border)', borderRadius: '0px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(1, cat.pct))}%`, 
                      background: cat.color, 
                      borderRadius: '0px',
                      transition: 'width 0.5s ease'
                    }} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--bbg-text-muted)', marginTop: '4px' }}>
                  <span>Invested: {fmt(cat.invested)}</span>
                  <span style={{ color: cat.value >= cat.invested ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {cat.value >= cat.invested ? '+' : ''}{fmt(cat.value - cat.invested)} ({cat.invested > 0 ? (((cat.value - cat.invested) / cat.invested) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real Top Holdings by Capital */}
        <div style={{ background: 'var(--bbg-surface)', padding: '24px', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 800, color: 'var(--bbg-text-main)' }}>
              <Layers size={18} color="#8b5cf6" />
              Largest Capital Allocations
            </div>
            <button
              onClick={() => navigate('/pms')}
              style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View All <ArrowUpRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topHoldings.map((h, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: 'var(--bbg-surface)', 
                  borderRadius: '0px',
                  border: '1px solid var(--bbg-hover-bg)'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--bbg-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.assetName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--bbg-text-muted)', display: 'flex', gap: '8px' }}>
                    <span>Qty: {h.quantity.toLocaleString('en-IN')}</span>
                    <span>•</span>
                    <span>Rate: {fmt(h.currentPrice)}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--bbg-text-main)' }}>
                    {fmt(h.currentValue > 0 ? h.currentValue : h.amtInvested)}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: h.overallGain >= 0 ? '#16a34a' : '#dc2626' }}>
                    {h.overallGain >= 0 ? '+' : ''}{fmt(h.overallGain)} ({h.overallGainPct >= 0 ? '+' : ''}{h.overallGainPct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── BOTTOM SECTION: REAL FAMILY PORTFOLIOS LEADERBOARD ── */}
      <div style={{ background: 'var(--bbg-surface)', padding: '24px', borderRadius: '0px', border: '1px solid var(--bbg-border)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--bbg-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} color="#059669" />
              Family Portfolios Breakdown ({portfolioBreakdown.length} Accounts)
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--bbg-text-muted)' }}>
              Individual performance and valuations across all active family portfolios.
            </p>
          </div>
          
          <button
            onClick={() => navigate('/pms')}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '0px', fontWeight: 600 }}
          >
            Manage in PMS Workspace
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bbg-surface)', borderBottom: '2px solid var(--bbg-border)', color: 'var(--bbg-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Portfolio Name</th>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Linked Member</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Holdings</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Invested Capital</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Current Value</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Unrealised Profit</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Return</th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {portfolioBreakdown.map((p, idx) => (
                <tr 
                  key={idx} 
                  style={{ borderBottom: '1px solid var(--bbg-hover-bg)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bbg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--bbg-text-main)' }}>
                    {p.name}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--bbg-text-muted)' }}>
                    {p.memberName}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--bbg-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {p.holdingsCount}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {fmt(p.invested)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: 'var(--bbg-text-main)' }}>
                    {fmt(p.value)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.gain >= 0 ? '#16a34a' : '#dc2626' }}>
                    {p.gain >= 0 ? '+' : ''}{fmt(p.gain)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.gainPct >= 0 ? '#16a34a' : '#dc2626' }}>
                    {p.gainPct >= 0 ? '+' : ''}{p.gainPct.toFixed(2)}%
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => navigate('/pms')}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: '#2563eb', 
                        cursor: 'pointer', 
                        padding: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                      title="Open in PMS"
                    >
                      Open <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

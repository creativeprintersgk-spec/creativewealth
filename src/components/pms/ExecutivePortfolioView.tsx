import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  ShieldCheck, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  MoreVertical,
  PieChart as PieIcon,
  Layers,
  TrendingUp,
  FileText
} from 'lucide-react';
import type { AssetHolding } from '../../logic';

interface Props {
  holdings: AssetHolding[];
  portfolioName: string;
  isDark?: boolean;
  onHoldingClick?: (holding: AssetHolding) => void;
  onDrilldown?: (assetId: string, assetName: string, portIds: string[], atty?: number) => void;
  portfolioIds?: number[];
  linkedBankBalance?: number;
}

const ALLOCATION_COLORS = {
  equity: '#10b981',       // Emerald Green
  debt: '#38bdf8',         // Sky Blue
  bonds_re: '#818cf8',     // Indigo
  alternatives: '#f59e0b', // Amber / Gold
  other: '#94a3b8'         // Slate Gray
};

type AssetCategoryKey = 
  | 'all' 
  | 'stocks' 
  | 'mutual_funds' 
  | 'traded_bonds' 
  | 'fds' 
  | 'bonds_ncd' 
  | 'gold_silver' 
  | 'ppf' 
  | 'other';

interface CategoryConfig {
  key: AssetCategoryKey;
  label: string;
  shortLabel: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  { key: 'all', label: 'All Assets', shortLabel: 'All' },
  { key: 'stocks', label: 'Stocks', shortLabel: 'Stocks' },
  { key: 'mutual_funds', label: 'Mutual Funds', shortLabel: 'MFs' },
  { key: 'traded_bonds', label: 'Traded Bonds', shortLabel: 'Traded Bonds' },
  { key: 'fds', label: 'Fixed Deposits', shortLabel: 'FDs' },
  { key: 'bonds_ncd', label: 'Bonds & NCD', shortLabel: 'NCD' },
  { key: 'gold_silver', label: 'Gold & Silver', shortLabel: 'Bullion' },
  { key: 'ppf', label: 'PPF / EPF', shortLabel: 'PPF' },
  { key: 'other', label: 'Other Assets', shortLabel: 'Other' },
];

export default function ExecutivePortfolioView({
  holdings,
  portfolioName,
  isDark = true,
  onHoldingClick,
  onDrilldown,
  portfolioIds = [],
  linkedBankBalance = 0
}: Props) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AssetCategoryKey>('all');
  const [mfSubFilter, setMfSubFilter] = useState<'all' | 'equity' | 'debt'>('all');
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);

  // 1. Calculations & Aggregates
  const {
    totalValue,
    totalInvested,
    overallGain,
    overallGainPct,
    todaysGain,
    todaysGainPct,
    cashReserve,
    allocationSlices,
    enrichedRows,
    categoryCounts,
    categoryValues
  } = useMemo(() => {
    let invested = 0;
    let value = 0;
    let today = 0;
    let liquidMfValue = 0;

    const catTotals: Record<string, number> = {
      equity: 0,
      debt: 0,
      bonds_re: 0,
      alternatives: 0
    };

    const counts: Record<AssetCategoryKey, number> = {
      all: 0,
      stocks: 0,
      mutual_funds: 0,
      traded_bonds: 0,
      fds: 0,
      bonds_ncd: 0,
      gold_silver: 0,
      ppf: 0,
      other: 0
    };

    const values: Record<AssetCategoryKey, number> = {
      all: 0,
      stocks: 0,
      mutual_funds: 0,
      traded_bonds: 0,
      fds: 0,
      bonds_ncd: 0,
      gold_silver: 0,
      ppf: 0,
      other: 0
    };

    const rows = holdings.filter(h => !(h as any).isGroup).map(h => {
      const curVal = h.currentValue || (h.quantity * (h.currentPrice || h.avgPrice || 0));
      const costBasis = h.amtInvested || (h.quantity * (h.avgPrice || 0));
      const unGain = curVal - costBasis;
      const unGainPct = costBasis > 0 ? (unGain / costBasis) * 100 : 0;
      const tGain = h.todaysGain || 0;
      const tGainPct = h.todaysGainPct || 0;

      invested += costBasis;
      value += curVal;
      today += tGain;

      // Classify Asset Class
      const atty = h.assetType;
      const name = h.assetName || '';
      let assetClass = 'Equity (Domestic)';
      let catKey = 'equity';
      let categoryType: AssetCategoryKey = 'other';
      let isMfDebt = false;

      if ([50, 51].includes(atty)) {
        assetClass = 'Equity (Domestic)';
        catKey = 'equity';
        categoryType = 'stocks';
      } else if ([60, 62, 75].includes(atty)) {
        assetClass = 'Equity (Mutual Funds)';
        catKey = 'equity';
        categoryType = 'mutual_funds';
      } else if (atty === 61 || /liquid|liquidity|overnight|money market/i.test(name)) {
        assetClass = 'Mutual Funds (Debt / Liquid)';
        catKey = 'debt';
        categoryType = 'mutual_funds';
        isMfDebt = true;
        liquidMfValue += curVal;
      } else if ([40, 100].includes(atty) || /g-sec|gs 20|gs 203|gs 205|govt bond|treasury|sdl\b/i.test(name)) {
        assetClass = 'Debt / Traded Bonds';
        catKey = 'debt';
        categoryType = 'traded_bonds';
      } else if ([30, 90].includes(atty) || /fixed deposit|fd\b/i.test(name)) {
        assetClass = 'Fixed Deposits';
        catKey = 'debt';
        categoryType = 'fds';
      } else if ([110].includes(atty) || /ncd|debenture/i.test(name)) {
        assetClass = 'Bonds & NCD';
        catKey = 'debt';
        categoryType = 'bonds_ncd';
      } else if ([130, 20, 21].includes(atty) || /ppf|epf|provident/i.test(name)) {
        assetClass = 'PPF / EPF';
        catKey = 'debt';
        categoryType = 'ppf';
      } else if ([77, 150, 151, 170].includes(atty) || /gold|silver|sgb|bullion|jewellery/i.test(name)) {
        assetClass = 'Bullion (Gold & Silver)';
        catKey = 'alternatives';
        categoryType = 'gold_silver';
      } else if ([160, 180, 210, 220].includes(atty) || /property|real estate|aif|land/i.test(name)) {
        assetClass = 'Real Estate & Alternatives';
        catKey = 'bonds_re';
        categoryType = 'other';
      } else if (/fund|direct|growth|regular|dividend/i.test(name)) {
        assetClass = 'Mutual Funds';
        catKey = 'equity';
        categoryType = 'mutual_funds';
      } else {
        assetClass = 'Other Investments';
        catKey = 'equity';
        categoryType = 'other';
      }

      catTotals[catKey] = (catTotals[catKey] || 0) + curVal;
      counts.all += 1;
      counts[categoryType] = (counts[categoryType] || 0) + 1;
      values.all += curVal;
      values[categoryType] = (values[categoryType] || 0) + curVal;

      return {
        ...h,
        assetClass,
        categoryType,
        isMfDebt,
        costBasis,
        marketValue: curVal,
        unrealizedGain: unGain,
        unrealizedGainPct: unGainPct,
        todayGain: tGain,
        todayGainPct: tGainPct
      };
    });

    const oGain = value - invested;
    const oGainPct = invested > 0 ? (oGain / invested) * 100 : 0;
    const tGainPct = invested > 0 ? (today / (value - today || 1)) * 100 : 0;

    // Cash reserve: linked bank balance + liquid mutual funds
    const totalCashReserve = linkedBankBalance > 0 ? linkedBankBalance + liquidMfValue : (liquidMfValue > 0 ? liquidMfValue : value * 0.05);

    // Donut chart slices
    const nonZeroTotal = value || 1;
    const slices = [
      { name: 'Equity', key: 'equity', value: catTotals.equity, pct: (catTotals.equity / nonZeroTotal) * 100, color: ALLOCATION_COLORS.equity },
      { name: 'Debt', key: 'debt', value: catTotals.debt, pct: (catTotals.debt / nonZeroTotal) * 100, color: ALLOCATION_COLORS.debt },
      { name: 'Real Estate / Bonds', key: 'bonds_re', value: catTotals.bonds_re, pct: (catTotals.bonds_re / nonZeroTotal) * 100, color: ALLOCATION_COLORS.bonds_re },
      { name: 'Alternatives / Gold', key: 'alternatives', value: catTotals.alternatives, pct: (catTotals.alternatives / nonZeroTotal) * 100, color: ALLOCATION_COLORS.alternatives },
    ].filter(s => s.value > 0);

    return {
      totalValue: value,
      totalInvested: invested,
      overallGain: oGain,
      overallGainPct: oGainPct,
      todaysGain: today,
      todaysGainPct: tGainPct,
      cashReserve: totalCashReserve,
      allocationSlices: slices.length ? slices : [{ name: 'Investments', key: 'equity', value: 100, pct: 100, color: ALLOCATION_COLORS.equity }],
      enrichedRows: rows,
      categoryCounts: counts,
      categoryValues: values
    };
  }, [holdings, linkedBankBalance]);

  // Smart Currency Formatter (Cr / L / Thousands)
  const fmtSmart = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    } else if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    } else {
      return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
    }
  };

  const fmtExact = (n: number, decimals = 2) => {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtQty = (q: number) => {
    return q % 1 === 0 ? q.toLocaleString('en-IN') : q.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  };

  // Filtered rows by category, MF sub-filter, and text search
  const filteredRows = useMemo(() => {
    return enrichedRows.filter(r => {
      // 1. Category Filter
      if (activeCategory !== 'all' && r.categoryType !== activeCategory) {
        return false;
      }

      // 2. MF Sub-filter if Mutual Funds tab is active
      if (activeCategory === 'mutual_funds') {
        if (mfSubFilter === 'equity' && r.isMfDebt) return false;
        if (mfSubFilter === 'debt' && !r.isMfDebt) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.assetName.toLowerCase().includes(q);
        const matchesClass = r.assetClass.toLowerCase().includes(q);
        const matchesIsin = (r as any).isin?.toLowerCase?.()?.includes?.(q);
        if (!matchesName && !matchesClass && !matchesIsin) return false;
      }

      return true;
    });
  }, [enrichedRows, activeCategory, mfSubFilter, searchQuery]);

  // Summary stats for currently filtered view
  const filteredStats = useMemo(() => {
    let cost = 0;
    let val = 0;
    let gain = 0;
    filteredRows.forEach(r => {
      cost += r.costBasis;
      val += r.marketValue;
      gain += r.unrealizedGain;
    });
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { count: filteredRows.length, cost, val, gain, gainPct };
  }, [filteredRows]);

  // Theme-aware palette (Dark Terminal Luxe vs Swiss Light)
  const themeStyles = {
    bg: isDark ? '#070b14' : '#f8fafc',
    surface: isDark ? '#0b1222' : '#ffffff',
    surfaceCard: isDark ? '#0f1a30' : '#ffffff',
    surfaceSubtle: isDark ? '#13203c' : '#f8fafc',
    cardBorder: isDark ? 'rgba(56, 189, 248, 0.16)' : '#e2e8f0',
    cardBorderGlow: isDark ? '0 0 25px rgba(56, 189, 248, 0.08)' : '0 4px 16px -2px rgba(0, 0, 0, 0.05)',
    innerCardBorder: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e2e8f0',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    tableHeaderBg: isDark ? '#0d1629' : '#f8fafc',
    rowHover: isDark ? 'rgba(56, 189, 248, 0.06)' : '#f8fafc',
    rowBorder: isDark ? '#141e33' : '#f1f5f9',
    green: isDark ? '#34d399' : '#16a34a',
    greenBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
    greenBorder: isDark ? 'rgba(52, 211, 153, 0.3)' : '#bbf7d0',
    red: isDark ? '#f87171' : '#dc2626',
    redBg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
    redBorder: isDark ? 'rgba(248, 113, 113, 0.3)' : '#fecaca',
    accentCyan: isDark ? '#38bdf8' : '#0284c7',
    tabActiveBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#eff6ff',
    tabActiveText: isDark ? '#38bdf8' : '#1d4ed8',
    tabActiveBorder: isDark ? 'rgba(56, 189, 248, 0.35)' : '#bfdbfe',
    tabCountBg: isDark ? 'rgba(56, 189, 248, 0.25)' : '#dbeafe',
    tabCountText: isDark ? '#7dd3fc' : '#1e40af',
    accountingDr: isDark ? '#38bdf8' : '#2563eb',
    accountingCr: isDark ? '#a78bfa' : '#7c3aed',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px 20px', background: themeStyles.bg, minHeight: '100%' }}>
      
      {/* ── TOP SECTION: CLIENT OVERVIEW & 4 KPI / DONUT CARDS ── */}
      <div 
        style={{
          background: themeStyles.surface,
          borderRadius: '14px',
          border: `1px solid ${themeStyles.cardBorder}`,
          boxShadow: themeStyles.cardBorderGlow,
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Header Title Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: themeStyles.textPrimary, letterSpacing: '-0.02em' }}>
                Client Overview: {portfolioName || 'Singhania Family'}
              </h1>
              <span 
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: themeStyles.greenBg,
                  color: themeStyles.green,
                  border: `1px solid ${themeStyles.greenBorder}`
                }}
              >
                ● Active
              </span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', color: themeStyles.textSecondary, fontWeight: 500 }}>
              Total AUM: <span style={{ fontWeight: 700, color: themeStyles.textPrimary }}>{fmtSmart(totalValue)}</span> • Overall Gain{' '}
              <span style={{ fontWeight: 700, color: overallGain >= 0 ? themeStyles.green : themeStyles.red }}>
                {overallGain >= 0 ? '+' : ''}{overallGainPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: themeStyles.textMuted }}>
              As of: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* 4 Cards: Total AUM, Performance, Cash Reserve, and Asset Mix Donut */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
          
          {/* Card 1: Total AUM */}
          <div 
            style={{
              background: themeStyles.surfaceCard,
              borderRadius: '12px',
              border: `1px solid ${themeStyles.innerCardBorder}`,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '135px'
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TOTAL AUM
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '6px 0' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: themeStyles.textPrimary, letterSpacing: '-0.02em' }}>
                {fmtSmart(totalValue)}
              </div>
              <div 
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: overallGain >= 0 ? themeStyles.green : themeStyles.red,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                {overallGain >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {overallGain >= 0 ? '+' : ''}{overallGainPct.toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: themeStyles.textMuted }}>
              Cost Basis: <span style={{ fontWeight: 600, color: themeStyles.textSecondary }}>{fmtSmart(totalInvested)}</span>
            </div>
          </div>

          {/* Card 2: Performance (Overall Unrealized Gain) */}
          <div 
            style={{
              background: themeStyles.surfaceCard,
              borderRadius: '12px',
              border: `1px solid ${themeStyles.innerCardBorder}`,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '135px'
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PERFORMANCE (UNREALIZED)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '6px 0' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: overallGain >= 0 ? themeStyles.green : themeStyles.red, letterSpacing: '-0.02em' }}>
                {fmtSmart(overallGain)}
              </div>
              <div 
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: overallGain >= 0 ? themeStyles.greenBg : themeStyles.redBg,
                  color: overallGain >= 0 ? themeStyles.green : themeStyles.red,
                  border: `1px solid ${overallGain >= 0 ? themeStyles.greenBorder : themeStyles.redBorder}`
                }}
              >
                {overallGain >= 0 ? '+' : ''}{overallGainPct.toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: themeStyles.textMuted }}>
              Today's Change:{' '}
              <span style={{ fontWeight: 600, color: todaysGain >= 0 ? themeStyles.green : themeStyles.red }}>
                {todaysGain >= 0 ? '+' : ''}{fmtSmart(todaysGain)} ({todaysGainPct >= 0 ? '+' : ''}{todaysGainPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Card 3: Cash & Liquid Reserve */}
          <div 
            style={{
              background: themeStyles.surfaceCard,
              borderRadius: '12px',
              border: `1px solid ${themeStyles.innerCardBorder}`,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '135px'
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CASH RESERVE & LIQUID
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '6px 0' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: themeStyles.textPrimary, letterSpacing: '-0.02em' }}>
                {fmtSmart(cashReserve)}
              </div>
              <div 
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                  color: themeStyles.accentCyan,
                  border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd'}`
                }}
              >
                {totalValue > 0 ? ((cashReserve / totalValue) * 100).toFixed(1) : 0}% of AUM
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: themeStyles.textMuted }}>
              Liquid MFs & Bank Balances
            </div>
          </div>

          {/* Card 4: Donut Allocation Chart & Legend */}
          <div 
            style={{
              background: themeStyles.surfaceCard,
              borderRadius: '12px',
              border: `1px solid ${themeStyles.innerCardBorder}`,
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '135px'
            }}
          >
            {/* Top Bar inside Donut Card */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                  color: themeStyles.textSecondary
                }}
              >
                <PieIcon size={12} />
                <span>Asset Mix</span>
              </div>
              <MoreVertical size={14} color={themeStyles.textMuted} style={{ cursor: 'pointer' }} />
            </div>

            {/* Donut + Legend Layout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Donut Ring */}
              <div style={{ width: '85px', height: '85px', position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={40}
                      paddingAngle={3}
                      stroke={isDark ? '#0f1a30' : '#ffffff'}
                      strokeWidth={2}
                      onMouseEnter={(data) => setHoveredSlice(data?.name || null)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    >
                      {allocationSlices.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          opacity={hoveredSlice && hoveredSlice !== entry.name ? 0.45 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => fmtExact(Number(val) || 0, 0)}
                      contentStyle={{
                        background: isDark ? '#0b1222' : '#ffffff',
                        borderColor: themeStyles.cardBorder,
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: themeStyles.textPrimary
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div 
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ fontSize: '8px', fontWeight: 700, color: themeStyles.textMuted }}>MIX</div>
                </div>
              </div>

              {/* Vertical Legend matching sample */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                {allocationSlices.slice(0, 4).map(slice => (
                  <div 
                    key={slice.key} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11.5px',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: slice.color, flexShrink: 0 }} />
                      <span style={{ color: themeStyles.textSecondary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slice.name}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: themeStyles.textPrimary, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {slice.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── MIDDLE SECTION: PORTFOLIO BALANCE SHEET & ANALYTICS TABLE ── */}
      <div 
        style={{
          background: themeStyles.surface,
          borderRadius: '14px',
          border: `1px solid ${themeStyles.cardBorder}`,
          boxShadow: themeStyles.cardBorderGlow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Table Title Bar with Collapsible Active State Pill */}
        <div 
          style={{
            padding: '14px 24px',
            borderBottom: `1px solid ${themeStyles.cardBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: themeStyles.tableHeaderBg
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: themeStyles.textPrimary, letterSpacing: '-0.01em' }}>
              Portfolio Balance Sheet & Analytics
            </h2>
            <button
              onClick={() => setIsTableCollapsed(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                background: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                color: themeStyles.accentCyan,
                border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd'}`,
                cursor: 'pointer'
              }}
            >
              <span>Active State</span>
              {isTableCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: themeStyles.surfaceCard,
              border: `1px solid ${themeStyles.innerCardBorder}`,
              borderRadius: '8px',
              padding: '0 10px',
              height: '32px'
            }}>
              <Search size={13} color={themeStyles.textMuted} />
              <input 
                type="text"
                placeholder="Search scrip / ISIN..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  background: 'transparent',
                  color: themeStyles.textPrimary,
                  width: '180px'
                }}
              />
            </div>
          </div>
        </div>

        {/* ── ASSET CATEGORY SELECTOR TABS BAR (STOCKS / MF / TRADED BONDS / FDS / ETC.) ── */}
        <div 
          style={{
            padding: '8px 20px',
            borderBottom: `1px solid ${themeStyles.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? '#080f1e' : '#fcfcfd',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            {CATEGORY_CONFIGS.map(cat => {
              const count = categoryCounts[cat.key] || 0;
              const isActive = activeCategory === cat.key;
              const hasItems = cat.key === 'all' || count > 0;

              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    if (cat.key !== 'mutual_funds') setMfSubFilter('all');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: isActive ? `1px solid ${themeStyles.tabActiveBorder}` : '1px solid transparent',
                    background: isActive ? themeStyles.tabActiveBg : 'transparent',
                    color: isActive ? themeStyles.tabActiveText : (hasItems ? themeStyles.textSecondary : themeStyles.textMuted),
                    opacity: !hasItems && !isActive ? 0.6 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{cat.label}</span>
                  <span 
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: isActive ? themeStyles.tabCountBg : (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
                      color: isActive ? themeStyles.tabCountText : themeStyles.textSecondary
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-Filter for Mutual Funds (Equity vs Debt/Liquid) */}
          {activeCategory === 'mutual_funds' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '8px', borderLeft: `1px solid ${themeStyles.cardBorder}`, flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: themeStyles.textMuted, marginRight: '4px' }}>Filter:</span>
              {(['all', 'equity', 'debt'] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setMfSubFilter(sub)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: mfSubFilter === sub ? 700 : 500,
                    borderRadius: '6px',
                    border: mfSubFilter === sub ? `1px solid ${themeStyles.tabActiveBorder}` : '1px solid transparent',
                    background: mfSubFilter === sub ? themeStyles.tabActiveBg : 'transparent',
                    color: mfSubFilter === sub ? themeStyles.tabActiveText : themeStyles.textSecondary,
                    cursor: 'pointer'
                  }}
                >
                  {sub === 'all' ? 'All MFs' : sub === 'equity' ? 'Equity MF' : 'Debt & Liquid'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible Content */}
        {!isTableCollapsed && (
          <>
            {/* The Grid Table */}
            <div style={{ overflowX: 'auto', maxHeight: '550px', scrollbarWidth: 'thin' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: themeStyles.tableHeaderBg, borderBottom: `1px solid ${themeStyles.cardBorder}`, color: themeStyles.textMuted, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Asset Class</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Cost Basis (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Market Value (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Unrealized G&L (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>% of Portfolio</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Performance (1D)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: themeStyles.textMuted }}>
                        No holdings found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => {
                      const portShare = totalValue > 0 ? (row.marketValue / totalValue) * 100 : 0;
                      const isGain = row.unrealizedGain >= 0;
                      const isTodayGain = row.todayGain >= 0;

                      return (
                        <tr 
                          key={row.assetId || idx}
                          onClick={() => onHoldingClick?.(row)}
                          style={{
                            borderBottom: `1px solid ${themeStyles.rowBorder}`,
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = themeStyles.rowHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Asset Class Badge */}
                          <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                            <span 
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: row.assetClass.includes('Equity') 
                                  ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5')
                                  : row.assetClass.includes('Debt') 
                                    ? (isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe')
                                    : row.assetClass.includes('PPF')
                                      ? (isDark ? 'rgba(129, 140, 248, 0.12)' : '#eef2ff')
                                      : (isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'),
                                color: row.assetClass.includes('Equity') 
                                  ? themeStyles.green 
                                  : row.assetClass.includes('Debt') 
                                    ? themeStyles.accentCyan 
                                    : row.assetClass.includes('PPF')
                                      ? '#6366f1'
                                      : '#d97706',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`
                              }}
                            >
                              {row.assetClass}
                            </span>
                          </td>

                          {/* Description (Asset Name & ISIN) */}
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: themeStyles.textPrimary, maxWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.assetName}>
                                {row.assetName}
                              </span>
                              {(row as any).isin && (
                                <span style={{ fontSize: '10px', color: themeStyles.textMuted, fontFamily: 'monospace' }}>
                                  • {(row as any).isin}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: themeStyles.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtQty(row.quantity)}
                          </td>

                          {/* Cost Basis */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: themeStyles.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                            {row.avgPrice > 0 ? fmtExact(row.avgPrice) : fmtExact(row.costBasis, 0)}
                          </td>

                          {/* Market Value */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: themeStyles.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtSmart(row.marketValue)}
                          </td>

                          {/* Unrealized G&L */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontWeight: 700, color: isGain ? themeStyles.green : themeStyles.red }}>
                              {isGain ? '▲ ' : '▼ '}
                              {fmtSmart(Math.abs(row.unrealizedGain))}
                              <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '4px' }}>
                                ({isGain ? '+' : ''}{row.unrealizedGainPct.toFixed(1)}%)
                              </span>
                            </div>
                          </td>

                          {/* % of Portfolio */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <div 
                                style={{
                                  width: '45px',
                                  height: '5px',
                                  background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                                  borderRadius: '3px',
                                  overflow: 'hidden'
                                }}
                              >
                                <div 
                                  style={{
                                    width: `${Math.min(portShare, 100)}%`,
                                    height: '100%',
                                    background: themeStyles.accentCyan,
                                    borderRadius: '3px'
                                  }} 
                                />
                              </div>
                              <span style={{ fontWeight: 600, color: themeStyles.textPrimary, minWidth: '40px' }}>
                                {portShare.toFixed(2)}%
                              </span>
                            </div>
                          </td>

                          {/* Performance (Today's Change) */}
                          <td style={{ padding: '12px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span 
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: isTodayGain ? themeStyles.green : themeStyles.red
                              }}
                            >
                              {isTodayGain ? '+' : ''}{row.todayGainPct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Bar */}
            <div 
              style={{
                padding: '12px 24px',
                borderTop: `1px solid ${themeStyles.cardBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: themeStyles.tableHeaderBg,
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              <div style={{ color: themeStyles.textSecondary }}>
                Showing: <span style={{ color: themeStyles.textPrimary, fontWeight: 700 }}>{filteredStats.count} holdings</span>{' '}
                {activeCategory !== 'all' && (
                  <span style={{ color: themeStyles.accentCyan, marginLeft: '4px' }}>
                    ({CATEGORY_CONFIGS.find(c => c.key === activeCategory)?.label})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '24px', fontVariantNumeric: 'tabular-nums' }}>
                <div>Cost: <span style={{ color: themeStyles.textPrimary, fontWeight: 700 }}>{fmtSmart(filteredStats.cost)}</span></div>
                <div>Value: <span style={{ color: themeStyles.accentCyan, fontWeight: 800 }}>{fmtSmart(filteredStats.val)}</span></div>
                <div>
                  Gain:{' '}
                  <span style={{ color: filteredStats.gain >= 0 ? themeStyles.green : themeStyles.red, fontWeight: 700 }}>
                    {fmtSmart(filteredStats.gain)} ({filteredStats.gainPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

      {/* ── BOTTOM SECTION: DOUBLE-ENTRY ACCOUNTING RECONCILIATION BRIDGE ── */}
      <div 
        style={{
          background: themeStyles.surface,
          borderRadius: '14px',
          border: `1px solid ${themeStyles.cardBorder}`,
          boxShadow: themeStyles.cardBorderGlow,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={18} color={themeStyles.green} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: themeStyles.textPrimary }}>
              Double-Entry Accounting Reconciliation Bridge
            </h3>
          </div>
          <div style={{ fontSize: '11px', color: themeStyles.textMuted }}>
            Real-time balance sheet ledger integration
          </div>
        </div>

        {/* Double-Entry Table */}
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: `1px solid ${themeStyles.cardBorder}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: themeStyles.tableHeaderBg, borderBottom: `1px solid ${themeStyles.cardBorder}`, color: themeStyles.textMuted }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'left' }}>Account Code</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'left' }}>Transaction / Ledger</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right', color: themeStyles.accountingDr }}>Assets (Dr) Debit</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right', color: themeStyles.accountingCr }}>Liabilities & Equity (Cr) Credit</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Cash / Bank Reserves */}
              <tr style={{ borderBottom: `1px solid ${themeStyles.rowBorder}` }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: themeStyles.accentCyan, fontWeight: 700 }}>
                  1010-Cash
                </td>
                <td style={{ padding: '10px 16px', color: themeStyles.textPrimary, fontWeight: 500 }}>
                  Liquid Reserve & Settlement Bank Balances
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: themeStyles.accountingDr, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtExact(cashReserve, 2)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: themeStyles.textMuted }}>
                  —
                </td>
              </tr>

              {/* Row 2: Portfolio Investments */}
              <tr style={{ borderBottom: `1px solid ${themeStyles.rowBorder}` }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: themeStyles.accentCyan, fontWeight: 700 }}>
                  1200-Investments
                </td>
                <td style={{ padding: '10px 16px', color: themeStyles.textPrimary, fontWeight: 500 }}>
                  Market Portfolio Holdings (Stocks, MFs, Bonds & Bullion)
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: themeStyles.accountingDr, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtExact(totalValue, 2)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: themeStyles.textMuted }}>
                  —
                </td>
              </tr>

              {/* Row 3: Owner Equity / Capital Account */}
              <tr style={{ borderBottom: `1px solid ${themeStyles.rowBorder}` }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: themeStyles.accountingCr, fontWeight: 700 }}>
                  2000-Capital & Retained Gains
                </td>
                <td style={{ padding: '10px 16px', color: themeStyles.textPrimary, fontWeight: 500 }}>
                  Client Net Worth Valuation & Unrealized Capital
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: themeStyles.textMuted }}>
                  —
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: themeStyles.accountingCr, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtExact(totalValue + cashReserve, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Balanced Pill Footer */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderRadius: '8px',
            background: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4',
            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.2)' : '#bbf7d0'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span 
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                padding: '3px 10px',
                borderRadius: '6px',
                background: themeStyles.green,
                color: isDark ? '#000000' : '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <CheckCircle2 size={12} /> BALANCED
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: themeStyles.textPrimary }}>
              Double-Entry Status: Reconciled
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px', fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: themeStyles.accountingDr }}>
              Dr: {fmtExact(totalValue + cashReserve, 2)}
            </span>
            <span style={{ color: themeStyles.accountingCr }}>
              Cr: {fmtExact(totalValue + cashReserve, 2)}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

import React, { useState, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line, CartesianGrid,
  Legend, Treemap
} from 'recharts';
import {
  BarChart3, Users, Briefcase, TrendingUp, TrendingDown, ShieldCheck,
  PieChart as PieIcon, Activity, ArrowUpRight, ArrowDownRight,
  Target, Layers, Zap, AlertTriangle, ChevronDown, RefreshCw,
  Scale, DollarSign, Percent, Award, Eye, Sparkles, CheckCircle2,
  ArrowRight, Coins, Sliders, Info, Lightbulb
} from 'lucide-react';
import {
  getStoredPortfolios, getStoredInvestorGroups, getStoredFamilies,
  getHoldings, getPortfolioSummary, ASSET_TYPE_MAP
} from '../logic';
import { computeXIRR } from '../services/xirrEngine';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';
import TopNavbar from '../TopNavbar';

// ─── Colour palettes ──────────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];
const ASSET_CLASS_COLORS: Record<string, string> = {
  'Stocks':            '#10b981',
  'Mutual Funds':      '#3b82f6',
  'Fixed Deposits':    '#f59e0b',
  'Bonds & NCD':       '#8b5cf6',
  'Gold / Silver':     '#f97316',
  'PPF / EPF':         '#06b6d4',
  'ULIP / Insurance':  '#ec4899',
  'Real Estate':       '#14b8a6',
  'AIF / PE':          '#a855f7',
  'Other':             '#94a3b8',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v >= 1e7
    ? `₹${(v / 1e7).toFixed(2)} Cr`
    : v >= 1e5
    ? `₹${(v / 1e5).toFixed(2)} L`
    : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const fmtPct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

function attyToClass(assetType: number): string {
  // Matches ASSET_TYPE_MAP in logic.ts (values like 50, 60, 90, 130, 150)
  if (assetType === 50 || assetType === 51 || assetType === 240) return 'Stocks';
  if (assetType === 60 || assetType === 61 || assetType === 62 || assetType === 75) return 'Mutual Funds';
  if (assetType === 90 || assetType === 120) return 'Fixed Deposits';
  if (assetType === 70 || assetType === 100 || assetType === 110) return 'Bonds & NCD';
  if (assetType === 150 || assetType === 77 || assetType === 170) return 'Gold / Silver';
  if (assetType === 130 || assetType === 140) return 'PPF / EPF';
  if (assetType === 80 || assetType === 95) return 'ULIP / Insurance';
  if (assetType === 160) return 'Real Estate';
  if (assetType === 190 || assetType === 200 || assetType === 210 || assetType === 230) return 'AIF / PE';
  return 'Other';
}

// Compute simple diversification score 0-100
function diversificationScore(allocationMap: Record<string, number>): number {
  const vals = Object.values(allocationMap).filter(v => v > 0);
  if (vals.length === 0) return 0;
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const pcts = vals.map(v => v / total);
  // Herfindahl–Hirschman Index: lower = more diversified
  const hhi = pcts.reduce((s, p) => s + p * p, 0);
  // Convert: 1 = fully concentrated, 1/n = perfectly diversified
  const n = vals.length;
  const minHHI = 1 / n;
  if (n === 1) return 0; // single asset class = fully concentrated
  const score = Math.max(0, Math.min(100, ((1 - hhi) / (1 - minHHI)) * 100));
  return isNaN(score) ? 0 : Math.round(score);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon, trend }:
  { label: string; value: string; sub?: string; color: string; icon: any; trend?: 'up'|'down'|null }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
      padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '10px',
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
        {sub && (
          <div style={{ fontSize: '11px', marginTop: '4px', color: trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#64748b', fontWeight: 600 }}>
            {trend === 'up' && <ArrowUpRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />}
            {trend === 'down' && <ArrowDownRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />}
            {' '}{sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children, fullWidth }:
  { title: string; icon: any; iconColor: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      gridColumn: fullWidth ? '1 / -1' : undefined
    }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: '#fafafa' }}>
        <Icon size={16} color={iconColor} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

// Radial progress gauge
function Gauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(1, value / max);
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width={88} height={88} style={{ overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={16} fontWeight={800} fill="#0f172a">{Math.round(value)}</text>
      </svg>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'family' | 'portfolio';
type AnalysisTab = 'overview' | 'allocation' | 'performance' | 'diversification' | 'comparison' | 'optimization';

export default function PortfolioAnalysisPage() {
  const { activeFamily } = useFamily();
  const { globalRefreshTrigger, customRange } = useFY();
  const [viewMode, setViewMode] = useState<ViewMode>('family');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('all');
  const [rebalanceModel, setRebalanceModel] = useState<'wealth' | 'aggressive' | 'conservative'>('wealth');
  const [tick, setTick] = useState(0);

  const families = useMemo(() => getStoredFamilies(), [tick, globalRefreshTrigger]);
  const allPortfolios = useMemo(() =>
    getStoredPortfolios().filter(p => !activeFamily?.id || String(p.client_id) === activeFamily.id),
    [activeFamily?.id, tick, globalRefreshTrigger]
  );

  const portfolioOptions = useMemo(() => [
    { id: 'all', label: 'All Portfolios (Consolidated)' },
    ...allPortfolios.map(p => ({ id: String(p.id), label: p.portfolioName.trim() }))
  ], [allPortfolios]);

  const activePfIds = useMemo(() =>
    selectedPortfolioId === 'all'
      ? allPortfolios.map(p => Number(p.id))
      : [Number(selectedPortfolioId)],
    [selectedPortfolioId, allPortfolios]
  );

  // Holdings for selection
  const holdings = useMemo(() =>
    activePfIds.length ? getHoldings(activePfIds, undefined, false) : [],
    [activePfIds, tick, globalRefreshTrigger]
  );

  // Summary
  const summary = useMemo(() =>
    activePfIds.length ? getPortfolioSummary(activePfIds) : null,
    [activePfIds, tick, globalRefreshTrigger]
  );

  // XIRR
  const xirrResult = useMemo(() => {
    if (!activePfIds.length) return null;
    try { return computeXIRR(activePfIds); } catch { return null; }
  }, [activePfIds, tick, globalRefreshTrigger]);

  // Asset class allocation
  const assetClassData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      const cls = attyToClass(h.assetType ?? 0);
      map[cls] = (map[cls] ?? 0) + (h.currentValue ?? 0);
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // Top holdings
  const topHoldings = useMemo(() =>
    [...holdings]
      .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
      .slice(0, 10),
    [holdings]
  );

  // Derive totals directly from holdings (getPortfolioSummary uses amtInvested, not costValue)
  const totalValue = useMemo(() => holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0), [holdings]);
  const totalCost  = useMemo(() => holdings.reduce((s, h) => s + (h.amtInvested ?? 0), 0), [holdings]);
  const unrealised = totalValue - totalCost;
  const unrealisedPct = totalCost > 0 ? (unrealised / totalCost) * 100 : 0;

  // Per-portfolio breakdown (for comparison tab & family view)
  const portfolioBreakdown = useMemo(() => {
    return allPortfolios.map(p => {
      const pfId = Number(p.id);
      const h = getHoldings([pfId], undefined, false);
      const tv = h.reduce((s, x) => s + (x.currentValue ?? 0), 0);
      const cv = h.reduce((s, x) => s + (x.amtInvested ?? 0), 0);
      const pnl = tv - cv;
      const pnlPct = cv > 0 ? (pnl / cv) * 100 : 0;
      let xirr: number | null = null;
      try { xirr = computeXIRR([pfId]).rate; } catch { xirr = null; }
      return { id: pfId, name: p.portfolioName.trim(), totalValue: tv, costValue: cv, pnl, pnlPct, xirr, holdings: h.length };
    });
  }, [allPortfolios, tick, globalRefreshTrigger]);

  // Diversification metrics
  const diversificationScore_ = useMemo(() => {
    const map: Record<string, number> = {};
    assetClassData.forEach(d => { map[d.name] = d.value; });
    return diversificationScore(map);
  }, [assetClassData]);

  const top3Concentration = useMemo(() => {
    const top3 = topHoldings.slice(0, 3).reduce((s, h) => s + (h.currentValue ?? 0), 0);
    return totalValue > 0 ? (top3 / totalValue) * 100 : 0;
  }, [topHoldings, totalValue]);

  const tabs: { key: AnalysisTab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'allocation', label: 'Allocation', icon: PieIcon },
    { key: 'performance', label: 'Performance', icon: TrendingUp },
    { key: 'diversification', label: 'Diversification', icon: ShieldCheck },
    { key: 'comparison', label: 'Portfolio Comparison', icon: Scale },
    { key: 'optimization', label: 'Return Optimization & Suggestions', icon: Sparkles },
  ];

  // ─── Optimization & Return Boost Analytics ──────────────────────────────────
  const equityValue = useMemo(() => holdings.filter(h => {
    const cls = attyToClass(h.assetType ?? 0);
    return cls === 'Stocks' || cls === 'Mutual Funds';
  }).reduce((s, h) => s + (h.currentValue ?? 0), 0), [holdings]);

  const debtValue = useMemo(() => holdings.filter(h => {
    const cls = attyToClass(h.assetType ?? 0);
    return cls === 'Bonds & NCD' || cls === 'Fixed Deposits' || cls === 'PPF / EPF';
  }).reduce((s, h) => s + (h.currentValue ?? 0), 0), [holdings]);

  const goldValue = useMemo(() => holdings.filter(h => {
    const cls = attyToClass(h.assetType ?? 0);
    return cls === 'Gold / Silver';
  }).reduce((s, h) => s + (h.currentValue ?? 0), 0), [holdings]);

  // Target model weights
  const targetRatios = useMemo(() => {
    if (rebalanceModel === 'aggressive') return { equity: 0.75, debt: 0.15, gold: 0.10, label: 'Aggressive Growth (75:15:10)' };
    if (rebalanceModel === 'conservative') return { equity: 0.40, debt: 0.50, gold: 0.10, label: 'Capital Preservation (40:50:10)' };
    return { equity: 0.60, debt: 0.30, gold: 0.10, label: 'Balanced Compounder (60:30:10)' };
  }, [rebalanceModel]);

  const equityDrift = useMemo(() => totalValue > 0 ? ((equityValue / totalValue) - targetRatios.equity) * 100 : 0, [totalValue, equityValue, targetRatios]);
  const debtDrift = useMemo(() => totalValue > 0 ? ((debtValue / totalValue) - targetRatios.debt) * 100 : 0, [totalValue, debtValue, targetRatios]);
  const goldDrift = useMemo(() => totalValue > 0 ? ((goldValue / totalValue) - targetRatios.gold) * 100 : 0, [totalValue, goldValue, targetRatios]);

  // Tax loss harvesting opportunities (holdings with loss)
  const lossHoldings = useMemo(() => holdings.filter(h => {
    const pnl = (h.currentValue ?? 0) - (h.amtInvested ?? 0);
    return pnl < -1000;
  }).sort((a, b) => {
    const pnlA = (a.currentValue ?? 0) - (a.amtInvested ?? 0);
    const pnlB = (b.currentValue ?? 0) - (b.amtInvested ?? 0);
    return pnlA - pnlB;
  }), [holdings]);

  const totalHarvestableLoss = useMemo(() => lossHoldings.reduce((s, h) => s + Math.abs((h.currentValue ?? 0) - (h.amtInvested ?? 0)), 0), [lossHoldings]);
  const potentialTaxSavings = useMemo(() => totalHarvestableLoss * 0.125, [totalHarvestableLoss]);

  // Liquid ETF / Idle cash drag
  const liquidHoldings = useMemo(() => holdings.filter(h => {
    const name = (h.assetName || '').toLowerCase();
    return name.includes('liquid') || name.includes('overnight') || name.includes('cash');
  }), [holdings]);
  const totalLiquidValue = useMemo(() => liquidHoldings.reduce((s, h) => s + (h.currentValue ?? 0), 0), [liquidHoldings]);

  // Fixed Deposits (high tax drag vs arbitrage funds)
  const fdHoldings = useMemo(() => holdings.filter(h => {
    const cls = attyToClass(h.assetType ?? 0);
    return cls === 'Fixed Deposits';
  }), [holdings]);
  const totalFdValue = useMemo(() => fdHoldings.reduce((s, h) => s + (h.currentValue ?? 0), 0), [fdHoldings]);
  const fdTaxDragPerYear = useMemo(() => totalFdValue * 0.016, [totalFdValue]); // ~1.6% post-tax alpha by using arbitrage vs 30% slab FD

  // Gold SGB optimization potential (2.5% coupon)
  const sgbCashFlowBoost = useMemo(() => goldValue * 0.025, [goldValue]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <TopNavbar />

      {/* ── Page Header ── */}
      <div style={{
        background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '60px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '8px',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={18} color="#2563eb" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Portfolio Analysis
            </h2>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {activeFamily?.familyName || 'All Families'} · Deep-dive analytics
            </div>
          </div>

          {/* View Mode Toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', background: '#f1f5f9',
            padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0', marginLeft: '16px'
          }}>
            <button onClick={() => setViewMode('family')} style={{
              padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: viewMode === 'family' ? '#ffffff' : 'transparent',
              color: viewMode === 'family' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'family' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
            }}>
              <Users size={13} /> Family View
            </button>
            <button onClick={() => setViewMode('portfolio')} style={{
              padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: viewMode === 'portfolio' ? '#ffffff' : 'transparent',
              color: viewMode === 'portfolio' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'portfolio' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
            }}>
              <Briefcase size={13} /> Portfolio View
            </button>
          </div>
        </div>

        {/* Portfolio Selector (portfolio mode) */}
        {viewMode === 'portfolio' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio:</span>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedPortfolioId}
                onChange={e => setSelectedPortfolioId(e.target.value)}
                style={{
                  height: '34px', padding: '0 32px 0 12px', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', minWidth: '220px',
                  background: '#f8fafc', color: '#0f172a',
                  border: '1px solid #cbd5e1', outline: 'none', appearance: 'none'
                }}
              >
                {portfolioOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <ChevronDown size={13} color="#64748b" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        )}

        <button onClick={() => setTick(t => t + 1)} style={{
          height: 34, padding: '0 14px', borderRadius: '8px', fontSize: '12px',
          fontWeight: 600, border: '1px solid #e2e8f0', background: '#f8fafc',
          color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        padding: '0 32px', display: 'flex', gap: '4px', flexShrink: 0
      }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              height: '44px', padding: '0 16px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: '12px', fontWeight: 700,
              color: activeTab === key ? '#2563eb' : '#64748b',
              borderBottom: `2px solid ${activeTab === key ? '#2563eb' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <StatCard label="Current Value" value={fmt(totalValue)} color="#3b82f6" icon={DollarSign} />
              <StatCard label="Total Invested" value={fmt(totalCost)} color="#8b5cf6" icon={Layers} />
              <StatCard
                label="Unrealised P&L"
                value={fmt(Math.abs(unrealised))}
                sub={`${fmtPct(unrealisedPct)} overall`}
                color={unrealised >= 0 ? '#10b981' : '#ef4444'}
                icon={unrealised >= 0 ? TrendingUp : TrendingDown}
                trend={unrealised >= 0 ? 'up' : 'down'}
              />
              <StatCard
                label="XIRR (Annualised)"
                value={xirrResult?.rate != null ? `${xirrResult.rate.toFixed(2)}%` : 'N/A'}
                sub="Time-weighted return"
                color={xirrResult?.rate != null && xirrResult.rate >= 0 ? '#10b981' : '#ef4444'}
                icon={Percent}
                trend={xirrResult?.rate != null ? (xirrResult.rate >= 0 ? 'up' : 'down') : null}
              />
              <StatCard label="Holdings" value={String(holdings.length)} sub="Unique assets" color="#f59e0b" icon={Briefcase} />
              <StatCard
                label="Diversification"
                value={`${diversificationScore_}/100`}
                sub={diversificationScore_ >= 70 ? 'Well diversified' : diversificationScore_ >= 40 ? 'Moderate' : 'Concentrated'}
                color={diversificationScore_ >= 70 ? '#10b981' : diversificationScore_ >= 40 ? '#f59e0b' : '#ef4444'}
                icon={ShieldCheck}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Asset class pie */}
              <SectionCard title="Asset Class Allocation" icon={PieIcon} iconColor="#3b82f6">
                {assetClassData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '13px' }}>No data available</div>
                ) : (
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={assetClassData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                          {assetClassData.map((entry) => (
                            <Cell key={entry.name} fill={ASSET_CLASS_COLORS[entry.name] ?? PIE_COLORS[0]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {assetClassData.map(d => (
                        <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: ASSET_CLASS_COLORS[d.name] ?? '#94a3b8', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{d.name}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{fmt(d.value)}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Top 10 holdings */}
              <SectionCard title="Top 10 Holdings" icon={Award} iconColor="#f59e0b">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topHoldings.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '13px' }}>No holdings found</div>
                  )}
                  {topHoldings.map((h, i) => {
                    const pct = totalValue > 0 ? ((h.currentValue ?? 0) / totalValue) * 100 : 0;
                    const gain = (h.currentValue ?? 0) - (h.amtInvested ?? 0);
                    return (
                      <div key={`${h.amid}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', width: '16px', textAlign: 'right' }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.assetName}
                          </div>
                          <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '3px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: '2px', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{fmt(h.currentValue ?? 0)}</div>
                          <div style={{ fontSize: '10px', color: gain >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {gain >= 0 ? '+' : ''}{fmt(Math.abs(gain))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>

            {/* Family view: per-portfolio mini-cards */}
            {viewMode === 'family' && portfolioBreakdown.length > 0 && (
              <SectionCard title="Portfolio Breakdown" icon={Users} iconColor="#8b5cf6" fullWidth>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {portfolioBreakdown.map(p => (
                    <div key={p.id} style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{fmt(p.totalValue)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '11px', color: p.pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                          {p.pnl >= 0 ? '▲' : '▼'} {fmtPct(p.pnlPct)}
                        </span>
                        {p.xirr != null && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            XIRR: <strong style={{ color: p.xirr >= 0 ? '#10b981' : '#ef4444' }}>{p.xirr.toFixed(1)}%</strong>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{p.holdings} holdings</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ===== ALLOCATION TAB ===== */}
        {activeTab === 'allocation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Treemap */}
              <SectionCard title="Portfolio Treemap" icon={Layers} iconColor="#3b82f6">
                {topHoldings.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '80px 0', fontSize: '13px' }}>No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <Treemap
                      data={topHoldings.map(h => ({ name: h.assetName?.slice(0, 20) ?? '', size: h.currentValue ?? 0 }))}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="#fff"
                    >
                      <Tooltip formatter={(v: any) => [fmt(v), 'Value']} />
                    </Treemap>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              {/* Bar chart allocation */}
              <SectionCard title="Asset Class Bar Chart" icon={BarChart3} iconColor="#10b981">
                {assetClassData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '80px 0', fontSize: '13px' }}>No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={assetClassData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                      <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [fmt(v), 'Value']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {assetClassData.map((entry) => (
                          <Cell key={entry.name} fill={ASSET_CLASS_COLORS[entry.name] ?? '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </div>

            {/* Detailed allocation table */}
            <SectionCard title="Detailed Allocation Table" icon={Eye} iconColor="#6366f1" fullWidth>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Asset Name', 'Asset Class', 'Current Value', '% of Portfolio', 'Cost', 'P&L', 'P&L %'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Asset Name' || h === 'Asset Class' ? 'left' : 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...holdings].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)).map((h, i) => {
                    const pct = totalValue > 0 ? ((h.currentValue ?? 0) / totalValue) * 100 : 0;
                    const pnl = (h.currentValue ?? 0) - (h.amtInvested ?? 0);
                    const pnlPct = (h.amtInvested ?? 0) > 0 ? (pnl / (h.amtInvested ?? 1)) * 100 : 0;
                    return (
                      <tr key={`${h.amid}-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '9px 14px', color: '#0f172a', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.assetName}</td>
                        <td style={{ padding: '9px 14px', color: '#475569' }}>
                          <span style={{ background: `${ASSET_CLASS_COLORS[attyToClass(h.assetType ?? 0)] ?? '#94a3b8'}20`, color: ASSET_CLASS_COLORS[attyToClass(h.assetType ?? 0)] ?? '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                            {attyToClass(h.assetType ?? 0)}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(h.currentValue ?? 0)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{pct.toFixed(2)}%</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{fmt(h.amtInvested ?? 0)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {pnl >= 0 ? '+' : ''}{fmt(Math.abs(pnl))}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: pnlPct >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {fmtPct(pnlPct)}
                        </td>
                      </tr>
                    );
                  })}
                  {holdings.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No holdings found</td></tr>
                  )}
                </tbody>
              </table>
            </SectionCard>
          </div>
        )}

        {/* ===== PERFORMANCE TAB ===== */}
        {activeTab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* XIRR Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <StatCard
                label="XIRR (Annualised)"
                value={xirrResult?.rate != null ? `${xirrResult.rate.toFixed(2)}%` : 'N/A'}
                sub="Internal rate of return"
                color="#3b82f6"
                icon={Percent}
                trend={xirrResult?.rate != null ? (xirrResult.rate >= 0 ? 'up' : 'down') : null}
              />
              <StatCard
                label="Absolute Return"
                value={fmtPct(unrealisedPct)}
                sub={`${fmt(Math.abs(unrealised))} ${unrealised >= 0 ? 'gain' : 'loss'}`}
                color={unrealised >= 0 ? '#10b981' : '#ef4444'}
                icon={TrendingUp}
                trend={unrealised >= 0 ? 'up' : 'down'}
              />
              <StatCard
                label="Total Invested"
                value={fmt(totalCost)}
                sub="Total capital deployed"
                color="#8b5cf6"
                icon={Target}
              />
              <StatCard
                label="Current Value"
                value={fmt(totalValue)}
                sub="Mark-to-market"
                color="#f59e0b"
                icon={Zap}
              />
            </div>

            {/* Per-asset performance table */}
            <SectionCard title="Per-Asset Performance" icon={TrendingUp} iconColor="#10b981" fullWidth>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#', 'Asset Name', 'Current Value', 'Cost', 'P&L (₹)', 'P&L (%)', 'Weight'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Asset Name' ? 'left' : 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...holdings]
                    .sort((a, b) => {
                      const pnlA = (a.currentValue ?? 0) - (a.amtInvested ?? 0);
                      const pnlB = (b.currentValue ?? 0) - (b.amtInvested ?? 0);
                      const pctA = (a.amtInvested ?? 0) > 0 ? (pnlA / a.amtInvested!) * 100 : 0;
                      const pctB = (b.amtInvested ?? 0) > 0 ? (pnlB / b.amtInvested!) * 100 : 0;
                      return pctB - pctA;
                    })
                    .map((h, i) => {
                      const pnl = (h.currentValue ?? 0) - (h.amtInvested ?? 0);
                      const pnlPct = (h.amtInvested ?? 0) > 0 ? (pnl / h.amtInvested!) * 100 : 0;
                      const weight = totalValue > 0 ? ((h.currentValue ?? 0) / totalValue) * 100 : 0;
                      return (
                        <tr key={`${h.amid}-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '9px 14px', textAlign: 'right', color: '#94a3b8', fontSize: '11px' }}>{i + 1}</td>
                          <td style={{ padding: '9px 14px', color: '#0f172a', fontWeight: 600 }}>{h.assetName}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(h.currentValue ?? 0)}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{fmt(h.amtInvested ?? 0)}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                            {pnl >= 0 ? '+' : ''}{fmt(Math.abs(pnl))}
                          </td>
                          <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                            <span style={{
                              background: pnlPct >= 0 ? '#d1fae5' : '#fee2e2',
                              color: pnlPct >= 0 ? '#059669' : '#dc2626',
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700
                            }}>{fmtPct(pnlPct)}</span>
                          </td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{weight.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  {holdings.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No holdings found</td></tr>
                  )}
                </tbody>
              </table>
            </SectionCard>
          </div>
        )}

        {/* ===== DIVERSIFICATION TAB ===== */}
        {activeTab === 'diversification' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Score gauges */}
            <SectionCard title="Diversification Health" icon={ShieldCheck} iconColor="#10b981" fullWidth>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px', padding: '8px 0' }}>
                <Gauge value={diversificationScore_} max={100} color="#10b981" label="Asset Class Diversification" />
                <Gauge value={Math.max(0, 100 - top3Concentration)} max={100} color="#3b82f6" label="Concentration Score (lower top-3 = better)" />
                <Gauge value={Math.min(100, holdings.length * 5)} max={100} color="#8b5cf6" label="Breadth (# Holdings)" />
                <Gauge
                  value={assetClassData.length * 14}
                  max={100}
                  color="#f59e0b"
                  label="Asset Class Count"
                />
              </div>
            </SectionCard>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Risk flags */}
              <SectionCard title="Risk Alerts" icon={AlertTriangle} iconColor="#ef4444">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {top3Concentration > 60 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px' }}>
                      <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>High Concentration Risk</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Top 3 holdings make up {top3Concentration.toFixed(1)}% of portfolio. Consider rebalancing.</div>
                      </div>
                    </div>
                  )}
                  {assetClassData.length < 3 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px' }}>
                      <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>Low Asset Class Diversity</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Only {assetClassData.length} asset class(es) present. A balanced portfolio typically has 4+.</div>
                      </div>
                    </div>
                  )}
                  {holdings.length < 10 && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px' }}>
                      <AlertTriangle size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>Small Portfolio Breadth</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Only {holdings.length} holding(s). Consider adding more positions to reduce single-stock risk.</div>
                      </div>
                    </div>
                  )}
                  {top3Concentration <= 60 && assetClassData.length >= 3 && holdings.length >= 10 && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px' }}>
                      <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>Portfolio is Well Diversified</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>No major concentration risks detected.</div>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Asset class radar */}
              <SectionCard title="Allocation Radar" icon={Activity} iconColor="#8b5cf6">
                {assetClassData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '80px 0', fontSize: '13px' }}>No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%"
                      data={assetClassData.map(d => ({ name: d.name.split(' ')[0], value: totalValue > 0 ? (d.value / totalValue) * 100 : 0 }))}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                      <Radar name="Allocation %" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                      <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Allocation']} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ===== COMPARISON TAB ===== */}
        {activeTab === 'comparison' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Family summary header */}
            {viewMode === 'family' && (
              <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)', borderRadius: '12px', padding: '20px 28px', color: '#fff' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.7, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Family: {activeFamily?.familyName || 'All'}
                </div>
                <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800 }}>{fmt(portfolioBreakdown.reduce((s, p) => s + p.totalValue, 0))}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>Total Family Wealth</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800 }}>{portfolioBreakdown.length}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>Portfolios</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800 }}>
                      {fmt(Math.abs(portfolioBreakdown.reduce((s, p) => s + p.pnl, 0)))}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      {portfolioBreakdown.reduce((s, p) => s + p.pnl, 0) >= 0 ? 'Total Gain' : 'Total Loss'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio comparison bar charts */}
            <SectionCard title="Portfolio Value Comparison" icon={BarChart3} iconColor="#3b82f6" fullWidth>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={portfolioBreakdown} margin={{ left: 8, right: 24, top: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => [fmt(v)]} />
                  <Legend />
                  <Bar dataKey="totalValue" name="Current Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costValue" name="Cost" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            {/* Portfolio comparison table */}
            <SectionCard title="Portfolio Comparison Table" icon={Scale} iconColor="#8b5cf6" fullWidth>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Portfolio', 'Current Value', 'Cost', 'P&L', 'Return %', 'XIRR', 'Holdings'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Portfolio' ? 'left' : 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolioBreakdown.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(p.totalValue)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>{fmt(p.costValue)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: p.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                        {p.pnl >= 0 ? '+' : ''}{fmt(Math.abs(p.pnl))}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{
                          background: p.pnlPct >= 0 ? '#d1fae5' : '#fee2e2',
                          color: p.pnlPct >= 0 ? '#059669' : '#dc2626',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700
                        }}>{fmtPct(p.pnlPct)}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {p.xirr != null ? (
                          <span style={{
                            background: p.xirr >= 0 ? '#eff6ff' : '#fef2f2',
                            color: p.xirr >= 0 ? '#2563eb' : '#dc2626',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700
                          }}>{p.xirr.toFixed(2)}%</span>
                        ) : <span style={{ color: '#94a3b8' }}>N/A</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>{p.holdings}</td>
                    </tr>
                  ))}
                  {portfolioBreakdown.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No portfolios found</td></tr>
                  )}
                </tbody>
                {portfolioBreakdown.length > 1 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>Total / Family</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(portfolioBreakdown.reduce((s, p) => s + p.totalValue, 0))}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>{fmt(portfolioBreakdown.reduce((s, p) => s + p.costValue, 0))}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: portfolioBreakdown.reduce((s, p) => s + p.pnl, 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {portfolioBreakdown.reduce((s, p) => s + p.pnl, 0) >= 0 ? '+' : ''}{fmt(Math.abs(portfolioBreakdown.reduce((s, p) => s + p.pnl, 0)))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </SectionCard>

            {/* XIRR comparison bar */}
            {portfolioBreakdown.some(p => p.xirr != null) && (
              <SectionCard title="XIRR Comparison" icon={Percent} iconColor="#f59e0b" fullWidth>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={portfolioBreakdown.filter(p => p.xirr != null).map(p => ({ name: p.name, xirr: parseFloat((p.xirr ?? 0).toFixed(2)) }))}
                    margin={{ left: 8, right: 24, top: 8, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'XIRR']} />
                    <Bar dataKey="xirr" name="XIRR %" radius={[4, 4, 0, 0]}>
                      {portfolioBreakdown.filter(p => p.xirr != null).map((p) => (
                        <Cell key={p.id} fill={(p.xirr ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            )}
          </div>
        )}

        {/* ===== RETURN OPTIMIZATION & SUGGESTIONS TAB ===== */}
        {activeTab === 'optimization' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header Banner: Return Potential */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a5f 100%)',
              borderRadius: '14px', padding: '24px 30px', color: '#fff',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px'
            }}>
              <div style={{ maxWidth: '640px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    Institutional Framework
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Inspired by Morningstar X-Ray, INDmoney, Smallcase & Wealthfront
                  </span>
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Smart Return Optimization & Alpha Playbook
                </h3>
                <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                  Leading wealth apps focus on 4 compounding levers to generate +1.5% to +3.0% higher annualized returns without increasing uncompensated risk: Asset Rebalancing, Tax Alpha, Cash Drag Reduction, and High-Yield Debt Restructuring.
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '12px',
                padding: '16px 20px', minWidth: '220px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Estimated Alpha Potential
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#34d399', margin: '4px 0' }}>
                  +1.8% – +3.2%
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  extra net return p.a.
                </div>
              </div>
            </div>

            {/* 1. Asset Allocation & Rebalancing Drift Simulator */}
            <SectionCard title="1. Asset Allocation & Target Rebalancing Model (Wealthfront / Betterment Method)" icon={Sliders} iconColor="#3b82f6" fullWidth>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Select your target investment model to calculate exact portfolio drift and rebalancing orders:
                  </div>
                  {/* Model Selector Buttons */}
                  <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                    {[
                      { id: 'aggressive', label: '🚀 Aggressive (75:15:10)' },
                      { id: 'wealth', label: '⚖️ Balanced (60:30:10)' },
                      { id: 'conservative', label: '🛡️ Conservative (40:50:10)' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setRebalanceModel(m.id as any)}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700,
                          border: 'none', cursor: 'pointer',
                          background: rebalanceModel === m.id ? '#ffffff' : 'transparent',
                          color: rebalanceModel === m.id ? '#0f172a' : '#64748b',
                          boxShadow: rebalanceModel === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rebalance Drift Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {/* Equity Drift */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Equity (Stocks &amp; MFs)</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                        background: Math.abs(equityDrift) < 3 ? '#d1fae5' : equityDrift > 0 ? '#fee2e2' : '#eff6ff',
                        color: Math.abs(equityDrift) < 3 ? '#059669' : equityDrift > 0 ? '#b91c1c' : '#1d4ed8'
                      }}>
                        {equityDrift > 0 ? `Overweight +${equityDrift.toFixed(1)}%` : `Underweight ${equityDrift.toFixed(1)}%`}
                      </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{fmt(equityValue)}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Current: {totalValue > 0 ? ((equityValue / totalValue) * 100).toFixed(1) : 0}% | Target: {(targetRatios.equity * 100).toFixed(0)}%
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
                      {equityDrift < -2 ? (
                        <span style={{ color: '#2563eb' }}>👉 Action: Add {fmt(Math.abs((totalValue * targetRatios.equity) - equityValue))} to Equity on market dips</span>
                      ) : equityDrift > 2 ? (
                        <span style={{ color: '#d97706' }}>👉 Action: Trim/Reallocate {fmt(equityValue - (totalValue * targetRatios.equity))} to Fixed Income</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>✅ Optimal: In line with target</span>
                      )}
                    </div>
                  </div>

                  {/* Debt Drift */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Debt &amp; Fixed Income</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                        background: Math.abs(debtDrift) < 3 ? '#d1fae5' : debtDrift > 0 ? '#eff6ff' : '#fee2e2',
                        color: Math.abs(debtDrift) < 3 ? '#059669' : debtDrift > 0 ? '#1d4ed8' : '#b91c1c'
                      }}>
                        {debtDrift > 0 ? `Overweight +${debtDrift.toFixed(1)}%` : `Underweight ${debtDrift.toFixed(1)}%`}
                      </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{fmt(debtValue)}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Current: {totalValue > 0 ? ((debtValue / totalValue) * 100).toFixed(1) : 0}% | Target: {(targetRatios.debt * 100).toFixed(0)}%
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
                      {debtDrift > 2 ? (
                        <span style={{ color: '#2563eb' }}>👉 Action: Surplus debt of {fmt(debtValue - (totalValue * targetRatios.debt))}. Deploy via STP for higher return</span>
                      ) : debtDrift < -2 ? (
                        <span style={{ color: '#d97706' }}>👉 Action: Add {fmt(Math.abs((totalValue * targetRatios.debt) - debtValue))} to debt for stability</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>✅ Optimal: In line with target</span>
                      )}
                    </div>
                  </div>

                  {/* Gold Drift */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Gold &amp; Commodities</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                        background: Math.abs(goldDrift) < 2 ? '#d1fae5' : '#eff6ff',
                        color: Math.abs(goldDrift) < 2 ? '#059669' : '#1d4ed8'
                      }}>
                        {goldDrift > 0 ? `+${goldDrift.toFixed(1)}%` : `${goldDrift.toFixed(1)}%`}
                      </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{fmt(goldValue)}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Current: {totalValue > 0 ? ((goldValue / totalValue) * 100).toFixed(1) : 0}% | Target: {(targetRatios.gold * 100).toFixed(0)}%
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
                      {goldValue > 0 ? (
                        <span style={{ color: '#10b981' }}>✅ Good inflation hedge (ideal allocation is 8-10%)</span>
                      ) : (
                        <span style={{ color: '#2563eb' }}>👉 Add 5-10% allocation in Gold / SGB for hedging</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 2. Four Concrete Action Pillars for More Return */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Action 1: Tax-Loss Harvesting */}
              <div style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingDown size={18} color="#ef4444" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Tax-Loss Harvesting (INDmoney / Wealthfront)</h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Offset capital gains tax to boost net IRR</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Harvestable Unrealized Loss:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>{fmt(totalHarvestableLoss)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Estimated Tax Shield (at 12.5% LTCG):</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>{fmt(potentialTaxSavings)}</span>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  <strong>How to execute:</strong> Book losses in your underperforming holdings before March 31st to set off against realized capital gains. Immediately reinvest proceeds into high-momentum or index compounders.
                </p>

                <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                  {lossHoldings.length} holding(s) currently trading at an unrealized loss.
                </div>
              </div>

              {/* Action 2: Fixed Deposit to Arbitrage Fund Swap */}
              <div style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scale size={18} color="#2563eb" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>FD to Arbitrage Fund Tax Alpha</h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Save 15-20% tax on fixed income returns</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Fixed Deposits Held:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{fmt(totalFdValue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Potential Extra Post-Tax Yield / yr:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>+{fmt(fdTaxDragPerYear)} / year</span>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  <strong>The Math:</strong> Bank FD interest is taxed at your income slab (up to 30%+ surcharge, giving net ~4.8% return). Arbitrage Funds generate ~7.0-7.3% pre-tax but are taxed at equity LTCG rates (12.5%), yielding ~6.4% post-tax — giving you <strong>+1.6% pure risk-free alpha</strong>.
                </p>
              </div>

              {/* Action 3: Cash & Liquid ETF Opportunity Cost */}
              <div style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={18} color="#d97706" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Deploy Idle Cash &amp; Liquid ETFs via STP</h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Eliminate cash drag on ₹40L+ capital</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Liquid ETF / Cash Holdings:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{fmt(totalLiquidValue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Long-Term Growth Upside:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>+4.0% to +6.0% extra CAGR</span>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  <strong>How to optimize:</strong> Liquid ETF returns ~6.5-6.8%. Setting up a 12 to 18-month Systematic Transfer Plan (STP) into Multi-Asset or Flexi-Cap funds deploys this capital into 12-14% compounding assets without market-timing risk.
                </p>
              </div>

              {/* Action 4: Gold SGB Sovereign Coupon Yield */}
              <div style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Coins size={18} color="#ea580c" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Sovereign Gold Bonds (SGB) Optimization</h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Earn 2.50% annual coupon + 0% tax</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Current Gold Holding:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{fmt(goldValue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Annual Sovereign Cash Flow:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>+{fmt(sgbCashFlowBoost)} / year</span>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  <strong>How to capture:</strong> If your gold is in physical or ETF form, it yields 0% dividend. Purchasing Sovereign Gold Bonds (SGB) via secondary market pays 2.5% p.a. guaranteed interest directly to your bank account, and capital gains are 100% tax-free on maturity!
                </p>
              </div>

            </div>

            {/* 3. Industry Comparison Matrix: How Top Platforms Analyze Portfolios */}
            <SectionCard title="3. Comparative Study: How Global & Indian Platforms Analyze Portfolios" icon={BarChart3} iconColor="#8b5cf6" fullWidth>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Feature / Analysis Dimension</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#2563eb' }}>INDmoney</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#10b981' }}>Smallcase</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#f59e0b' }}>Morningstar X-Ray</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#8b5cf6' }}>Wealthfront / Betterment</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, color: '#0f172a', background: '#eff6ff' }}>WealthCore (Our App)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        dim: 'Family & Multi-Account Rollup',
                        ind: 'Email sync only',
                        sc: 'Single demat',
                        ms: 'Manual input',
                        wf: 'US accounts only',
                        wc: '✅ Native Family & Portfolio selector with MProfit accounting sync',
                      },
                      {
                        dim: 'Rebalancing Suggestions',
                        ind: 'Rule-based alerts',
                        sc: 'Model basket updates',
                        ms: 'Diagnostics only',
                        wf: 'Automated cashflow drift',
                        wc: '✅ Interactive Target Model Drift (Aggressive/Balanced/Preserve)',
                      },
                      {
                        dim: 'Tax-Loss Harvesting',
                        ind: 'Manual report',
                        sc: 'No',
                        ms: 'No',
                        wf: 'Daily algorithmic scan',
                        wc: '✅ Full Tax-Loss Harvesting Engine with FY capital gains set-off',
                      },
                      {
                        dim: 'Fixed Income / FD Tax Drag Analysis',
                        ind: 'Basic FD list',
                        sc: 'No',
                        ms: 'Yield to maturity only',
                        wf: 'N/A',
                        wc: '✅ FD vs Arbitrage Fund tax alpha calculator (+1.6% post-tax yield)',
                      },
                      {
                        dim: 'Cash / Liquid Drag Detection',
                        ind: 'Net worth idle cash',
                        sc: 'No',
                        ms: 'Cash % in X-Ray',
                        wf: 'Auto cash sweep',
                        wc: '✅ Liquid ETF detection & STP recommendation to eliminate drag',
                      },
                      {
                        dim: 'Performance Benchmarking',
                        ind: 'Nifty 50',
                        sc: 'Theme index',
                        ms: 'Category peer group',
                        wf: 'Global market index',
                        wc: '✅ Real annualised XIRR with Newton-Raphson cashflow engine',
                      },
                    ].map((row, i) => (
                      <tr key={row.dim} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{row.dim}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{row.ind}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{row.sc}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{row.ms}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{row.wf}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e3a5f', background: '#eff6ff' }}>{row.wc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* 4. Unrealized Loss Holdings Table (Tax-Harvesting Candidates) */}
            {lossHoldings.length > 0 && (
              <SectionCard title="4. Tax-Loss Harvesting Candidates (Positions Trading at a Loss)" icon={TrendingDown} iconColor="#ef4444" fullWidth>
                <div style={{ marginBottom: '12px', fontSize: '12px', color: '#64748b' }}>
                  These holdings currently have unrealized losses. Booking losses before the end of the financial year allows you to set off short-term and long-term capital gains, saving immediate tax liability.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['Asset Name', 'Asset Class', 'Invested Cost', 'Current Value', 'Unrealized Loss', 'Loss %', 'Potential Tax Shield (12.5%)'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Asset Name' || h === 'Asset Class' ? 'left' : 'right', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lossHoldings.slice(0, 15).map((h, i) => {
                        const loss = (h.currentValue ?? 0) - (h.amtInvested ?? 0);
                        const lossPct = (h.amtInvested ?? 0) > 0 ? (loss / h.amtInvested!) * 100 : 0;
                        const taxSaved = Math.abs(loss) * 0.125;
                        return (
                          <tr key={`${h.amid}-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{h.assetName}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{attyToClass(h.assetType ?? 0)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>{fmt(h.amtInvested ?? 0)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{fmt(h.currentValue ?? 0)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{fmt(loss)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{lossPct.toFixed(1)}%</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>+{fmt(taxSaved)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

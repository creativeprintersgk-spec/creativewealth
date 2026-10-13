import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getHoldings } from '../logic';
import { PieChart as PieIcon, Layers, TrendingUp, TrendingDown, ShieldCheck, Wallet } from 'lucide-react';

// Cohesive, private-wealth fintech palette (matching the main dashboard theme)
const THEME_COLORS = [
  '#2563eb', // Royal Blue
  '#4f46e5', // Slate Indigo
  '#059669', // Forest Emerald
  '#d97706', // Warm Amber
  '#0891b2', // Ocean Cyan
  '#7c3aed', // Soft Purple
  '#0284c7', // Sky Blue
  '#e11d48', // Rose Coral
  '#475569', // Slate Steel
  '#10b981', // Mint
  '#6366f1', // Classic Indigo
  '#b45309', // Dark Amber
  '#334155', // Deep Slate
  '#8b5cf6', // Violet
];

const ATTY_CLASS_MAP: Record<number, string> = {
  50: 'Stocks', 51: 'Stocks', 60: 'MF (Equity)', 61: 'MF (Debt)', 62: 'MF (Liquid)',
  63: 'MF (Other)', 66: 'Private Equity', 70: 'NCDs', 75: 'Gold', 80: 'Insurance', 95: 'NPS',
  90: 'FDs', 100: 'Traded Bonds', 110: 'NCDs', 120: 'PPF', 130: 'EPF',
  140: 'VPF', 150: 'Gold', 151: 'Silver', 160: 'Real Estate', 190: 'Private Equity'
};

// Core Asset Pillars matching the main dashboard 6 pillars
const CORE_PILLARS: Record<string, { pillar: string; color: string }> = {
  'Stocks': { pillar: 'Direct Equity', color: '#2563eb' },
  'MF (Equity)': { pillar: 'Mutual Funds', color: '#4f46e5' },
  'MF (Debt)': { pillar: 'Mutual Funds', color: '#4f46e5' },
  'MF (Liquid)': { pillar: 'Liquid Reserves', color: '#0891b2' },
  'MF (Other)': { pillar: 'Mutual Funds', color: '#4f46e5' },
  'Traded Bonds': { pillar: 'Bonds & Debentures', color: '#0284c7' },
  'NCDs': { pillar: 'Bonds & Debentures', color: '#0284c7' },
  'Gold': { pillar: 'Precious Metals', color: '#d97706' },
  'Silver': { pillar: 'Precious Metals', color: '#d97706' },
  'FDs': { pillar: 'Deposits & PPF', color: '#059669' },
  'PPF': { pillar: 'Deposits & PPF', color: '#059669' },
  'EPF': { pillar: 'Deposits & PPF', color: '#059669' },
  'VPF': { pillar: 'Deposits & PPF', color: '#059669' },
  'Real Estate': { pillar: 'Real Estate & PE', color: '#7c3aed' },
  'Private Equity': { pillar: 'Real Estate & PE', color: '#7c3aed' },
  'Insurance': { pillar: 'Insurance & NPS', color: '#475569' },
  'NPS': { pillar: 'Insurance & NPS', color: '#475569' },
};

export default function PMSDashboard({ portfolioIds }: { portfolioIds: number[] }) {
  const [viewMode, setViewMode] = useState<'pillars' | 'detailed'>('pillars');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const data = useMemo(() => {
    const holdings = getHoldings(portfolioIds, undefined, false, true);
    let totalInvested = 0;
    let totalLive = 0;
    const allocation: Record<string, { value: number; count: number }> = {};
    const pillarAllocation: Record<string, { value: number; count: number; color: string }> = {};

    holdings.forEach(h => {
      const val = h.currentValue || 0;
      const cost = h.amtInvested || 0;
      totalInvested += cost;
      totalLive += val;
      if (val > 0) {
        const cls = ATTY_CLASS_MAP[h.assetType] || 'Other Assets';
        if (!allocation[cls]) {
          allocation[cls] = { value: 0, count: 0 };
        }
        allocation[cls].value += val;
        allocation[cls].count += 1;

        const pil = CORE_PILLARS[cls] || { pillar: 'Other Assets', color: '#64748b' };
        if (!pillarAllocation[pil.pillar]) {
          pillarAllocation[pil.pillar] = { value: 0, count: 0, color: pil.color };
        }
        pillarAllocation[pil.pillar].value += val;
        pillarAllocation[pil.pillar].count += 1;
      }
    });

    const detailedData = Object.entries(allocation)
      .map(([name, item], idx) => ({
        name,
        value: item.value,
        count: item.count,
        pct: totalLive > 0 ? (item.value / totalLive) * 100 : 0,
        color: THEME_COLORS[idx % THEME_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);

    const pillarsData = Object.entries(pillarAllocation)
      .map(([name, item]) => ({
        name,
        value: item.value,
        count: item.count,
        pct: totalLive > 0 ? (item.value / totalLive) * 100 : 0,
        color: item.color
      }))
      .sort((a, b) => b.value - a.value);

    return { totalInvested, totalLive, detailedData, pillarsData, holdingsCount: holdings.length };
  }, [portfolioIds]);

  const gain = data.totalLive - data.totalInvested;
  const gainPct = data.totalInvested > 0 ? (gain / data.totalInvested) * 100 : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  const formatCompact = (val: number) => {
    if (Math.abs(val) >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(val) >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return formatCurrency(val);
  };

  const activeList = viewMode === 'pillars' ? data.pillarsData : data.detailedData;
  const topPillar = activeList[0];

  return (
    <div style={{
      padding: '20px 24px 28px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      background: 'linear-gradient(145deg, #f1f6fd 0%, #f8fafc 50%, #eff5fb 100%)',
      minHeight: '100%',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#0f172a',
      boxSizing: 'border-box'
    }}>
      
      {/* ── HEADER TIER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(37, 99, 235, 0.08)',
              color: '#1d4ed8',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              padding: '2.5px 9px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              <ShieldCheck size={12} color="#2563eb" />
              Family Wealth Pool
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              • Consolidated Analytics
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0 0', letterSpacing: '-0.025em' }}>
            Family Portfolio Analytics
          </h2>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
            Consolidated asset allocation, performance analytics & capital distribution across active folios
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(214, 228, 246, 0.9)',
            padding: '6px 12px',
            borderRadius: '10px',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#334155',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Wallet size={13} color="#2563eb" />
            <span>{portfolioIds.length} Linked Folio{portfolioIds.length === 1 ? '' : 's'}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#64748b' }}>{data.holdingsCount} Total Assets</span>
          </div>
        </div>
      </div>

      {/* ── 3 KPI CARDS (MATCHING WIRELY LUXE FROSTED DESIGN) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        
        {/* KPI 1: Net Worth Valuation */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid rgba(214, 228, 246, 0.9)',
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: 'transform 0.15s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Net Portfolio Valuation
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '999px',
              background: 'rgba(37, 99, 235, 0.08)',
              color: '#2563eb',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              Live Value
            </span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '2px 0' }}>
            {formatCurrency(data.totalLive)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            Mark-to-market consolidated value
          </div>
        </div>

        {/* KPI 2: Total Invested */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid rgba(214, 228, 246, 0.9)',
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: 'transform 0.15s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Capital Invested
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '999px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0'
            }}>
              Cost Basis
            </span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '2px 0' }}>
            {formatCurrency(data.totalInvested)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            Aggregate acquisition capital deployed
          </div>
        </div>

        {/* KPI 3: Unrealised Gain */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid rgba(214, 228, 246, 0.9)',
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: 'transform 0.15s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Unrealised Gain
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              background: gain >= 0 ? '#ecfdf5' : '#fef2f2',
              color: gain >= 0 ? '#059669' : '#dc2626',
              border: gain >= 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              {gain >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {gain >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
            </span>
          </div>
          <div style={{
            fontSize: '26px',
            fontWeight: 800,
            color: gain >= 0 ? '#059669' : '#dc2626',
            letterSpacing: '-0.02em',
            margin: '2px 0'
          }}>
            {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            {gain >= 0 ? 'Absolute return on invested capital' : 'Net unrealised capital pullback'}
          </div>
        </div>

      </div>

      {/* ── ASSET ALLOCATION & CAPITAL MIX CARD (COMPACT SPLIT LUXURY THEME) ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(214, 228, 246, 0.9)',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 8px 24px -4px rgba(22, 45, 78, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        
        {/* Card Header & View Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <PieIcon size={14} />
            </div>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                Asset Allocation & Capital Mix
              </span>
              <span style={{
                marginLeft: '8px',
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                🎯 Top Class: {topPillar ? `${topPillar.name} (${topPillar.pct.toFixed(1)}%)` : 'N/A'} • {activeList.length} Categories
              </span>
            </div>
          </div>

          {/* Toggle Pillars vs Detailed */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => setViewMode('pillars')}
              style={{
                border: 'none',
                background: viewMode === 'pillars' ? '#ffffff' : 'transparent',
                color: viewMode === 'pillars' ? '#2563eb' : '#64748b',
                fontWeight: viewMode === 'pillars' ? 750 : 600,
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: viewMode === 'pillars' ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={11} />
              Core Pillars ({data.pillarsData.length})
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              style={{
                border: 'none',
                background: viewMode === 'detailed' ? '#ffffff' : 'transparent',
                color: viewMode === 'detailed' ? '#2563eb' : '#64748b',
                fontWeight: viewMode === 'detailed' ? 750 : 600,
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: viewMode === 'detailed' ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Detailed Classes ({data.detailedData.length})
            </button>
          </div>
        </div>

        {/* Continuous Multi-Segment Proportional Bar */}
        <div style={{
          display: 'flex',
          height: '6px',
          borderRadius: '999px',
          overflow: 'hidden',
          background: '#e2e8f0',
          gap: '1.5px',
          width: '100%'
        }}>
          {activeList.filter(a => a.pct > 0).map((a, idx) => (
            <div
              key={idx}
              style={{
                width: `${Math.max(a.pct, 1.5)}%`,
                background: a.color,
                transition: 'all 0.3s ease',
                opacity: hoveredIndex === null || hoveredIndex === idx ? 1 : 0.45
              }}
              title={`${a.name}: ${a.pct.toFixed(1)}% (${formatCurrency(a.value)})`}
            />
          ))}
        </div>

        {/* Split Content: Left Minimal Donut Ring (with Center Hole Total) | Right Micro-Card Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '190px 1fr',
          gap: '20px',
          alignItems: 'center'
        }}>
          
          {/* Left: Minimal Compact Donut Ring */}
          <div style={{ position: 'relative', width: '190px', height: '165px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width={180} height={165}>
              <PieChart>
                <Pie
                  data={activeList}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={66}
                  paddingAngle={2.5}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  onMouseEnter={(_, index) => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {activeList.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.45}
                      style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Valuation']}
                  contentStyle={{
                    background: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                    padding: '6px 10px'
                  }}
                  itemStyle={{ color: '#93c5fd' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Valuation inside Center Hole */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Pool
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {formatCompact(data.totalLive)}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563eb' }}>
                100% Split
              </span>
            </div>
          </div>

          {/* Right: Micro-Grid of Asset Class Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '8px',
            maxHeight: '190px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {activeList.map((entry, index) => {
              const isHovered = hoveredIndex === index;
              return (
                <div
                  key={index}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    background: isHovered ? '#eff6ff' : 'rgba(248, 250, 252, 0.85)',
                    border: isHovered ? `1px solid ${entry.color}` : '1px solid rgba(226, 232, 240, 0.95)',
                    borderRadius: '10px',
                    padding: '7px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isHovered ? '0 2px 8px rgba(37, 99, 235, 0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1, paddingRight: '4px' }}>
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: entry.color,
                        flexShrink: 0
                      }} />
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isHovered ? '#1d4ed8' : '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {entry.name}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '999px',
                      background: `${entry.color}15`,
                      color: entry.color,
                      flexShrink: 0
                    }}>
                      {entry.pct.toFixed(1)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 750, color: '#0f172a', letterSpacing: '-0.01em' }}>
                      {formatCurrency(entry.value)}
                    </span>
                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>
                      {entry.count} {entry.count === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
}

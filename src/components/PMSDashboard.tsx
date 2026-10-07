import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { getHoldings } from '../logic';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#f97316'];

const ATTY_CLASS_MAP: Record<number, string> = {
  50: 'Stocks', 51: 'Stocks', 60: 'MF (Equity)', 61: 'MF (Debt)', 62: 'MF (Liquid)',
  63: 'MF (Other)', 66: 'Private Equity', 70: 'NCDs', 75: 'Gold', 80: 'Insurance', 95: 'NPS',
  90: 'FDs', 100: 'Traded Bonds', 110: 'NCDs', 120: 'PPF', 130: 'EPF',
  140: 'VPF', 150: 'Gold', 151: 'Silver', 160: 'Real Estate', 190: 'Private Equity'
};

export default function PMSDashboard({ portfolioIds }: { portfolioIds: number[] }) {
  const data = useMemo(() => {
    const holdings = getHoldings(portfolioIds, undefined, false, true);
    let totalInvested = 0;
    let totalLive = 0;
    const allocation: Record<string, number> = {};

    holdings.forEach(h => {
      const val = h.currentValue || 0;
      const cost = h.amtInvested || 0;
      totalInvested += cost;
      totalLive += val;
      if (val > 0) {
        const cls = ATTY_CLASS_MAP[h.assetType] || 'Other';
        allocation[cls] = (allocation[cls] || 0) + val;
      }
    });

    const pieData = Object.entries(allocation).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { totalInvested, totalLive, pieData };
  }, [portfolioIds]);

  const gain = data.totalLive - data.totalInvested;
  const gainPct = data.totalInvested > 0 ? (gain / data.totalInvested) * 100 : 0;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bbg-surface)', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--bbg-text-main)', margin: 0 }}>RIA Analytics Dashboard</h2>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, background: 'var(--bbg-surface)', borderRadius: '0px', padding: '20px', boxShadow: 'none', border: '1px solid var(--bbg-border)' }}>
          <div style={{ fontSize: '14px', color: 'var(--bbg-text-muted)', fontWeight: 600, marginBottom: '8px' }}>Net Worth Valuation</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--bbg-text-main)' }}>{formatCurrency(data.totalLive)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--bbg-surface)', borderRadius: '0px', padding: '20px', boxShadow: 'none', border: '1px solid var(--bbg-border)' }}>
          <div style={{ fontSize: '14px', color: 'var(--bbg-text-muted)', fontWeight: 600, marginBottom: '8px' }}>Total Invested</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--bbg-text-main)' }}>{formatCurrency(data.totalInvested)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--bbg-surface)', borderRadius: '0px', padding: '20px', boxShadow: 'none', border: '1px solid var(--bbg-border)' }}>
          <div style={{ fontSize: '14px', color: 'var(--bbg-text-muted)', fontWeight: 600, marginBottom: '8px' }}>Unrealised Gain</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: gain >= 0 ? '#10b981' : '#ef4444' }}>
            {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
            <span style={{ fontSize: '16px', marginLeft: '8px', opacity: 0.8 }}>({gainPct.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginTop: '10px' }}>
        <div style={{ flex: 1, background: 'var(--bbg-surface)', borderRadius: '0px', padding: '20px', border: '1px solid var(--bbg-border)', minHeight: '350px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', color: 'var(--bbg-text-main)' }}>Asset Allocation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={2}>
                {data.pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabase';
import type { AssetHolding } from '../../logic';
 
interface Props {
  data: AssetHolding[];
  onHoldingClick: (holding: AssetHolding) => void;
  groupByCategory?: boolean;
  categoryLabels?: Record<string, string>;
  onDataChange?: (enrichedData: AssetHolding[]) => void;
}
 
const COLS = [
  { label: 'Asset Name',   key: 'assetName',    align: 'left',  width: '260px' },
  { label: 'Quantity',     key: 'quantity',      align: 'right', width: '90px'  },
  { label: 'Avg Price',    key: 'avgPrice',      align: 'right', width: '110px' },
  { label: 'Amt Invested', key: 'amtInvested',   align: 'right', width: '130px' },
  { label: 'Cur. Price',   key: 'currentPrice',  align: 'right', width: '110px' },
  { label: "Today's Gain", key: 'todaysGain',    align: 'right', width: '120px' },
  { label: 'Overall Gain', key: 'overallGain',   align: 'right', width: '130px' },
  { label: 'Cur. Value',   key: 'currentValue',  align: 'right', width: '130px' },
];
 
const fmt = (n: number, decimals = 2) =>
  '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtQty = (n: number) => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const gainColor = (n: number) => n >= 0 ? '#16a34a' : '#dc2626';
 
function getRefreshInterval(): number {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const h = ist.getHours(), m = ist.getMinutes(), day = ist.getDay();
  const mins = h * 60 + m;
  const isWeekend = day === 0 || day === 6;
  const isMarketHours = !isWeekend && mins >= 555 && mins < 930;
  return isMarketHours ? 60 * 1000 : 15 * 60 * 1000;
}
 
export default function HoldingsGrid({ data, onHoldingClick, groupByCategory = false, categoryLabels = {}, onDataChange }: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [enrichedData, setEnrichedData] = useState<AssetHolding[]>(data);
 
  useEffect(() => {
    setEnrichedData(data);
 
    const fetchPrices = async () => {
      try {
        // Read live prices from mprices table (real MProfit table)
        const { data: priceRows, error } = await supabase
          .from('mprices')
          .select('amid, currp, prevp');
 
        if (error) {
          console.warn('Price fetch error:', error.message);
          return;
        }
        if (!priceRows?.length) return;
 
        // Build lookup map by amid
        const priceByAmid = new Map<number, { curr: number; prev: number }>();
        priceRows.forEach((p: any) => {
          if (p.currp && p.currp > 0) {
            priceByAmid.set(Number(p.amid), { curr: Number(p.currp), prev: Number(p.prevp) || 0 });
          }
        });
 
        setEnrichedData(prev => {
          const updated = prev.map(row => {
            const priceRow = priceByAmid.get(row.amid);
            if (!priceRow || priceRow.curr <= 0) return row;
 
            const currPrice = priceRow.curr;
            const prevPrice = priceRow.prev;
            const currentValue = row.quantity * currPrice;
            const overallGain = currentValue - row.amtInvested;
            const todaysGain = prevPrice > 0 ? row.quantity * (currPrice - prevPrice) : 0;
 
            return {
              ...row,
              currentPrice: currPrice,
              prevPrice,
              currentValue,
              overallGain,
              overallGainPct: row.amtInvested > 0 ? (overallGain / row.amtInvested) * 100 : 0,
              todaysGain,
              todaysGainPct: prevPrice > 0 ? ((currPrice - prevPrice) / prevPrice) * 100 : 0,
            };
          });
          onDataChange?.(updated);
          return updated;
        });
      } catch (err) {
        console.warn('Price fetch exception:', err);
      }
    };
 
    fetchPrices();
    const interval = setInterval(fetchPrices, getRefreshInterval());
    return () => clearInterval(interval);
  }, [data]);
 
  const toggleCategory = (cat: string) =>
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
 
  // Group by assetType if groupByCategory
  const grouped = React.useMemo(() => {
    if (!groupByCategory) return { ALL: enrichedData };
    const map: Record<string, AssetHolding[]> = {};
    enrichedData.forEach(h => {
      const key = String(h.assetType);
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [enrichedData, groupByCategory]);
 
  // Summary totals
  const totals = React.useMemo(() => ({
    invested: enrichedData.reduce((s, h) => s + h.amtInvested, 0),
    value: enrichedData.reduce((s, h) => s + (h.currentValue || h.amtInvested), 0),
    gain: enrichedData.reduce((s, h) => s + h.overallGain, 0),
    todaysGain: enrichedData.reduce((s, h) => s + h.todaysGain, 0),
  }), [enrichedData]);
 
  const renderRow = (h: AssetHolding) => (
    <tr
      key={`${h.amid}-${h.assetId}`}
      onClick={() => onHoldingClick(h)}
      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Asset Name */}
      <td style={{ padding: '10px 16px', minWidth: '260px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{h.assetName}</div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
          {h.assetIcon} · {h.assetTypeName}
          {h.nseSymbol ? ` · ${h.nseSymbol}` : ''}
        </div>
      </td>
      {/* Quantity + Avg Price (2-line like MProfit) */}
      <td style={{ padding: '10px 16px', textAlign: 'right', width: '90px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{fmtQty(h.quantity)}</div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>{fmt(h.avgPrice)}</div>
      </td>
      {/* Amt Invested */}
      <td style={{ padding: '10px 16px', textAlign: 'right', width: '130px', fontWeight: 600, fontSize: '13px', color: '#334155' }}>
        {fmt(h.amtInvested, 0)}
      </td>
      {/* Current Price */}
      <td style={{ padding: '10px 16px', textAlign: 'right', width: '110px', fontSize: '13px', color: h.currentPrice > 0 ? '#1e293b' : '#94a3b8' }}>
        {h.currentPrice > 0 ? fmt(h.currentPrice) : '—'}
      </td>
      {/* Today's Gain */}
      <td style={{ padding: '10px 16px', textAlign: 'right', width: '120px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: gainColor(h.todaysGain) }}>
          {h.todaysGain !== 0 ? fmt(h.todaysGain, 0) : '—'}
        </div>
        {h.todaysGainPct !== 0 && (
          <div style={{ fontSize: '11px', color: gainColor(h.todaysGainPct) }}>
            {h.todaysGainPct >= 0 ? '+' : ''}{h.todaysGainPct.toFixed(2)}%
          </div>
        )}
      </td>
      {/* Overall Gain */}
      <td style={{ padding: '10px 16px', textAlign: 'right', width: '130px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: gainColor(h.overallGain) }}>
          {h.currentPrice > 0 ? fmt(h.overallGain, 0) : '—'}
        </div>
        {h.currentPrice > 0 && h.overallGainPct !== 0 && (
          <div style={{ fontSize: '11px', color: gainColor(h.overallGainPct) }}>
            {h.overallGainPct >= 0 ? '+' : ''}{h.overallGainPct.toFixed(2)}%
          </div>
        )}
      </td>
      {/* Current Value */}
      <td style={{ padding: '10px 16px', textAlign: 'right', width: '130px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
        {h.currentPrice > 0 ? fmt(h.currentValue, 0) : fmt(h.amtInvested, 0)}
      </td>
    </tr>
  );
 
  const renderCategoryHeader = (key: string, rows: AssetHolding[]) => {
    const label = categoryLabels[key] || rows[0]?.assetTypeName || key;
    const totalInvested = rows.reduce((s, h) => s + h.amtInvested, 0);
    const totalValue = rows.reduce((s, h) => s + (h.currentValue || h.amtInvested), 0);
    const totalGain = rows.reduce((s, h) => s + h.overallGain, 0);
    const isExpanded = expandedCategories[key] !== false; // default expanded
 
    return (
      <React.Fragment key={key}>
        <tr
          onClick={() => toggleCategory(key)}
          style={{ background: '#f1f5f9', cursor: 'pointer', borderBottom: '2px solid #e2e8f0' }}
        >
          <td style={{ padding: '8px 16px', fontWeight: 700, fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {label} ({rows.length})
          </td>
          <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b' }} colSpan={2}>
            {fmt(totalInvested, 0)}
          </td>
          <td colSpan={2} />
          <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: gainColor(totalGain) }}>
            {totalValue > 0 ? fmt(totalGain, 0) : '—'}
          </td>
          <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
            {fmt(totalValue > 0 ? totalValue : totalInvested, 0)}
          </td>
        </tr>
        {isExpanded && rows.map(renderRow)}
      </React.Fragment>
    );
  };
 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: '0 1px 0 #e2e8f0' }}>
            <tr>
              {COLS.map(col => (
                <th key={col.key} style={{
                  padding: '10px 16px', textAlign: col.align as any,
                  fontSize: '11px', fontWeight: 700, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  width: col.width, whiteSpace: 'nowrap'
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupByCategory
              ? Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([key, rows]) => renderCategoryHeader(key, rows))
              : enrichedData.map(renderRow)
            }
            {enrichedData.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  No holdings found for selected portfolio
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
 
      {/* NET WORTH BAR — MProfit style bottom bar */}
      <div style={{
        borderTop: '2px solid #e2e8f0', background: '#f8fafc',
        padding: '12px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Amt Invested</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{fmt(totals.invested, 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today's Gain</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: gainColor(totals.todaysGain) }}>
              {totals.todaysGain !== 0 ? fmt(totals.todaysGain, 0) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Overall Gain</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: gainColor(totals.gain) }}>
              {totals.value > 0 ? fmt(totals.gain, 0) : '—'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Net Worth</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>
            {fmt(totals.value > 0 ? totals.value : totals.invested, 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
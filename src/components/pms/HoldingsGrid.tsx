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
  areAllExpanded?: boolean;
  sortBy?: 'name' | 'value' | 'todaysGainPct' | 'overallGainPct' | 'overallGain' | 'todaysGain';
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
  'Rs. ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtQty = (n: number) => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const gainColor = (n: number) => n >= 0 ? '#16a34a' : '#dc2626';
 
function getRefreshInterval(): number {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const h = ist.getHours(), m = ist.getMinutes(), day = ist.getDay();
  const mins = h * 60 + m;
  const isWeekend = day === 0 || day === 6;
  const isMarketHours = !isWeekend && mins >= 555 && mins < 930;
  return isMarketHours ? 15 * 60 * 1000 : 15 * 60 * 1000;
}
 
const ASSET_TYPE_ORDER = [
  50,  // Stocks
  60,  // Mutual Funds (Equity)
  61,  // Mutual Funds (Debt)
  62,  // Mutual Funds (Other)
  200, // Special Inv. Funds
  70,  // NPS / ULiP
  80,  // Insurance
  190, // Private Equity
  90,  // Fixed Deposits
  100, // Traded Bonds
  110, // NCD / Debentures
  120, // Deposits / Loans
  130, // PPF / EPF
  140, // Post Office
  150, // Gold
  151, // Silver
  170, // Jewellery
  160, // Properties
  180, // Art
  210, // AIF
  220  // Loans
];

export default function HoldingsGrid({ 
  data, 
  onHoldingClick, 
  groupByCategory = false, 
  categoryLabels = {}, 
  onDataChange,
  areAllExpanded,
  sortBy = 'value'
}: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [enrichedData, setEnrichedData] = useState<AssetHolding[]>(data);
 
  useEffect(() => {
    setEnrichedData(data);
 
    const fetchPrices = async () => {
      try {
        const amids = Array.from(new Set(data.map(row => row.amid).filter(id => !isNaN(id))));
        if (!amids.length) return;

        // Read live prices from mprices table
        // Order DESC by row_id so the LATEST synced price row wins (highest row_id = newest)
        const { data: priceRows, error } = await supabase
          .from('mprices')
          .select('amid, currp, prevp, row_id')
          .in('amid', amids)
          .order('row_id', { ascending: false });
 
        if (error) {
          console.warn('Price fetch error:', error.message);
          return;
        }
        if (!priceRows?.length) return;
 
        // Build lookup map by amid — first hit per amid wins (DESC order = newest first)
        const priceByAmid = new Map<number, { curr: number; prev: number }>();
        priceRows.forEach((p: any) => {
          if (!priceByAmid.has(Number(p.amid)) && p.currp && p.currp > 0) {
            priceByAmid.set(Number(p.amid), { curr: Number(p.currp), prev: Number(p.prevp) || 0 });
          }
        });
 
        const updated = data.map(row => {
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
        setEnrichedData(updated);
        onDataChange?.(updated);
      } catch (err) {
        console.warn('Price fetch exception:', err);
      }
    };
 
    fetchPrices();
    const interval = setInterval(fetchPrices, getRefreshInterval());
    return () => clearInterval(interval);
  }, [data]);
 
  // Sync external expand/collapse state
  useEffect(() => {
    if (groupByCategory && areAllExpanded !== undefined) {
      const cats = Array.from(new Set(enrichedData.map(h => String(h.assetType))));
      const next: Record<string, boolean> = {};
      cats.forEach(c => {
        next[c] = areAllExpanded;
      });
      setExpandedCategories(next);
    }
  }, [areAllExpanded, groupByCategory, enrichedData]);

  const toggleCategory = (cat: string) =>
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
 
  const sortedData = React.useMemo(() => {
    const list = [...enrichedData];
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.assetName || '').localeCompare(String(b.assetName || ''));
      }
      if (sortBy === 'value') {
        const valA = a.currentPrice > 0 ? (a.currentValue || 0) : a.amtInvested;
        const valB = b.currentPrice > 0 ? (b.currentValue || 0) : b.amtInvested;
        return valB - valA;
      }
      if (sortBy === 'todaysGainPct') {
        return (b.todaysGainPct || 0) - (a.todaysGainPct || 0);
      }
      if (sortBy === 'overallGainPct') {
        return (b.overallGainPct || 0) - (a.overallGainPct || 0);
      }
      if (sortBy === 'overallGain') {
        return (b.overallGain || 0) - (a.overallGain || 0);
      }
      if (sortBy === 'todaysGain') {
        return (b.todaysGain || 0) - (a.todaysGain || 0);
      }
      return 0;
    });
    return list;
  }, [enrichedData, sortBy]);

  // Group by assetType if groupByCategory
  const grouped = React.useMemo(() => {
    if (!groupByCategory) return { ALL: sortedData };
    const map: Record<string, AssetHolding[]> = {};
    sortedData.forEach(h => {
      const key = String(h.assetType);
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [sortedData, groupByCategory]);
 
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
      <td style={{ padding: '3px 16px', maxWidth: '300px' }} title={h.assetName}>
        <div style={{
          fontWeight: 600,
          fontSize: '13px',
          color: '#1e293b',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {h.assetName}
        </div>
      </td>
      {/* Quantity */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '90px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
        {fmtQty(h.quantity)}
      </td>
      {/* Avg Price */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '110px', fontSize: '13px', color: '#64748b' }}>
        {fmt(h.avgPrice)}
      </td>
      {/* Amt Invested */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '130px', fontWeight: 600, fontSize: '13px', color: '#334155' }}>
        {fmt(h.amtInvested, 0)}
      </td>
      {/* Current Price */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '110px', fontSize: '13px', color: h.currentPrice > 0 ? '#1e293b' : '#94a3b8' }}>
        {h.currentPrice > 0 ? fmt(h.currentPrice) : '—'}
      </td>
      {/* Today's Gain */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '120px', fontSize: '13px', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700, color: gainColor(h.todaysGain) }}>
          {h.todaysGain !== 0 ? fmt(h.todaysGain, 0) : '—'}
        </span>
        {h.todaysGainPct !== 0 && (
          <span style={{ fontSize: '11px', color: gainColor(h.todaysGainPct), marginLeft: '4px' }}>
            ({h.todaysGainPct >= 0 ? '+' : ''}{h.todaysGainPct.toFixed(2)}%)
          </span>
        )}
      </td>
      {/* Overall Gain */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '130px', fontSize: '13px', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700, color: gainColor(h.overallGain) }}>
          {h.currentPrice > 0 ? fmt(h.overallGain, 0) : '—'}
        </span>
        {h.currentPrice > 0 && h.overallGainPct !== 0 && (
          <span style={{ fontSize: '11px', color: gainColor(h.overallGainPct), marginLeft: '4px' }}>
            ({h.overallGainPct >= 0 ? '+' : ''}{h.overallGainPct.toFixed(2)}%)
          </span>
        )}
      </td>
      {/* Current Value */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '130px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
        {h.currentPrice > 0 ? fmt(h.currentValue, 0) : fmt(h.amtInvested, 0)}
      </td>
    </tr>
  );
 
  const renderCategoryHeader = (key: string, rows: AssetHolding[]) => {
    const label = categoryLabels[key] || rows[0]?.assetTypeName || key;
    const totalInvested = rows.reduce((s, h) => s + h.amtInvested, 0);
    const totalValue = rows.reduce((s, h) => s + (h.currentValue || h.amtInvested), 0);
    const totalGain = rows.reduce((s, h) => s + h.overallGain, 0);
    const totalTodaysGain = rows.reduce((s, h) => s + (h.todaysGain || 0), 0);
    const isExpanded = expandedCategories[key] !== false; // default expanded
 
    return (
      <React.Fragment key={key}>
        <tr
          onClick={() => toggleCategory(key)}
          style={{ background: '#f1f5f9', cursor: 'pointer', borderBottom: '2px solid #e2e8f0' }}
        >
          <td style={{ padding: '4px 16px', fontWeight: 700, fontSize: '12px', color: '#475569' }} colSpan={3}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {label} ({rows.length})
            </div>
          </td>
          <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b' }} colSpan={1}>
            {fmt(totalInvested, 0)}
          </td>
          <td style={{ padding: '4px 16px' }} colSpan={1} />
          <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: gainColor(totalTodaysGain) }} colSpan={1}>
            {totalTodaysGain !== 0 ? fmt(totalTodaysGain, 0) : '—'}
          </td>
          <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: gainColor(totalGain) }} colSpan={1}>
            {totalValue > 0 ? fmt(totalGain, 0) : '—'}
          </td>
          <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#1e293b' }} colSpan={1}>
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
                  padding: '6px 16px', textAlign: col.align as any,
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
              ? Object.entries(grouped)
                  .sort((a, b) => {
                    const idxA = ASSET_TYPE_ORDER.indexOf(Number(a[0]));
                    const idxB = ASSET_TYPE_ORDER.indexOf(Number(b[0]));
                    const orderA = idxA === -1 ? 999 : idxA;
                    const orderB = idxB === -1 ? 999 : idxB;
                    return orderA - orderB;
                  })
                  .map(([key, rows]) => renderCategoryHeader(key, rows))
              : sortedData.map(renderRow)
            }
            {enrichedData.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  No holdings found for selected portfolio
                </td>
              </tr>
            )}
          </tbody>
          <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#f8fafc', borderTop: '2px solid #cbd5e1', boxShadow: '0 -2px 0 #cbd5e1' }}>
            <tr style={{ height: '40px', fontWeight: 800 }}>
              {/* Asset Name */}
              <td style={{ padding: '8px 16px', color: '#475569', fontSize: '12px' }}>
                TOTAL
              </td>
              {/* Quantity */}
              <td />
              {/* Avg Price */}
              <td />
              {/* Amt Invested */}
              <td style={{ padding: '8px 16px', textAlign: 'right', color: '#1e293b', fontSize: '13px' }}>
                {fmt(totals.invested, 0)}
              </td>
              {/* Cur Price */}
              <td />
              {/* Today's Gain */}
              <td style={{ padding: '8px 16px', textAlign: 'right', color: gainColor(totals.todaysGain), fontSize: '13px' }}>
                {totals.todaysGain !== 0 ? fmt(totals.todaysGain, 0) : '—'}
              </td>
              {/* Overall Gain */}
              <td style={{ padding: '8px 16px', textAlign: 'right', color: gainColor(totals.gain), fontSize: '13px' }}>
                {totals.value > 0 ? fmt(totals.gain, 0) : '—'}
              </td>
              {/* Cur. Value */}
              <td style={{ padding: '8px 16px', textAlign: 'right', color: '#1e293b', fontSize: '13px', fontWeight: 900 }}>
                {fmt(totals.value > 0 ? totals.value : totals.invested, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { supabase } from '../../supabase';
import { state, isSupabaseReachable } from '../../logic';
import type { AssetHolding } from '../../logic';
 
interface Props {
  data: AssetHolding[];
  onHoldingClick: (holding: AssetHolding) => void;
  onSetPriceClick?: (holding: AssetHolding) => void;
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
  (n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtQty = (n: number) => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const gainColor = (n: number) => n >= 0 ? 'var(--bbg-green)' : 'var(--bbg-red)';
 
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
  30,  // Futures (Stock)
  31,  // Options (Stock)
  32,  // Futures (Index)
  33,  // Options (Index)
  81,  // Futures (Currency)
  82,  // Options (Currency)
  60,  // Mutual Funds (Equity)
  61,  // Mutual Funds (Debt)
  62,  // Mutual Funds (Other)
  75,  // Mutual Funds (Other / FoF)
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
  onSetPriceClick,
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

        // Build lookup map by amid
        const priceByAmid = new Map<number, { curr: number; prev: number }>();

        // 1. Fetch latest authoritative prices directly from Supabase if online
        if (await isSupabaseReachable()) {
          try {
            const { data: priceRows, error } = await supabase
              .from('mprices')
              .select('amid, currp, prevp, date, row_id')
              .in('amid', amids)
              .order('date', { ascending: false })
              .order('row_id', { ascending: false });

            if (!error && priceRows?.length) {
              priceRows.forEach((p: any) => {
                const amid = Number(p.amid);
                const curr = Number(p.currp) || 0;
                // Because rows are ordered date DESC, row_id DESC:
                // The FIRST time we see an amid is the latest price. Older historical rows must NEVER overwrite it!
                if (!priceByAmid.has(amid) && curr > 0) {
                  const prev = Number(p.prevp) > 0 ? Number(p.prevp) : curr;
                  const priceObj = { curr, prev };
                  priceByAmid.set(amid, priceObj);
                  if (!state.priceMap) state.priceMap = {};
                  state.priceMap[amid] = priceObj;
                }
              });
            }
          } catch (e) {
            console.warn('Supabase mprices fetch skipped (offline):', e);
          }
        }

        // 2. Fallback to in-memory state.mprices (newest date first) for any amids not returned by Supabase
        const sortedMemPrices = [...(state.mprices || [])].sort((a, b) => 
          (b.date || '').localeCompare(a.date || '') || (Number(b.row_id) || 0) - (Number(a.row_id) || 0)
        );
        sortedMemPrices.forEach((p: any) => {
          const amid = Number(p.amid);
          const curr = Number(p.currp) || 0;
          if (!priceByAmid.has(amid) && curr > 0) {
            const prev = Number(p.prevp) > 0 ? Number(p.prevp) : curr;
            priceByAmid.set(amid, { curr, prev });
            if (!state.priceMap) state.priceMap = {};
            state.priceMap[amid] = { curr, prev };
          }
        });

        // 3. Fallback to in-memory state.priceMap
        Object.entries(state.priceMap || {}).forEach(([idStr, p]: [string, any]) => {
          const id = Number(idStr);
          if (!priceByAmid.has(id) && p && p.curr > 0) {
            priceByAmid.set(id, { curr: Number(p.curr), prev: Number(p.prev) || 0 });
          }
        });

        if (priceByAmid.size === 0) return;

        const updated = data.map(row => {
          const priceRow = priceByAmid.get(row.amid);
          const fallbackPrice = row.quantity !== 0 && row.amtInvested !== 0 ? Math.abs(row.amtInvested / row.quantity) : 0;
          let currPrice = (priceRow && priceRow.curr > 0) ? priceRow.curr : (row.currentPrice > 0 ? row.currentPrice : fallbackPrice);
          let prevPrice = (priceRow && priceRow.prev > 0) ? priceRow.prev : (row.prevPrice > 0 ? row.prevPrice : currPrice);

          if (currPrice <= 0 && state.priceMap?.[row.amid]?.curr > 0) {
            currPrice = state.priceMap[row.amid].curr;
            prevPrice = state.priceMap[row.amid].prev || currPrice;
          }

          const currentValue = currPrice > 0 ? (row.quantity * currPrice) : (row.currentValue !== 0 ? row.currentValue : row.amtInvested);
          const overallGain = currentValue - row.amtInvested;
          const todaysGain = prevPrice > 0 && currPrice > 0 ? row.quantity * (currPrice - prevPrice) : 0;
          const todaysGainPct = prevPrice > 0 && currPrice > 0 ? ((currPrice - prevPrice) / prevPrice) * 100 : 0;

          return {
            ...row,
            currentPrice: currPrice,
            prevPrice,
            currentValue,
            overallGain,
            overallGainPct: row.amtInvested !== 0 ? (overallGain / Math.abs(row.amtInvested)) * 100 : 0,
            todaysGain,
            todaysGainPct,
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
 
  const [sortColumn, setSortColumn] = useState<string>('currentValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sync with external sortBy prop if changed
  useEffect(() => {
    if (sortBy === 'name') {
      setSortColumn('assetName');
      setSortDir('asc');
    } else if (sortBy === 'value') {
      setSortColumn('currentValue');
      setSortDir('desc');
    } else if (sortBy === 'todaysGain' || sortBy === 'todaysGainPct') {
      setSortColumn('todaysGain');
      setSortDir('desc');
    } else if (sortBy === 'overallGain' || sortBy === 'overallGainPct') {
      setSortColumn('overallGain');
      setSortDir('desc');
    }
  }, [sortBy]);

  const handleHeaderClick = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colKey);
      setSortDir(colKey === 'assetName' ? 'asc' : 'desc');
    }
  };

  const sortRows = React.useCallback((list: AssetHolding[]) => {
    return [...list].sort((a, b) => {
      if (sortColumn === 'assetName') {
        const cmp = String(a.assetName || '').localeCompare(String(b.assetName || ''), undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      let valA = 0;
      let valB = 0;
      if (sortColumn === 'quantity') {
        valA = a.quantity || 0;
        valB = b.quantity || 0;
      } else if (sortColumn === 'avgPrice') {
        valA = a.avgPrice || 0;
        valB = b.avgPrice || 0;
      } else if (sortColumn === 'amtInvested') {
        valA = a.amtInvested || 0;
        valB = b.amtInvested || 0;
      } else if (sortColumn === 'currentPrice') {
        valA = a.currentPrice || 0;
        valB = b.currentPrice || 0;
      } else if (sortColumn === 'todaysGain') {
        valA = a.todaysGain || 0;
        valB = b.todaysGain || 0;
      } else if (sortColumn === 'overallGain') {
        valA = a.overallGain || 0;
        valB = b.overallGain || 0;
      } else if (sortColumn === 'currentValue') {
        valA = a.currentPrice > 0 ? (a.currentValue || 0) : (a.amtInvested || 0);
        valB = b.currentPrice > 0 ? (b.currentValue || 0) : (b.amtInvested || 0);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [sortColumn, sortDir]);

  const sortedData = React.useMemo(() => {
    return sortRows(enrichedData);
  }, [enrichedData, sortRows]);

  // Group by assetType if groupByCategory, and sort WITHIN each category
  const grouped = React.useMemo(() => {
    if (!groupByCategory) return { ALL: sortedData };
    const map: Record<string, AssetHolding[]> = {};
    enrichedData.forEach(h => {
      const key = String(h.assetType);
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    // Sort rows within each category
    Object.keys(map).forEach(key => {
      map[key] = sortRows(map[key]);
    });
    return map;
  }, [enrichedData, groupByCategory, sortRows, sortedData]);
 
  // Summary totals
  const totals = React.useMemo(() => ({
    invested: enrichedData.reduce((s, h) => s + h.amtInvested, 0),
    value: enrichedData.reduce((s, h) => s + (h.currentValue || h.amtInvested), 0),
    gain: enrichedData.reduce((s, h) => s + h.overallGain, 0),
    todaysGain: enrichedData.reduce((s, h) => s + h.todaysGain, 0),
  }), [enrichedData]);
 
  const renderRow = (h: AssetHolding) => {
    const isNonUnitized = [130, 90, 110, 120, 140, 160, 170, 180, 210, 220].includes(h.assetType) ||
      (h.assetTypeName || '').toLowerCase().includes('ppf') ||
      (h.assetTypeName || '').toLowerCase().includes('epf') ||
      h.assetName.toLowerCase().startsWith('ppf') ||
      h.assetName.toLowerCase().startsWith('epf');

    return (
    <tr
      key={`${h.amid}-${h.assetId}`}
      onClick={() => onHoldingClick(h)}
      style={{ borderBottom: '1px solid var(--bbg-hover-bg)', cursor: 'pointer', transition: 'background 0.1s' }}
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
        {isNonUnitized ? '—' : fmtQty(h.quantity)}
      </td>
      {/* Avg Price */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '110px', fontSize: '13px', color: '#64748b' }}>
        {isNonUnitized ? '—' : (h.avgPrice > 0 ? fmt(h.avgPrice) : '—')}
      </td>
      {/* Amt Invested */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '130px', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
        {fmt(h.amtInvested, 0)}
      </td>
      {/* Current Price */}
      <td 
        style={{ padding: '3px 16px', textAlign: 'right', width: '110px', fontSize: '13px', color: (!isNonUnitized && h.currentPrice > 0) ? '#1e293b' : '#64748b', position: 'relative' }}
        onMouseEnter={e => {
          if (isNonUnitized) return;
          const btn = e.currentTarget.querySelector('.edit-price-btn') as HTMLElement;
          if (btn) btn.style.opacity = '1';
        }}
        onMouseLeave={e => {
          if (isNonUnitized) return;
          const btn = e.currentTarget.querySelector('.edit-price-btn') as HTMLElement;
          if (btn) btn.style.opacity = '0';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          {isNonUnitized ? (
            <span>—</span>
          ) : (
            <>
              <span>{h.currentPrice > 0 ? fmt(h.currentPrice) : (h.avgPrice > 0 ? fmt(h.avgPrice) : '—')}</span>
              {onSetPriceClick && (
                <button
                  className="edit-price-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPriceClick(h);
                  }}
                  style={{
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#2563eb',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Set Current Price"
                >
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </td>
      {/* Today's Gain */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '120px', fontSize: '13px', whiteSpace: 'nowrap' }}>
        {isNonUnitized ? (
          <span style={{ color: '#64748b' }}>—</span>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: gainColor(h.todaysGain) }}>
              {fmt(h.todaysGain, 0)}
            </span>
            <span style={{ fontSize: '11px', color: gainColor(h.todaysGainPct), marginLeft: '4px' }}>
              ({h.todaysGainPct >= 0 ? '+' : ''}{h.todaysGainPct.toFixed(2)}%)
            </span>
          </>
        )}
      </td>
      {/* Overall Gain */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '130px', fontSize: '13px', whiteSpace: 'nowrap' }}>
        {isNonUnitized ? (
          <span style={{ color: '#64748b' }}>—</span>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: gainColor(h.overallGain) }}>
              {fmt(h.overallGain, 0)}
            </span>
            <span style={{ fontSize: '11px', color: gainColor(h.overallGainPct), marginLeft: '4px' }}>
              ({h.overallGainPct >= 0 ? '+' : ''}{h.overallGainPct.toFixed(2)}%)
            </span>
          </>
        )}
      </td>
      {/* Current Value */}
      <td style={{ padding: '3px 16px', textAlign: 'right', width: '130px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
        {fmt(h.currentValue > 0 ? h.currentValue : h.amtInvested, 0)}
      </td>
    </tr>
  );
  };

 
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
          style={{ position: 'sticky', top: '31px', zIndex: 8, background: '#f1f5f9', cursor: 'pointer', borderBottom: '2px solid #cbd5e1' }}
        >
          <td style={{ padding: '6px 16px', fontWeight: 700, fontSize: '12px', color: '#334155' }} colSpan={3}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {label} ({rows.length})
            </div>
          </td>
          <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b' }} colSpan={1}>
            {fmt(totalInvested, 0)}
          </td>
          <td style={{ padding: '6px 16px' }} colSpan={1} />
          <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: gainColor(totalTodaysGain) }} colSpan={1}>
            {totalTodaysGain !== 0 ? fmt(totalTodaysGain, 0) : '—'}
          </td>
          <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: gainColor(totalGain) }} colSpan={1}>
            {totalValue > 0 ? fmt(totalGain, 0) : '—'}
          </td>
          <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#1e293b' }} colSpan={1}>
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
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#ffffff' }}>
            <tr>
              {COLS.map(col => {
                const isActive = sortColumn === col.key;
                return (
                  <th 
                    key={col.key} 
                    onClick={() => handleHeaderClick(col.key)}
                    style={{
                      position: 'sticky', top: 0, zIndex: 10, background: '#ffffff',
                      padding: '8px 16px', textAlign: col.align as any,
                      fontSize: '11px', fontWeight: 700, 
                      color: isActive ? '#2563eb' : '#475569',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      width: col.width, whiteSpace: 'nowrap',
                      borderBottom: isActive ? '2px solid #2563eb' : '2px solid #cbd5e1',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Sort by ${col.label} (${isActive && sortDir === 'asc' ? 'Descending' : 'Ascending'})`}
                    className="pms-sortable-th"
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start', width: '100%' }}>
                      <span>{col.label}</span>
                      <span style={{ fontSize: '10px', opacity: isActive ? 1 : 0.3, color: isActive ? '#2563eb' : '#94a3b8' }}>
                        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                );
              })}
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

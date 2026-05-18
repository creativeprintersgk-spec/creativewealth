import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabase';

type Row = {
  assetId: string;
  assetName: string;
  amid?: number;
  groupId: string;
  quantity: number;
  avgPrice: number;
  amtInvested: number;
  currentPrice: number;
  todaysGain: number;
  overallGain: number;
  currentValue: number;
  portfolioSplits: Array<{
    portfolioId: string;
    portfolioName: string;
    quantity: number;
    amtInvested: number;
  }>;
};

interface Props {
  data: Row[];
  onHoldingClick: (holding: Row) => void;
  groupByCategory?: boolean; // when true: MProfit-style category headers
  categoryLabels?: Record<string, string>; // groupId → display label
}

const COLS = [
  { label: 'Asset Name', key: 'assetName', align: 'left', width: '260px' },
  { label: 'Quantity', key: 'quantity', align: 'right', width: '90px' },
  { label: 'Avg Price', key: 'avgPrice', align: 'right', width: '110px' },
  { label: 'Amt Invested', key: 'amtInvested', align: 'right', width: '130px' },
  { label: 'Cur. Price', key: 'currentPrice', align: 'right', width: '110px' },
  { label: "Today's Gain", key: 'todaysGain', align: 'right', width: '120px' },
  { label: 'Overall Gain', key: 'overallGain', align: 'right', width: '130px' },
  { label: 'Cur. Value', key: 'currentValue', align: 'right', width: '130px' },
];

const fmt = (n: number, decimals = 2) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtQty = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

const gainColor = (n: number) => n >= 0 ? '#16a34a' : '#dc2626';

function getRefreshInterval(): number {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = ist.getHours()
  const m = ist.getMinutes()
  const day = ist.getDay()
  const minutes = h * 60 + m
  const isWeekend = day === 0 || day === 6
  const isMarketHours = !isWeekend && minutes >= 555 && minutes < 930
  return isMarketHours ? 60 * 1000 : 15 * 60 * 1000
}

export default function HoldingsGrid({ data, onHoldingClick, groupByCategory = false, categoryLabels = {} }: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [enrichedData, setEnrichedData] = useState<Row[]>(data);

  useEffect(() => {
    setEnrichedData(data);
    
    const fetchPrices = async () => {
      try {
        // Read from the view that already has all current prices joined
        const { data: priceRows, error } = await supabase
          .from('ledger_current_prices')
          .select('ledger_id, amid, current_price')

        if (error) {
          console.error('Price fetch error:', error.message)
          return
        }
        if (!priceRows?.length) return

        // Build lookup map by BOTH ledger_id and amid
        const priceByLedgerId = new Map<string, number>()
        const priceByAmid = new Map<number, number>()

        priceRows.forEach(p => {
          if (p.current_price && p.current_price > 0) {
            priceByLedgerId.set(p.ledger_id, parseFloat(p.current_price))
            if (p.amid) priceByAmid.set(p.amid, parseFloat(p.current_price))
          }
        })

        setEnrichedData(prev => prev.map(row => {
          // Try matching by ledgerId first, then by amid
          const livePrice = 
            (row.assetId ? priceByLedgerId.get(row.assetId) : null) ??
            (row.amid ? priceByAmid.get(row.amid) : null)

          if (!livePrice || livePrice === 0) return row

          const currentPrice = livePrice
          const currentValue = (row.quantity ?? 0) * currentPrice
          const overallGain = currentValue - (row.amtInvested ?? 0)
          const todaysGain = 0

          return { ...row, currentPrice, currentValue, overallGain, todaysGain }
        }))
      } catch (err) {
        console.error('fetchPrices error:', err)
      }
    }
    
    fetchPrices();
    const interval = setInterval(fetchPrices, getRefreshInterval());
    return () => clearInterval(interval);
  }, [data]);

  const toggleCategory = (cat: string) =>
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const isCatOpen = (cat: string) =>
    expandedCategories[cat] !== false; // default open

  const thStyle: React.CSSProperties = {
    borderBottom: '2px solid #e2e8f0',
    borderRight: '1px solid #f1f5f9',
    padding: '7px 10px',
    fontWeight: 700,
    fontSize: '11px',
    color: '#64748b',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: '#f8fafc',
    position: 'sticky',
    top: 0,
    zIndex: 2
  };

  const renderRow = (row: Row, idx: number) => (
    <tr
      key={row.assetId}
      onClick={() => onHoldingClick(row)}
      style={{
        cursor: 'pointer',
        background: idx % 2 === 0 ? '#fff' : '#fafafa',
        transition: 'background 0.1s'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
    >
      <td style={{ padding: '4px 10px', fontSize: '13px', fontWeight: 500, color: '#1e293b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {row.assetName}
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
        {fmtQty(row.quantity)}
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(row.avgPrice)}
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(row.amtInvested, 0)}
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(row.currentPrice)}
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: gainColor(row.todaysGain), fontVariantNumeric: 'tabular-nums' }}>
        <div>{fmt(row.todaysGain, 0)}</div>
        <div style={{ fontSize: '10px', opacity: 0.8 }}>
          {row.currentValue > 0 ? ((row.todaysGain / row.currentValue) * 100).toFixed(2) + '%' : '—'}
        </div>
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: gainColor(row.overallGain), fontVariantNumeric: 'tabular-nums' }}>
        <div>{fmt(row.overallGain, 0)}</div>
        <div style={{ fontSize: '10px', opacity: 0.8 }}>
          {row.amtInvested > 0 ? ((row.overallGain / row.amtInvested) * 100).toFixed(2) + '%' : '—'}
        </div>
      </td>
      <td style={{ padding: '4px 10px', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(row.currentValue, 0)}
      </td>
    </tr>
  );

  const renderCategoryHeader = (label: string, rows: Row[], catKey: string) => {
    const total = rows.reduce((a, r) => ({
      invested: a.invested + r.amtInvested,
      value: a.value + r.currentValue,
      gain: a.gain + r.overallGain,
      today: a.today + r.todaysGain,
    }), { invested: 0, value: 0, gain: 0, today: 0 });

    const isOpen = isCatOpen(catKey);

    return (
      <React.Fragment key={catKey}>
        <tr
          onClick={() => toggleCategory(catKey)}
          style={{ cursor: 'pointer', background: '#eef2ff', userSelect: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e0e7ff')}
          onMouseLeave={e => (e.currentTarget.style.background = '#eef2ff')}
        >
          {/* 1. Name */}
          <td style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 700, color: '#3730a3', borderBottom: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {label}
            <span style={{ fontSize: '10px', color: '#6366f1', background: '#e0e7ff', padding: '1px 6px', borderRadius: '99px', marginLeft: '4px' }}>
              {rows.length}
            </span>
          </td>
          {/* 2. Quantity */}
          <td style={{ borderBottom: '1px solid #c7d2fe' }} />
          {/* 3. Avg Price */}
          <td style={{ borderBottom: '1px solid #c7d2fe' }} />
          {/* 4. Amt Invested */}
          <td style={{ padding: '4px 10px', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #c7d2fe', fontWeight: 700, color: '#3730a3', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(total.invested, 0)}
          </td>
          {/* 5. Cur Price */}
          <td style={{ borderBottom: '1px solid #c7d2fe' }} />
          {/* 6. Today's Gain */}
          <td style={{ padding: '4px 10px', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #c7d2fe', color: gainColor(total.today), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(total.today, 0)}
          </td>
          {/* 7. Overall Gain */}
          <td style={{ padding: '4px 10px', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #c7d2fe', fontWeight: 700, color: gainColor(total.gain), fontVariantNumeric: 'tabular-nums' }}>
            {fmt(total.gain, 0)}
          </td>
          {/* 8. Cur Value */}
          <td style={{ padding: '4px 10px', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #c7d2fe', fontWeight: 800, color: '#3730a3', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(total.value, 0)}
          </td>
        </tr>
        {isOpen && rows.map((r, i) => renderRow(r, i))}
      </React.Fragment>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const categories = groupByCategory
    ? [...new Set(enrichedData.map(r => r.groupId))]
    : [];

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
        <colgroup>
          {COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
        </colgroup>
        <thead>
          <tr>
            {COLS.map(c => (
              <th key={c.key} style={{ ...thStyle, textAlign: c.align as any }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupByCategory
            ? categories.map(cat => {
                const rows = enrichedData.filter(r => r.groupId === cat);
                const label = categoryLabels[cat] || cat;
                return renderCategoryHeader(label, rows, cat);
              })
            : enrichedData.map((row, i) => renderRow(row, i))
          }
        </tbody>
      </table>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

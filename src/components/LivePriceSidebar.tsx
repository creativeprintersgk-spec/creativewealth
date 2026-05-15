/**
 * WealthCore — LivePriceSidebar.tsx
 * 
 * Shows live NSE/BSE stock prices and MF NAV in a collapsible sidebar panel.
 * - Stocks: Yahoo Finance (BSE scrip code + .BO suffix) — free, no API key
 * - MF NAV: mfapi.in — free, no API key
 * - Auto-refreshes every 5 minutes
 * - Watchlist stored in localStorage (user can add/remove symbols)
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WatchItem {
  amid: number
  name: string
  ticker: string
  asset_type: number   // 50=Stock, 60=MF
  bse_code: number | null
  amfi_code: number | null
}

interface LiveQuote {
  amid: number
  price: number
  change: number
  change_pct: number
  as_of: string
  loading: boolean
  error: boolean
}

// ─── Default watchlist (popular Indian stocks + MFs) ─────────────────────────
const DEFAULT_WATCHLIST: WatchItem[] = [
  { amid: 101605, name: 'Reliance Industries', ticker: 'RELIANCE', asset_type: 50, bse_code: 500325, amfi_code: null },
  { amid: 100540, name: 'HDFC Bank', ticker: 'HDFCBANK', asset_type: 50, bse_code: 500180, amfi_code: null },
  { amid: 100672, name: 'Infosys', ticker: 'INFY', asset_type: 50, bse_code: 500209, amfi_code: null },
  { amid: 100023, name: 'Bajaj Finance', ticker: 'BAJFINANCE', asset_type: 50, bse_code: 500034, amfi_code: null },
  { amid: 100539, name: 'TCS', ticker: 'TCS', asset_type: 50, bse_code: 532540, amfi_code: null },
  { amid: 219852, name: 'Mirae Asset Large Cap Fund - Growth', ticker: 'MF', asset_type: 60, bse_code: null, amfi_code: 118834 },
  { amid: 220111, name: 'Parag Parikh Flexi Cap Fund - Growth', ticker: 'MF', asset_type: 60, bse_code: null, amfi_code: 122639 },
]

// ─── Price fetchers ───────────────────────────────────────────────────────────

async function fetchStockQuote(bseCode: number): Promise<{ price: number; change: number; change_pct: number; as_of: string } | null> {
  try {
    const symbol = `${bseCode}.BO`
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null
    const price = meta.regularMarketPrice ?? meta.previousClose
    const prev = meta.previousClose ?? price
    const change = price - prev
    const change_pct = prev > 0 ? (change / prev) * 100 : 0
    return {
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      as_of: new Date(meta.regularMarketTime * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
  } catch {
    return null
  }
}

async function fetchMFNav(amfiCode: number): Promise<{ price: number; change: number; change_pct: number; as_of: string } | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}/latest`)
    if (!res.ok) return null
    const data = await res.json()
    const today = data?.data?.[0]
    const yesterday = data?.data?.[1]
    if (!today) return null
    const price = parseFloat(today.nav)
    const prev = yesterday ? parseFloat(yesterday.nav) : price
    const change = price - prev
    const change_pct = prev > 0 ? (change / prev) * 100 : 0
    return {
      price: parseFloat(price.toFixed(4)),
      change: parseFloat(change.toFixed(4)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      as_of: today.date,
    }
  } catch {
    return null
  }
}

// ─── Search component ─────────────────────────────────────────────────────────

function AssetSearch({ onAdd }: { onAdd: (item: WatchItem) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WatchItem[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('asset_master')
        .select('amid, name, asset_type, bse_code, amfi_code, ticker')
        .ilike('name', `%${query.trim()}%`)
        .in('asset_type', [50, 60])
        .limit(8)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <input
        type="text"
        placeholder="Search stock or MF..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '7px 10px',
          fontSize: 12,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          color: '#fff',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {(results.length > 0 || searching) && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#1a1f2e',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6,
          zIndex: 100,
          maxHeight: 220,
          overflowY: 'auto',
          marginTop: 2,
        }}>
          {searching && <div style={{ padding: '8px 12px', fontSize: 11, color: '#888' }}>Searching...</div>}
          {results.map(r => (
            <div
              key={r.amid}
              onClick={() => { onAdd(r); setQuery(''); setResults([]) }}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#e2e8f0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: r.asset_type === 60 ? 'rgba(99,153,255,0.2)' : 'rgba(72,199,142,0.2)',
                color: r.asset_type === 60 ? '#6399ff' : '#48c78e',
                flexShrink: 0,
              }}>{r.asset_type === 60 ? 'MF' : 'Stock'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LivePriceSidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const [watchlist, setWatchlist] = useState<WatchItem[]>(DEFAULT_WATCHLIST)
  const [quotes, setQuotes] = useState<Record<number, LiveQuote>>({})
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAllPrices = useCallback(async () => {
    setRefreshing(true)
    // Set all to loading
    setQuotes(prev => {
      const next = { ...prev }
      watchlist.forEach(item => {
        next[item.amid] = { ...(next[item.amid] || {}), amid: item.amid, loading: true, error: false, price: next[item.amid]?.price ?? 0, change: 0, change_pct: 0, as_of: '' }
      })
      return next
    })

    // Fetch in parallel, max 5 at a time
    const CHUNK = 5
    for (let i = 0; i < watchlist.length; i += CHUNK) {
      const chunk = watchlist.slice(i, i + CHUNK)
      await Promise.all(chunk.map(async item => {
        let result = null
        if (item.asset_type === 50 && item.bse_code) {
          result = await fetchStockQuote(item.bse_code)
        } else if (item.asset_type === 60 && item.amfi_code) {
          result = await fetchMFNav(item.amfi_code)
        }
        setQuotes(prev => ({
          ...prev,
          [item.amid]: {
            amid: item.amid,
            price: result?.price ?? 0,
            change: result?.change ?? 0,
            change_pct: result?.change_pct ?? 0,
            as_of: result?.as_of ?? '',
            loading: false,
            error: !result,
          }
        }))
      }))
    }
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    setRefreshing(false)
  }, [watchlist])

  // Fetch on mount and every 5 minutes
  useEffect(() => {
    fetchAllPrices()
    const interval = setInterval(fetchAllPrices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAllPrices])

  const removeItem = (amid: number) => {
    setWatchlist(prev => prev.filter(w => w.amid !== amid))
  }

  const addItem = (item: WatchItem) => {
    if (watchlist.find(w => w.amid === item.amid)) return
    setWatchlist(prev => [...prev, item])
  }

  // Sidebar collapsed button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          padding: '16px 6px',
          cursor: 'pointer',
          color: '#48c78e',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          zIndex: 50,
        }}
      >
        ₹ LIVE
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: 240,
      background: '#0b1020',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#48c78e', letterSpacing: '0.1em' }}>₹ LIVE PRICES</div>
          {lastUpdated && (
            <div style={{ fontSize: 9, color: '#4a5568', marginTop: 2 }}>Updated {lastUpdated}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={fetchAllPrices}
            disabled={refreshing}
            title="Refresh"
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: refreshing ? '#4a5568' : '#48c78e',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: 12,
              padding: '3px 7px',
            }}
          >
            {refreshing ? '...' : '↻'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: 12,
              padding: '3px 7px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <AssetSearch onAdd={addItem} />
      </div>

      {/* Watchlist */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {watchlist.map(item => {
          const q = quotes[item.amid]
          const isUp = (q?.change ?? 0) >= 0
          const color = q?.error ? '#4a5568' : isUp ? '#48c78e' : '#fc6d7a'

          return (
            <div
              key={item.amid}
              style={{
                padding: '8px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                position: 'relative',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Remove button */}
              <button
                onClick={() => removeItem(item.amid)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 8,
                  background: 'none',
                  border: 'none',
                  color: '#2d3748',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: 0,
                  lineHeight: 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fc6d7a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#2d3748')}
              >
                ✕
              </button>

              {/* Name */}
              <div style={{
                fontSize: 11,
                color: '#a0aec0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                paddingRight: 16,
                marginBottom: 4,
              }}>
                {item.name}
              </div>

              {/* Price row */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                {q?.loading ? (
                  <div style={{ fontSize: 11, color: '#4a5568' }}>Loading...</div>
                ) : q?.error ? (
                  <div style={{ fontSize: 11, color: '#4a5568' }}>Unavailable</div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                      ₹{q?.price?.toLocaleString('en-IN', { minimumFractionDigits: item.asset_type === 60 ? 4 : 2 })}
                    </div>
                    <div style={{ fontSize: 10, color, textAlign: 'right' }}>
                      <span>{isUp ? '▲' : '▼'} {Math.abs(q?.change ?? 0).toFixed(2)}</span>
                      <span style={{ marginLeft: 4, opacity: 0.8 }}>({Math.abs(q?.change_pct ?? 0).toFixed(2)}%)</span>
                    </div>
                  </>
                )}
              </div>

              {/* Type badge + time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: item.asset_type === 60 ? 'rgba(99,153,255,0.15)' : 'rgba(72,199,142,0.15)',
                  color: item.asset_type === 60 ? '#6399ff' : '#48c78e',
                }}>
                  {item.asset_type === 60 ? 'NAV' : 'BSE'}
                </span>
                {q?.as_of && !q.loading && (
                  <span style={{ fontSize: 9, color: '#4a5568' }}>{q.as_of}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 9,
        color: '#2d3748',
        textAlign: 'center',
      }}>
        BSE via Yahoo Finance · NAV via mfapi.in · Refreshes every 5 min
      </div>
    </div>
  )
}

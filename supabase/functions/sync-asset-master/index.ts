/**
 * WealthCore — Supabase Edge Function: sync-asset-master
 * 
 * Runs weekly (via Supabase Cron) to keep asset_master table updated.
 * Sources:
 * - Mutual Funds: api.mfapi.in (official AMFI data, free)
 * - Stocks: NSE equity master CSV (official NSE data, free)
 * 
 * Deploy: supabase functions deploy sync-asset-master
 * Cron: Set in Supabase Dashboard → Database → Cron Jobs
 *       Schedule: 0 0 * * 0 (Every Sunday midnight UTC = 5:30 AM IST)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ASSET_TYPE_NAMES: Record<number, string> = {
  50: 'Stocks',
  60: 'Mutual Funds',
}

// ─── Fetch all MF schemes from AMFI via mfapi.in ─────────────────────────────

async function syncMutualFunds(supabase: any): Promise<{ added: number; updated: number; errors: number }> {
  console.log('Fetching MF list from mfapi.in...')
  let added = 0, updated = 0, errors = 0

  try {
    const res = await fetch('https://api.mfapi.in/mf')
    if (!res.ok) throw new Error(`mfapi.in returned ${res.status}`)
    const schemes: { schemeCode: number; schemeName: string }[] = await res.json()
    console.log(`Fetched ${schemes.length} MF schemes from AMFI`)

    // Process in batches of 500
    const BATCH = 500
    for (let i = 0; i < schemes.length; i += BATCH) {
      const batch = schemes.slice(i, i + BATCH)
      const rows = batch.map(s => ({
        amid: 200000 + s.schemeCode, // offset to avoid collision with BSE AMIDs
        name: s.schemeName.trim(),
        asset_type: 60,
        asset_type_name: 'Mutual Funds',
        exchange_group: null,
        amfi_code: s.schemeCode,
        bse_code: null,
        nse_symbol: null,
        ticker: null,
      }))

      const { error } = await supabase
        .from('asset_master')
        .upsert(rows, {
          onConflict: 'amfi_code',        // update if amfi_code already exists
          ignoreDuplicates: false,
        })

      if (error) {
        console.error('MF batch upsert error:', error.message)
        errors++
      } else {
        added += batch.length
      }
    }
  } catch (err) {
    console.error('MF sync error:', err)
    errors++
  }

  return { added, updated, errors }
}

// ─── Fetch all stocks from NSE equity master CSV ──────────────────────────────

async function syncNSEStocks(supabase: any): Promise<{ added: number; updated: number; errors: number }> {
  console.log('Fetching NSE equity master...')
  let added = 0, updated = 0, errors = 0

  try {
    // NSE equity master CSV — updated daily by NSE
    const res = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.nseindia.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    if (!res.ok) throw new Error(`NSE returned ${res.status}`)
    const csv = await res.text()
    const lines = csv.split('\n').filter(l => l.trim())
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

    // NSE CSV columns: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
    const symbolIdx = header.findIndex(h => h === 'SYMBOL')
    const nameIdx = header.findIndex(h => h.includes('NAME'))
    const isinIdx = header.findIndex(h => h.includes('ISIN'))

    console.log(`NSE CSV: ${lines.length - 1} stocks, columns: ${header.join(', ')}`)

    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
      if (cols.length < 3) continue
      const symbol = cols[symbolIdx]?.trim()
      const name = cols[nameIdx]?.trim()
      const isin = cols[isinIdx]?.trim()
      if (!symbol || !name) continue

      rows.push({
        // Use a hash of symbol for amid since NSE doesn't have a numeric ID
        // We prefix with 300000 to avoid collision with BSE (100000s) and MF (200000s)
        amid: 300000 + Math.abs(symbol.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0) % 90000),
        name: name,
        asset_type: 50,
        asset_type_name: 'Stocks',
        exchange_group: null,
        amfi_code: null,
        bse_code: null,
        nse_symbol: symbol,
        ticker: symbol,
      })
    }

    // Upsert in batches of 500
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('asset_master')
        .upsert(batch, {
          onConflict: 'nse_symbol',
          ignoreDuplicates: false,
        })
      if (error) {
        console.error('NSE batch error:', error.message)
        errors++
      } else {
        added += batch.length
      }
    }
  } catch (err) {
    console.error('NSE sync error:', err)
    errors++
  }

  return { added, updated, errors }
}

// ─── Log sync result to a sync_log table ─────────────────────────────────────

async function logSync(supabase: any, results: any) {
  try {
    await supabase.from('asset_master_sync_log').upsert({
      id: 1,
      last_sync: new Date().toISOString(),
      mf_count: results.mf.added,
      stock_count: results.nse.added,
      errors: results.mf.errors + results.nse.errors,
    })
  } catch {
    // sync_log table may not exist yet — not critical
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Starting asset master sync...')
  const startTime = Date.now()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Run both syncs
  const [mfResult, nseResult] = await Promise.all([
    syncMutualFunds(supabase),
    syncNSEStocks(supabase),
  ])

  const results = {
    mf: mfResult,
    nse: nseResult,
    duration_ms: Date.now() - startTime,
    synced_at: new Date().toISOString(),
  }

  await logSync(supabase, results)

  console.log('Sync complete:', JSON.stringify(results))

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    // Use 5d range to get data even on weekends/holidays
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    })
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null

    // Get most recent valid price
    const price = meta.regularMarketPrice > 0
      ? meta.regularMarketPrice
      : meta.previousClose ?? meta.chartPreviousClose ?? 0

    return price > 0 ? parseFloat(price.toFixed(2)) : null
  } catch { return null }
}

async function fetchMFNav(amfiCode: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}/latest`)
    if (!res.ok) return null
    const data = await res.json()
    const nav = data?.data?.[0]?.nav
    return nav ? parseFloat(parseFloat(nav).toFixed(4)) : null
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get all investment ledgers linked to asset_master
  const { data: ledgers, error } = await supabase
    .from('ledgers')
    .select(`
      id,
      amid,
      asset_master (
        asset_type,
        bse_code,
        amfi_code,
        nse_symbol
      )
    `)
    .not('amid', 'is', null)

  if (error || !ledgers?.length) {
    return new Response(JSON.stringify({ error: 'No linked ledgers', detail: error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const results: { ledger_id: string; price: number }[] = []
  const errors: { ledger_id: string; reason: string }[] = []

  // Fetch all prices in parallel
  await Promise.all(ledgers.map(async (ledger: any) => {
    const am = ledger.asset_master
    if (!am) {
      errors.push({ ledger_id: ledger.id, reason: 'No asset_master' })
      return
    }

    let price: number | null = null

    if (am.asset_type === 60 && am.amfi_code) {
      // Mutual Fund — use mfapi.in
      price = await fetchMFNav(am.amfi_code)
    } else if (am.asset_type === 50) {
      // Stock — prefer NSE symbol, fall back to BSE code
      if (am.nse_symbol) {
        price = await fetchYahooPrice(`${am.nse_symbol}.NS`)
      }
      if (!price && am.bse_code) {
        price = await fetchYahooPrice(`${am.bse_code}.BO`)
      }
    }

    if (price !== null && price > 0) {
      results.push({ ledger_id: ledger.id, price })
    } else {
      errors.push({ ledger_id: ledger.id, reason: `No price fetched (type=${am.asset_type}, nse=${am.nse_symbol}, bse=${am.bse_code}, amfi=${am.amfi_code})` })
    }
  }))

  // Write all valid prices to prices table
  if (results.length > 0) {
    const rows = results.map(r => ({
      ledger_id: r.ledger_id,
      date: today,
      price: r.price,
    }))
    const { error: upsertError } = await supabase
      .from('prices')
      .upsert(rows, { onConflict: 'ledger_id,date' })
    if (upsertError) {
      errors.push({ ledger_id: 'UPSERT', reason: upsertError.message })
    }
  }

  // Handle on-demand requests from body (for index prices)
  let bodyResults: any[] = []
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.items?.length) {
      bodyResults = await Promise.all(body.items.map(async (item: any) => {
        let price = 0
        if (item.type === 'index') {
          price = await fetchYahooPrice(item.code) ?? 0
        } else if (item.type === 'nse') {
          price = await fetchYahooPrice(`${item.code}.NS`) ?? 0
        } else if (item.type === 'bse') {
          price = await fetchYahooPrice(`${item.code}.BO`) ?? 0
        } else if (item.type === 'mf') {
          price = await fetchMFNav(parseInt(item.code)) ?? 0
        }
        return { id: item.id, price, change: 0, change_pct: 0, as_of: today }
      }))
    }
  } catch { /* no body */ }

  return new Response(JSON.stringify({
    synced: results.length,
    errors,
    prices: results,
    results: bodyResults,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

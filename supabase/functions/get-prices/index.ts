import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function fetchYahooPrice(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null
    // Use regularMarketPrice, fall back to previousClose, then chartPreviousClose
    const price = (meta.regularMarketPrice > 0 ? meta.regularMarketPrice : null)
      ?? meta.previousClose
      ?? meta.chartPreviousClose
      ?? 0
      
    const prev = meta.previousClose ?? price
    const change = parseFloat((price - prev).toFixed(2))
    const change_pct = prev > 0 ? parseFloat(((change/prev)*100).toFixed(2)) : 0

    return { 
      price: price > 0 ? parseFloat(price.toFixed(2)) : null, 
      change, 
      change_pct 
    }
  } catch { return null }
}

async function fetchMFNav(amfiCode: number) {
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

  // Get all ledgers linked to asset_master
  const { data: ledgers, error } = await supabase
    .from('ledgers')
    .select(`
      id,
      amid,
      asset_master (
        asset_type,
        bse_code,
        amfi_code
      )
    `)
    .not('amid', 'is', null)

  if (error || !ledgers?.length) {
    return new Response(JSON.stringify({ error: 'No linked ledgers found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const results: { ledger_id: string; price: number }[] = []

  // Fetch prices in parallel
  await Promise.all(ledgers.map(async (ledger: any) => {
    const am = ledger.asset_master
    if (!am) return

    let price: number | null = null

    if (am.asset_type === 60 && am.amfi_code) {
      price = await fetchMFNav(am.amfi_code)
    } else if (am.asset_type === 50 && am.bse_code) {
      const res = await fetchYahooPrice(`${am.bse_code}.BO`)
      price = res ? res.price : null
    }

    if (price !== null && price > 0) {
      results.push({ ledger_id: ledger.id, price })
    }
  }))

  // Write all prices to prices table
  if (results.length > 0) {
    const rows = results.map(r => ({
      ledger_id: r.ledger_id,
      date: today,
      price: r.price,
    }))

    await supabase
      .from('prices')
      .upsert(rows, { onConflict: 'ledger_id,date' })
  }

  // Also handle manual items from request body (for on-demand fetching)
  let bodyResults: any[] = []
  try {
    const body = await req.json()
    if (body?.items?.length) {
      bodyResults = await Promise.all(body.items.map(async (item: any) => {
        let price = 0, change = 0, change_pct = 0
        if (item.type === 'index' || item.type === 'nse') {
          const res = await fetchYahooPrice(item.type === 'index' ? item.code : `${item.code}.NS`)
          if (res) {
            price = res.price ?? 0
            change = res.change
            change_pct = res.change_pct
          }
        } else if (item.type === 'bse') {
          const res = await fetchYahooPrice(`${item.code}.BO`)
          if (res) {
            price = res.price ?? 0
            change = res.change
            change_pct = res.change_pct
          }
        } else if (item.type === 'mf') {
          price = await fetchMFNav(parseInt(item.code)) ?? 0
        }
        return { id: item.id, price, change, change_pct, as_of: today }
      }))
    }
  } catch { /* no body or not JSON */ }

  return new Response(JSON.stringify({
    synced: results.length,
    results: bodyResults,
    prices: results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

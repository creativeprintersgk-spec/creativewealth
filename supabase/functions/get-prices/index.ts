import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function fetchYahooPrice(symbol: string, supabase: any, ledgerId: string): Promise<{ price: number; change: number; change_pct: number } | null> {
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
    const timestamp = data?.chart?.result?.[0]?.timestamp
    if (!meta) return null

    const price = meta.regularMarketPrice > 0
      ? meta.regularMarketPrice
      : meta.previousClose ?? meta.chartPreviousClose ?? 0

    const prevPrice = meta.previousClose ?? meta.chartPreviousClose ?? price
    const change = parseFloat((price - prevPrice).toFixed(2))
    const change_pct = prevPrice > 0 ? parseFloat(((change / prevPrice) * 100).toFixed(2)) : 0

    // Resolve dates
    let latestDate = new Date().toISOString().split('T')[0]
    let prevDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (timestamp && timestamp.length >= 2) {
      const tLatest = timestamp[timestamp.length - 1] * 1000
      const tPrev = timestamp[timestamp.length - 2] * 1000
      latestDate = new Date(tLatest).toISOString().split('T')[0]
      prevDate = new Date(tPrev).toISOString().split('T')[0]
    }

    if (ledgerId && supabase && !ledgerId.startsWith('index_')) {
      // Upsert previous close
      await supabase.from('prices').upsert(
        { ledger_id: ledgerId, date: prevDate, price: parseFloat(prevPrice.toFixed(2)) },
        { onConflict: 'ledger_id,date' }
      )

      // Upsert latest price
      await supabase.from('prices').upsert(
        { ledger_id: ledgerId, date: latestDate, price: parseFloat(price.toFixed(2)) },
        { onConflict: 'ledger_id,date' }
      )

      // Clean up any stale/duplicate records dated after latestDate
      await supabase.from('prices').delete().eq('ledger_id', ledgerId).gt('date', latestDate)
    }

    return price > 0 ? { price: parseFloat(price.toFixed(2)), change, change_pct } : null
  } catch { return null }
}

async function fetchMFNav(amfiCode: number, supabase: any, ledgerId: string): Promise<{ price: number; change: number; change_pct: number } | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}`)
    if (!res.ok) return null
    const data = await res.json()
    const today = data?.data?.[0]
    const yesterday = data?.data?.[1]
    if (!today) return null

    function parseDate(d: string): string {
      const [dd, mm, yyyy] = d.split('-')
      return `${yyyy}-${mm}-${dd}`
    }

    const todayDate = parseDate(today.date)
    const todayNav = parseFloat(today.nav)
    const yesterdayNav = yesterday ? parseFloat(yesterday.nav) : todayNav

    const change = parseFloat((todayNav - yesterdayNav).toFixed(4))
    const change_pct = yesterdayNav > 0 ? parseFloat(((change / yesterdayNav) * 100).toFixed(2)) : 0

    if (ledgerId && supabase && !ledgerId.startsWith('index_')) {
      // Store yesterday's NAV
      if (yesterday) {
        const yDate = parseDate(yesterday.date)
        await supabase.from('prices').upsert(
          { ledger_id: ledgerId, date: yDate, price: yesterdayNav },
          { onConflict: 'ledger_id,date' }
        )
      }

      // Store today's NAV
      await supabase.from('prices').upsert(
        { ledger_id: ledgerId, date: todayDate, price: todayNav },
        { onConflict: 'ledger_id,date' }
      )

      // Clean up any stale/duplicate records dated after todayDate
      await supabase.from('prices').delete().eq('ledger_id', ledgerId).gt('date', todayDate)
    }

    return { price: todayNav, change, change_pct }
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

    let priceObj: any = null

    if (am.asset_type === 60 && am.amfi_code) {
      // Mutual Fund — use mfapi.in
      priceObj = await fetchMFNav(am.amfi_code, supabase, ledger.id)
    } else if (am.asset_type === 50) {
      // Stock — prefer NSE symbol, fall back to BSE code
      if (am.nse_symbol) {
        priceObj = await fetchYahooPrice(`${am.nse_symbol}.NS`, supabase, ledger.id)
      }
      if (!priceObj && am.bse_code) {
        priceObj = await fetchYahooPrice(`${am.bse_code}.BO`, supabase, ledger.id)
      }
    }

    if (priceObj !== null && priceObj.price > 0) {
      results.push({ ledger_id: ledger.id, price: priceObj.price })
    } else {
      errors.push({ ledger_id: ledger.id, reason: `No price fetched (type=${am.asset_type}, nse=${am.nse_symbol}, bse=${am.bse_code}, amfi=${am.amfi_code})` })
    }
  }))

  // Handle on-demand requests from body (for index prices and sidebar)
  let bodyResults: any[] = []
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.items?.length) {
      bodyResults = await Promise.all(body.items.map(async (item: any) => {
        let priceObj: any = { price: 0, change: 0, change_pct: 0 }
        if (item.type === 'index') {
          priceObj = await fetchYahooPrice(item.code, supabase, item.id) ?? priceObj
        } else if (item.type === 'nse') {
          priceObj = await fetchYahooPrice(`${item.code}.NS`, supabase, item.id) ?? priceObj
        } else if (item.type === 'bse') {
          priceObj = await fetchYahooPrice(`${item.code}.BO`, supabase, item.id) ?? priceObj
        } else if (item.type === 'mf') {
          priceObj = await fetchMFNav(parseInt(item.code), supabase, item.id) ?? priceObj
        }
        return { id: item.id, price: priceObj.price, change: priceObj.change, change_pct: priceObj.change_pct, as_of: today }
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchTickerTape(sids: string[]): Promise<any> {
  try {
    const url = "https://quotes-api.tickertape.in/quotes?sids=${sids.join(',')}"
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const today = new Date().toISOString().split('T')[0]
  
  let bodyResults: any[] = []
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.items?.length) {
      // Collect sids
      const sidMap = new Map<string, any>()
      body.items.forEach((item: any) => {
        let sid = item.code
        if (item.type === 'index' && item.code === '^NSEI') sid = '.NSEI'
        if (item.type === 'index' && item.code === '^BSESN') sid = '.BSESN'
        sidMap.set(sid, item)
      })

      const data = await fetchTickerTape(Array.from(sidMap.keys()))
      if (data?.data) {
        data.data.forEach((quote: any) => {
          const item = sidMap.get(quote.sid)
          if (item) {
            bodyResults.push({
              id: item.id,
              price: quote.price,
              change: quote.dyChange ? parseFloat(((quote.dyChange / 100) * quote.c).toFixed(2)) : quote.change,
              change_pct: quote.dyChange || 0,
              as_of: today
            })
          }
        })
      }
    }
  } catch {}

  return new Response(JSON.stringify({ results: bodyResults }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

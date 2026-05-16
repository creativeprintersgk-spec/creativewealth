import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch all unique AMIDs from ledgers that have one assigned
    const { data: linkedAmids, error: ledgerError } = await supabase
      .from('ledgers')
      .select('amid')
      .not('amid', 'is', null)

    if (ledgerError) throw ledgerError

    const uniqueAmids = [...new Set(linkedAmids.map(l => l.amid))]
    
    if (uniqueAmids.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No linked assets to sync.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Fetch asset details for these AMIDs
    const { data: assets, error: fetchError } = await supabase
      .from('asset_master')
      .select('amid, name, asset_type, bse_code, amfi_code')
      .in('amid', uniqueAmids)
      .or('bse_code.not.is.null,amfi_code.not.is.null')

    if (fetchError) throw fetchError

    console.log(`Checking prices for ${assets.length} assets...`)

    const results = []
    const CHUNK_SIZE = 5 // Small batches for external APIs
    
    for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
      const chunk = assets.slice(i, i + CHUNK_SIZE)
      const batchResults = await Promise.all(chunk.map(async (asset) => {
        let priceData = null
        
        if (asset.asset_type === 50 && asset.bse_code) {
          priceData = await fetchStockPrice(asset.bse_code)
        } else if (asset.asset_type === 60 && asset.amfi_code) {
          priceData = await fetchMFNav(asset.amfi_code)
        }

        if (priceData) {
          // Find all ledgers linked to this amid to update their price history
          const { data: linkedLedgers } = await supabase
            .from('ledgers')
            .select('id')
            .eq('amid', asset.amid)

          if (linkedLedgers && linkedLedgers.length > 0) {
            const priceEntries = linkedLedgers.map(l => ({
              ledger_id: l.id,
              date: new Date().toISOString().split('T')[0],
              price: priceData.price
            }))
            
            const { error: upsertError } = await supabase
              .from('prices')
              .upsert(priceEntries, { onConflict: 'ledger_id,date' })
            
            if (upsertError) console.error(`Error upserting prices for ${asset.name}:`, upsertError.message)
          }

          return { amid: asset.amid, name: asset.name, ...priceData, linked_count: linkedLedgers?.length || 0 }
        }
        return null
      }))
      results.push(...batchResults.filter(r => r !== null))
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: results.length, 
      timestamp: new Date().toISOString(),
      data: results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function fetchStockPrice(bseCode: number) {
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
      source: 'yahoo'
    }
  } catch (e) {
    console.error(`Error fetching stock ${bseCode}:`, e)
    return null
  }
}

async function fetchMFNav(amfiCode: number) {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}/latest`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.data?.[0]) return null
    
    const today = data.data[0]
    const yesterday = data.data[1]
    const price = parseFloat(today.nav)
    const prev = yesterday ? parseFloat(yesterday.nav) : price
    const change = price - prev
    const change_pct = prev > 0 ? (change / prev) * 100 : 0
    
    return {
      price: parseFloat(price.toFixed(4)),
      change: parseFloat(change.toFixed(4)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      as_of: today.date,
      source: 'mfapi'
    }
  } catch (e) {
    console.error(`Error fetching MF ${amfiCode}:`, e)
    return null
  }
}

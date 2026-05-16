import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '' // Use service role if available for bulk updates
const supabase = createClient(supabaseUrl, supabaseKey)

async function linkLedgersToAssets() {
  console.log('🔍 Starting Automated Data Linking...')

  // 1. Fetch all ledgers that are likely assets (investments, stocks, mf)
  const { data: ledgers, error: ledgerError } = await supabase
    .from('ledgers')
    .select('id, name, group_id, amid')
    // We only care about ledgers that don't have an amid yet
    .is('amid', null)

  if (ledgerError) {
    console.error('Error fetching ledgers:', ledgerError)
    return
  }

  console.log(`Found ${ledgers.length} ledgers without amid.`)

  let linkedCount = 0

  for (const ledger of ledgers) {
    // Basic cleaning of ledger name for matching
    // e.g. "Reliance Industries Ltd" -> "Reliance Industries"
    const searchName = ledger.name.split('(')[0].trim()
    
    console.log(`Searching for: ${searchName}...`)

    const { data: matches, error: matchError } = await supabase
      .from('asset_master')
      .select('amid, name')
      .ilike('name', `%${searchName}%`)
      .limit(1)

    if (matchError) {
      console.error(`Error searching for ${searchName}:`, matchError)
      continue
    }

    if (matches && matches.length > 0) {
      const bestMatch = matches[0]
      console.log(`✅ Match found: "${ledger.name}" -> "${bestMatch.name}" (amid: ${bestMatch.amid})`)

      const { error: updateError } = await supabase
        .from('ledgers')
        .update({ amid: bestMatch.amid })
        .eq('id', ledger.id)

      if (updateError) {
        console.error(`Failed to update ledger ${ledger.id}:`, updateError)
      } else {
        linkedCount++
      }
    } else {
      console.log(`❌ No match found for "${searchName}"`)
    }
  }

  console.log(`\n🎉 Data Linking Complete!`)
  console.log(`Linked ${linkedCount} out of ${ledgers.length} ledgers.`)
}

linkLedgersToAssets()

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Map of amid to NSE symbol and ISIN for the 20 CN stocks
const cnStocks = [
  { amid: 102791, symbol: 'AUROPHARMA', name: 'Aurobindo Pharma' },
  { amid: 253791, symbol: 'ABSLAMC', name: 'Aditya Birla Sun Life AMC Limited' },
  { amid: 253886, symbol: 'ANANDRATHI', name: 'Anand Rathi Wealth Limited' },
  { amid: 254030, symbol: 'BANKINDIA', name: 'Bank of India' },
  { amid: 254076, symbol: 'BHEL', name: 'Bharat Heavy Electricals Limited' },
  { amid: 254119, symbol: 'BPCL', name: 'Bharat Petroleum Corporation Limited' },
  { amid: 254140, symbol: 'CANBK', name: 'Canara Bank' },
  { amid: 254204, symbol: 'COALINDIA', name: 'Coal India Limited' },
  { amid: 254501, symbol: 'GICRE', name: 'General Insurance Corporation of India' },
  { amid: 254634, symbol: 'HFCL', name: 'HFCL Limited' },
  { amid: 254647, symbol: 'HINDPETRO', name: 'Hindustan Petroleum Corporation Limited' },
  { amid: 254741, symbol: 'INDUSTOWER', name: 'Indus Towers Limited' },
  { amid: 254761, symbol: 'IOC', name: 'Indian Oil Corporation Limited' },
  { amid: 255147, symbol: 'MSUMI', name: 'Motherson Sumi Wiring India Limited' },
  { amid: 255214, symbol: 'NIACL', name: 'The New India Assurance Company Limited' },
  { amid: 255274, symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Limited' },
  { amid: 255475, symbol: 'RECLTD', name: 'REC Limited' },
  { amid: 255530, symbol: 'RRKABEL', name: 'R R Kabel Limited' },
  { amid: 256104, symbol: 'WIPRO', name: 'Wipro Limited' },
  { amid: 605726, symbol: 'NXST', name: 'Nexus Select Trust' },
];

async function run() {
  console.log('=== Step 1: Fix sum_table quantities and amounts for Saahil Inv (pfid=1) ===');
  
  // 1. Fetch exact bs1 holdings for pfid=1
  const { data: bs1Rows } = await supabase.from('bs1').select('*').eq('pfid', 1);
  
  // Compute net quantity and cost per amid from bs1
  const bs1Summary = {};
  bs1Rows?.forEach(b => {
    if (!bs1Summary[b.amid]) bs1Summary[b.amid] = { qn: 0, amt: 0 };
    if (b.trty === 20 || b.trty === 10 || b.trty === 40) {
      bs1Summary[b.amid].qn += Number(b.qn || 0);
      bs1Summary[b.amid].amt += Number(b.amt || (b.qn * b.purpr) || 0);
    } else if (b.trty === 21 || b.trty === 101) {
      bs1Summary[b.amid].qn -= Number(b.qn || 0);
      bs1Summary[b.amid].amt -= Number(b.amt || 0);
    }
  });

  // For each CN stock, set sum_table to exact bs1Summary values
  for (const s of cnStocks) {
    const summary = bs1Summary[s.amid];
    if (summary) {
      const { error } = await supabase
        .from('sum_table')
        .update({
          qnt: summary.qn,
          amtinv: summary.amt,
        })
        .eq('pfolio_id', 1)
        .eq('amid', s.amid);
      
      if (error) {
        console.error(`Error updating sum_table for amid=${s.amid}:`, error.message);
      } else {
        console.log(`✅ Fixed sum_table: pfid=1 amid=${s.amid} (${s.name}) -> qnt=${summary.qn}, amtinv=₹${summary.amt.toFixed(2)}`);
      }
    }
  }

  console.log('\n=== Step 2: Fetch Live Prices from Yahoo Finance & save to mprices ===');
  const todayStr = '2026-08-15';
  const priceRows = [];

  for (const s of cnStocks) {
    const ticker = `${s.symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      if (res.ok) {
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice || 0;
        const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? price;
        if (price > 0) {
          console.log(`📈 Fetched ${s.symbol} (${s.name}): CMP = ₹${price}, Prev = ₹${prev}`);
          priceRows.push({
            amid: s.amid,
            currp: price,
            prevp: prev,
            date: todayStr,
            source_id_atyp: 50
          });
        } else {
          console.warn(`⚠️ Zero price for ${s.symbol}`);
        }
      } else {
        console.warn(`❌ Failed to fetch ${ticker}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`❌ Error fetching ${ticker}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  if (priceRows.length > 0) {
    console.log(`\nSaving ${priceRows.length} price records to mprices...`);
    const amids = priceRows.map(p => p.amid);
    
    // Delete existing records for today
    await supabase.from('mprices').delete().eq('date', todayStr).in('amid', amids);

    // Insert new records
    const { error: insErr } = await supabase.from('mprices').insert(priceRows);
    if (insErr) {
      console.error('Error inserting mprices:', insErr.message);
    } else {
      console.log(`✅ Successfully saved ${priceRows.length} live prices into mprices table!`);
    }
  }

  console.log('\n=== Step 3: Verification ===');
  const { data: finalSums } = await supabase
    .from('sum_table')
    .select('amid, qnt, amtinv')
    .eq('pfolio_id', 1)
    .in('amid', cnStocks.map(s => s.amid));
  
  console.log('Final sum_table for Saahil Inv (pfid=1):');
  finalSums?.forEach(f => {
    const s = cnStocks.find(x => x.amid === f.amid);
    console.log(`  amid=${f.amid} ${s?.name?.padEnd(40)}: qnt=${f.qnt}, amtinv=₹${f.amtinv}`);
  });
}

run().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function checkStockLedgers() {
  // Find Stocks group for acid=31
  const { data: groups } = await supabase.from('acmac1').select('*').eq('acid', 31).eq('is_group', true);
  const stockGroup = groups?.find(g => g.name.toLowerCase().includes('stock'));
  console.log('Stock group in acid=31:', stockGroup);

  // Check which of the 20 CN stocks already have a ledger in acmac1 for acid=31
  const cnStocks = [
    { transid: 30836, amid: 253791, symbol: 'ABSLAMC', name: 'Aditya Birla Sun Life AMC Limited', amt: 3027.7 },
    { transid: 30837, amid: 253886, symbol: 'ANANDRATHI', name: 'Anand Rathi Wealth Limited', amt: 2134.3 },
    { transid: 30838, amid: 102791, symbol: 'AUROPHARMA', name: 'Aurobindo Pharma', amt: 3287.4 },
    { transid: 30839, amid: 254030, symbol: 'BANKINDIA', name: 'Bank of India', amt: 2666.27 },
    { transid: 30840, amid: 254076, symbol: 'BHEL', name: 'Bharat Heavy Electricals Limited', amt: 2838.5 },
    { transid: 30841, amid: 254119, symbol: 'BPCL', name: 'Bharat Petroleum Corporation Limited', amt: 2861.1 },
    { transid: 30842, amid: 254140, symbol: 'CANBK', name: 'Canara Bank', amt: 2699.76 },
    { transid: 30843, amid: 254204, symbol: 'COALINDIA', name: 'Coal India Limited', amt: 2881.2 },
    { transid: 30844, amid: 254501, symbol: 'GICRE', name: 'General Insurance Corporation of India', amt: 2838.8 },
    { transid: 30845, amid: 254634, symbol: 'HFCL', name: 'HFCL Limited', amt: 2737.15 },
    { transid: 30846, amid: 254647, symbol: 'HINDPETRO', name: 'Hindustan Petroleum Corporation Limited', amt: 2750.3 },
    { transid: 30847, amid: 254741, symbol: 'INDUSTOWER', name: 'Indus Towers Limited', amt: 2629.2 },
    { transid: 30848, amid: 254761, symbol: 'IOC', name: 'Indian Oil Corporation Limited', amt: 2809.0 },
    { transid: 30849, amid: 255147, symbol: 'MSUMI', name: 'Motherson Sumi Wiring India Limited', amt: 2758.64 },
    { transid: 30850, amid: 255214, symbol: 'NIACL', name: 'The New India Assurance Company Limited', amt: 2859.87 },
    { transid: 30851, amid: 605726, symbol: 'NXST', name: 'Nexus Select Trust', amt: 2706.72 },
    { transid: 30852, amid: 255274, symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Limited', amt: 2902.32 },
    { transid: 30853, amid: 255475, symbol: 'RECLTD', name: 'REC Limited', amt: 2739.2 },
    { transid: 30854, amid: 255530, symbol: 'RRKABEL', name: 'R R Kabel Limited', amt: 2773.3 },
    { transid: 30855, amid: 256104, symbol: 'WIPRO', name: 'Wipro Limited', amt: 2776.8 },
  ];

  console.log('\n--- Checking existing ledgers in acmac1 for acid=31 ---');
  for (const s of cnStocks) {
    const { data: existing } = await supabase
      .from('acmac1')
      .select('*')
      .eq('acid', 31)
      .ilike('name', `%${s.symbol}%`);
    
    const { data: existingByName } = await supabase
      .from('acmac1')
      .select('*')
      .eq('acid', 31)
      .ilike('name', `%${s.name.slice(0, 8)}%`);

    console.log(`${s.symbol} (${s.name}):`, existing?.length ? existing : (existingByName?.length ? existingByName : 'NONE'));
  }
}

checkStockLedgers().catch(console.error);

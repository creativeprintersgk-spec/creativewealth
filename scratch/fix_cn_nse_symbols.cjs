const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// ISIN -> NSE symbol mapping from the contract note
// These are the stocks from the Zerodha CN dated 2026-08-11
const isinToNse = {
  'INE404A01024': 'ABSLAMC',
  'INE463V01026': 'ANANDRATHI',
  'INE406A01037': 'AUROPHARMA',
  'INE084A01016': 'BANKINDIA',
  'INE257A01026': 'BHEL',
  'INE029A01011': 'BPCL',
  'INE476A01022': 'CANBK',
  'INE522F01014': 'COALINDIA',
  'INE481Y01014': 'GICRE',
  'INE548A01028': 'HFCL',
  'INE094A01015': 'HINDPETRO',
  'INE121J01017': 'INDUSTOWER',
  'INE242A01010': 'IOC',
  'INE0FS801015': 'MSUMI',
  'INE470Y01017': 'NIACL',
  'INE0NDH25011': 'NXST',
  'INE213A01029': 'ONGC',
  'INE020B01018': 'RECLTD',
  'INE777K01022': 'RRKABEL',
  'INE075A01022': 'WIPRO',
};

const amidIsinMap = {
  253791: 'INE404A01024',
  253886: 'INE463V01026',
  253975: 'INE406A01037',
  254030: 'INE084A01016',
  254076: 'INE257A01026',
  254119: 'INE029A01011',
  254140: 'INE476A01022',
  254204: 'INE522F01014',
  254501: 'INE481Y01014',
  254634: 'INE548A01028',
  254647: 'INE094A01015',
  254741: 'INE121J01017',
  254761: 'INE242A01010',
  255147: 'INE0FS801015',
  255214: 'INE470Y01017',
  255274: 'INE213A01029',
  255475: 'INE020B01018',
  255530: 'INE777K01022',
  256104: 'INE075A01022',
  605726: 'INE0NDH25011',
};

// Proper company names from NSE
const nseToFullName = {
  'ABSLAMC': 'Aditya Birla Sun Life AMC Limited',
  'ANANDRATHI': 'Anand Rathi Wealth Limited',
  'AUROPHARMA': 'Aurobindo Pharma Limited',
  'BANKINDIA': 'Bank of India',
  'BHEL': 'Bharat Heavy Electricals Limited',
  'BPCL': 'Bharat Petroleum Corporation Limited',
  'CANBK': 'Canara Bank',
  'COALINDIA': 'Coal India Limited',
  'GICRE': 'General Insurance Corporation of India',
  'HFCL': 'HFCL Limited',
  'HINDPETRO': 'Hindustan Petroleum Corporation Limited',
  'INDUSTOWER': 'Indus Towers Limited',
  'IOC': 'Indian Oil Corporation Limited',
  'MSUMI': 'Motherson Sumi Wiring India Limited',
  'NIACL': 'The New India Assurance Company Limited',
  'NXST': 'Nexus Select Trust',
  'ONGC': 'Oil & Natural Gas Corporation Limited',
  'RECLTD': 'REC Limited',
  'RRKABEL': 'R R Kabel Limited',
  'WIPRO': 'Wipro Limited',
};

async function fixNseSymbols() {
  console.log('Fixing nse_symbol for all 20 CN-imported stocks...\n');
  
  for (const [amidStr, isin] of Object.entries(amidIsinMap)) {
    const amid = Number(amidStr);
    const nseSymbol = isinToNse[isin];
    const fullName = nseToFullName[nseSymbol];
    
    if (!nseSymbol) {
      console.log(`  SKIP amid=${amid} isin=${isin} - no NSE symbol found`);
      continue;
    }
    
    const { error } = await supabase
      .from('asset_master')
      .update({ nse_symbol: nseSymbol })
      .eq('amid', amid);
    
    if (error) {
      console.error(`  ERROR amid=${amid}: ${error.message}`);
    } else {
      console.log(`  ✅ amid=${amid} "${fullName}" -> nse_symbol=${nseSymbol}`);
    }
  }
  
  console.log('\nAll done! Now checking if Aurobindo is duplicated in sum_table/bs1...');
  
  // Check: does the existing Aurobindo Pharma (old holdings) use a different amid?
  const { data: auro } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, isin')
    .ilike('name', '%auropharma%')
    .or('nse_symbol.ilike.%auro%');
  console.log('\nAll Aurobindo records:', JSON.stringify(auro, null, 2));

  // Check bs1 for Aurobindo
  const { data: bsAuro } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, qn, purpr, dt, narr')
    .or(`amid.eq.253975,amid.eq.3049`)  // 3049 is common Aurobindo Pharma amid
    .order('dt', { ascending: false });
  console.log('\nAurobindo bs1:', JSON.stringify(bsAuro, null, 2));
}

fixNseSymbols().catch(console.error);

const fs = require('fs');

async function debugHoldings() {
  const st = JSON.parse(fs.readFileSync('public/snapshot/sum_table.json', 'utf8'));
  const am = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));
  const sam = JSON.parse(fs.readFileSync('public/snapshot/sam.json', 'utf8'));
  const amMap = new Map(am.map(a => [a.amid, a]));
  const samMap = new Map(sam.map(s => [s.amid, s]));

  const uniqueAmids = Array.from(new Set(st.filter(s => s.qnt > 0.0001 || s.currv > 0.01).map(s => s.amid)));

  console.log('Total active amids:', uniqueAmids.length);

  // Load the test_candidates list or test each asset with our local dev server
  const testNames = [
    'DSP BSE Liquid Rate ETF',
    'Eternal',
    'Latent View Analytics',
    'BSE Ltd',
    'Shilpa Medicare',
    'Jeena Sikho Lifecare',
    'Apollo Hospitals',
    'Kalyan Jewellers India',
    'GE Vernova T&D India',
    'ICICI Prudential Asset Management Company',
    'Adani Energy Solutions',
    'Vishal Mega Mart',
    'Rategain Travel Technologies',
    'Godrej Properties',
    'Lenskart Solutions',
    'Lloyds Metals and Energy',
    'FSN E-Commerce Ventures',
    'V2 Retail',
    'Nippon Life India Asset Management',
    'Solar Industries India',
    'Sky Gold And Diamonds',
    'Rashi Peripherals',
    'Meesho',
    'Tarc',
    'Stove Kraft',
    'Gujarat Alkalies & Chemicals',
    'BF Investment',
    'Updater Services',
    'Sportking India',
    'Rishabh Instruments',
    'IRM Energy',
    'Zuari Agro Chemicals',
    'Uniparts India',
    'BCL Industries',
    'MSP Steel & Power',
    'Confidence Petroleum',
    'PDS Ltd',
    'Andhra Sugars',
    'Bhansali Engineering Polymers',
    'Delhivery',
    'Trent Limited',
    'MTAR Technologies',
    'Electronics Mart India',
    'Rolex Rings',
    'Aditya Birla Sun Life AMC',
    'Mangalam Worldwide',
    'New India Assurance Company',
    'Motherson Sumi Wiring India',
    'Nexus Select Trust',
    'Jio Financial Services',
    'Anand Rathi Wealth',
    'Ethos',
    'NHC Foods',
    'Mayur Floorings',
    'Organic Coatings',
    'Stephanotis Finance',
    'Lords Mark Industries',
    '7.72 GS 2055',
    'UP POWER CORPORATION',
    'RBI BOND 7.75 %',
    'Andhra Pradesh State Beverages Corporation NCD N0 9.15% 30/11/2034 (ISIN INE0M2307412)',
    'G-Sec 6.67% GS 2035 (ISIN IN0020210152)'
  ];

  for (const name of testNames) {
    // Find amid
    let found = null;
    for (const id of uniqueAmids) {
      const a = amMap.get(id);
      if (a && a.name.toLowerCase().includes(name.toLowerCase())) {
        found = a;
        break;
      }
      const s = samMap.get(id);
      if (s && s.anm.toLowerCase().includes(name.toLowerCase())) {
        found = { amid: s.amid, name: s.anm, asset_type: s.atyp, nse_symbol: s.alias, bse_code: s.exint1, amfi_code: s.exint2, isin: s.extstr };
        break;
      }
    }

    if (!found) {
      console.log('NOT FOUND in snapshot for query:', name);
      continue;
    }

    console.log(`[AMID: ${found.amid}] "${found.name}" | NSE: ${found.nse_symbol} | BSE: ${found.bse_code} | Ticker: ${found.ticker}`);
  }
}

debugHoldings();

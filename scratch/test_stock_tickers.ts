import https from 'https';

function fetchYahoo(symbol: string): Promise<any> {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const meta = json?.chart?.result?.[0]?.meta;
          resolve({ symbol, price: meta?.regularMarketPrice, prev: meta?.previousClose });
        } catch { resolve({ symbol, error: true }); }
      });
    }).on('error', () => resolve({ symbol, error: true }));
  });
}

async function test() {
  console.log('=== TESTING YAHOO SYMBOLS FOR MAYUR, ORGANIC, OIL COUNTRY, LLOYDS ===');
  const symbols = ['MAYURFL.BO', '531221.BO', 'ORGANIC.BO', '531157.BO', 'OILCOUNTUB.NS', 'LLOYDSENGG.NS'];
  for (const s of symbols) {
    const res = await fetchYahoo(s);
    console.log(s.padEnd(15), 'Result:', res);
  }
}
test();

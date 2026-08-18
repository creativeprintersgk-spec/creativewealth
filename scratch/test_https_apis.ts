import https from 'https';

function fetchUrl(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== TESTING HTTPS FETCH FOR NIPPON MULTI ASSET & L&T FINANCE ===');

  try {
    const mfData = await fetchUrl('https://api.mfapi.in/mf/148457');
    console.log('Nippon Multi Asset (148457) NAV:', mfData?.meta?.scheme_name, '-> Latest NAV:', mfData?.data?.[0]);
  } catch (e) {
    console.error('MF error:', e);
  }

  try {
    const stockData = await fetchUrl('https://query1.finance.yahoo.com/v8/finance/chart/LTF.NS?interval=1d&range=5d', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });
    const meta = stockData?.chart?.result?.[0]?.meta;
    console.log('L&T Finance (LTF.NS) Price:', meta?.symbol, '-> Price:', meta?.regularMarketPrice, 'PrevClose:', meta?.previousClose);
  } catch (e) {
    console.error('Yahoo error:', e);
  }
}
run();

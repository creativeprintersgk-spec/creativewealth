import fetch from 'node-fetch';

async function testFetch() {
  console.log('=== TESTING API FETCH FOR L&T FINANCE & NIPPON MULTI ASSET ===');

  // 1. Nippon India Multi Asset Fund (AMFI Code 148457)
  try {
    const mfRes = await fetch('https://api.mfapi.in/mf/148457');
    const mfData = await mfRes.json();
    console.log('Nippon Multi Asset (148457) NAV:', mfData?.meta?.scheme_name, '-> Latest NAV:', mfData?.data?.[0]);
  } catch (e) {
    console.error('MF fetch error:', e);
  }

  // 2. L&T Finance (Yahoo symbol LTF.NS)
  try {
    const stockRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/LTF.NS?interval=1d&range=5d', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const stockData = await stockRes.json();
    const meta = stockData?.chart?.result?.[0]?.meta;
    console.log('L&T Finance (LTF.NS) Price:', meta?.symbol, '-> Price:', meta?.regularMarketPrice, 'PrevClose:', meta?.previousClose);
  } catch (e) {
    console.error('Stock fetch error:', e);
  }
}
testFetch();

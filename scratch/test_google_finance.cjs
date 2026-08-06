async function test(symbol) {
  const url = `https://www.google.com/finance/quote/${symbol}:NSE`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const matchPriceVal = html.match(/data-last-price="([0-9.]+)"/);
    console.log(symbol, 'data-last-price match:', matchPriceVal ? matchPriceVal[1] : 'null');
    
    const priceText = html.match(/class="YMl7ss"[^>]*>₹?([0-9,.]+)</);
    console.log(symbol, 'class="YMl7ss" match:', priceText ? priceText[1] : 'null');
  } catch (e) {
    console.log(symbol, 'failed:', e.message);
  }
}

async function run() {
  await test('610GS2031');
  await test('SGB192010');
  await test('SGBMAR28');
  await test('SGBMAR28VIII');
}
run();

async function test(isin) {
  const url = `https://www.wintwealth.com/bonds/government-of-india/${isin}/`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.ok ? await res.text() : '';
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      const json = JSON.parse(match[1]);
      const pageProps = json.props?.pageProps;
      console.log(`=== ISIN ${isin} PageProps Keys: ===`, Object.keys(pageProps || {}));
      if (pageProps?.bondDetails) {
        console.log('bondDetails:', JSON.stringify(pageProps.bondDetails, null, 2));
      } else {
        // search for ISIN in the keys
        console.log('Keys of interest:');
        for (const k in pageProps) {
          if (typeof pageProps[k] === 'object' && pageProps[k] !== null) {
            console.log(`- ${k}:`, Object.keys(pageProps[k]));
            if (pageProps[k].isin === isin || pageProps[k].isinCode === isin) {
              console.log('Found bond in key:', k, pageProps[k]);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(isin, 'failed:', e.message);
  }
}

async function run() {
  await test('IN0020210095');
}
run();

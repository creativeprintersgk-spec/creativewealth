async function testProxy() {
  const symbol = '^NSEI';
  const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
  
  console.log("Fetching via proxy:", proxyUrl);
  try {
    const res = await fetch(proxyUrl);
    console.log("Status:", res.status);
    const data = await res.json();
    const parsedData = JSON.parse(data.contents);
    const meta = parsedData?.chart?.result?.[0]?.meta;
    console.log("Parsed Meta:", meta);
  } catch (err) {
    console.error("Proxy fetch failed:", err);
  }
}

testProxy();

async function main() {
  const symbol = 'ISMTLTD.NS';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    console.log('Response Status:', res.status);
    const data = await res.json();
    console.log('Response Data:', JSON.stringify(data).slice(0, 1000));
  } catch (err: any) {
    console.error('Error fetching raw:', err.message || err);
  }
}
main().catch(console.error);

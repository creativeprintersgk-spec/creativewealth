async function searchYahoo(query: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    if (!res.ok) {
      console.log(`Search for "${query}" failed with status:`, res.status);
      return;
    }
    const data: any = await res.json();
    console.log(`\nResults for "${query}":`);
    console.log('Quotes:', data?.quotes);
  } catch (err: any) {
    console.error(`Search for "${query}" error:`, err.message || err);
  }
}

async function main() {
  await searchYahoo('ISMT');
  await searchYahoo('ISMT Ltd');
}
main().catch(console.error);

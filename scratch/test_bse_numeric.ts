import { fetchStockPrice } from '../src/services/assetMasterService';

async function main() {
  console.log('Testing 500325.BO (Reliance BSE code)...');
  const relQuote = await fetchStockPrice('500325.BO');
  console.log('Reliance BSE Quote:', relQuote);

  console.log('\nTesting RELIANCE.BO...');
  const relTickerQuote = await fetchStockPrice('RELIANCE.BO');
  console.log('Reliance Ticker Quote:', relTickerQuote);
}
main().catch(console.error);

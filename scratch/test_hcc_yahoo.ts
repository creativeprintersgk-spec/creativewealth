import { fetchStockPrice } from '../src/services/assetMasterService';

async function main() {
  console.log('Testing HINDUS CONST.NS...');
  const nseQuote = await fetchStockPrice('HINDUS CONST.NS');
  console.log('NSE Quote:', nseQuote);

  console.log('\nTesting 500185.BO...');
  const bseQuote = await fetchStockPrice('500185.BO');
  console.log('BSE Quote:', bseQuote);

  console.log('\nTesting HCC.NS (Correct NSE Ticker)...');
  const correctNseQuote = await fetchStockPrice('HCC.NS');
  console.log('Correct NSE Quote:', correctNseQuote);
}
main().catch(console.error);

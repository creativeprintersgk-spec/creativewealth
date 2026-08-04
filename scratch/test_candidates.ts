import { fetchStockPrice } from '../src/services/assetMasterService';

async function testCandidates(name: string, syms: string[]) {
  console.log(`--- Testing Candidates for "${name}" ---`);
  for (const sym of syms) {
    const quote = await fetchStockPrice(sym);
    if (quote) {
      console.log(`  FOUND: "${sym}" -> Price: ${quote.price}`);
      return sym;
    } else {
      console.log(`  Failed: "${sym}"`);
    }
  }
  console.log(`  ❌ ALL FAILED for "${name}"`);
  return null;
}

async function main() {
  await testCandidates('Kalyani Steels', [
    'KALYANISTL.NS', 'KALYANISTL.BO', 'KSL.NS', 'KSL.BO', 'KALYANISTEEL.BO'
  ]);

  await testCandidates('Oil Country Tubular', [
    'OILCOUNTRY.NS', 'OILCOUNTRY.BO', 'OILCOUNTY.NS', 'OILCOUNTY.BO', 'OILCOUNTR.NS'
  ]);

  await testCandidates('ISMT Limited', [
    'ISMT.NS', 'ISMT.BO', 'ISMTLTD.BO'
  ]);

  await testCandidates('Mirae Asset Nifty Metal ETF', [
    'METALETF.NS', 'METALETF.BO', 'METLETF.NS', 'METLETF.BO',
    'MAMETAL.NS', 'MAMETAL.BO', 'MAMETALETF.NS', 'MAMETALETF.BO',
    'MAETF.NS', 'MAMETALETF.NS', 'MAMETAL.BO', 'MAMETAL.NS'
  ]);
}
main().catch(console.error);

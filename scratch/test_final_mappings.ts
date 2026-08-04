import { fetchStockPrice } from '../src/services/assetMasterService';

const finalMappings = {
  100038: { name: 'Bharat Electronics', sym: 'BEL.NS' },
  100132: { name: 'Hindustan Construction Company', sym: 'HCC.NS' },
  100135: { name: 'Hindustan Zinc', sym: 'HINDZINC.NS' },
  100167: { name: 'Kalyani Steels', sym: 'KSL.NS' },
  100183: { name: 'Uttam Value Steels', sym: 'UTTAMVALUE.NS' },
  100231: { name: 'Oil Country Tubular', sym: 'OILCOUNTUB.NS' },
  100344: { name: 'Hindustan Motors', sym: 'HINDMOTORS.NS' },
  100407: { name: 'Tata Investment Corporation', sym: 'TATAINVEST.NS' },
  101556: { name: 'Bhandari Hosiery Exports', sym: 'BHANDARI.NS' },
  101684: { name: 'Hindustan Copper', sym: 'HINDCOPPER.NS' },
  101856: { name: 'Anant Raj', sym: 'ANANTRAJ.NS' },
  102647: { name: 'Seya Industries', sym: 'SEYAIND.NS' },
  104467: { name: 'ISMT Limited', sym: 'ISMTLTD.NS' },
  105468: { name: 'Integra Essentia', sym: 'ESSENTIA.NS' },
  106093: { name: 'Lloyds Engineering Works', sym: 'LLOYDSENGG.NS' },
  121746: { name: 'Rail Vikas Nigam', sym: 'RVNL.NS' },
  121933: { name: 'Tarc', sym: 'TARC.NS' },
  122169: { name: 'Nippon India Silver ETF', sym: 'SILVERBEES.NS' },
  122630: { name: 'Jio Financial Services', sym: 'JIOFIN.NS' },
  123306: { name: 'Mirae Asset Nifty Metal ETF', sym: 'METAL.NS' }
};

async function main() {
  console.log('--- Testing Final Ticker Mappings ---');
  for (const [amid, info] of Object.entries(finalMappings)) {
    const quote = await fetchStockPrice(info.sym);
    console.log(`Stock: "${info.name}" (amid: ${amid}) -> Yahoo Symbol: "${info.sym}" -> ${quote ? `✅ SUCCESS (${quote.price})` : '❌ FAILED'}`);
  }
}
main().catch(console.error);

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verify() {
  const { getLivePrice } = await import('../src/services/assetMasterService.js');
  console.log('=== VERIFYING LIVE PRICE RESOLUTION ===');

  // Test 1: L&T Finance stock (ACMAC1 ID 500246)
  const ltAsset: any = {
    amid: 500246,
    name: 'L&T Finance',
    asset_type: 50,
  };
  const ltPrice = await getLivePrice(ltAsset);
  console.log('L&T Finance Price Result:', ltPrice);

  // Test 2: Nippon India Multi Asset Fund (ACMAC1 ID 503159)
  const nipponAsset: any = {
    amid: 503159,
    name: 'Nippon India Multi Asset Fund - Direct Plan - Growth Option (499288980916 / 0)',
    asset_type: 60,
  };
  const nipponPrice = await getLivePrice(nipponAsset);
  console.log('Nippon Multi Asset Price Result:', nipponPrice);
}
verify();

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function test() {
  const { getLivePrice } = await import('../src/services/assetMasterService.js');

  const nipponAsset: any = {
    amid: 503159,
    name: 'Nippon India Multi Asset Fund - Direct Plan - Growth Option (499288980916 / 0)',
    asset_type: 60,
    amfi_code: 148457
  };

  console.log('Testing with amfi_code explicitly set:');
  const res = await getLivePrice(nipponAsset);
  console.log('Result:', res);
}
test();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testPriceResolution() {
  console.log('=== CHECKING ASSET MASTER & ACMAC1 FOR L&T FINANCE & NIPPON MULTI ASSET ===');

  // Check asset_master
  const { data: samLt } = await s
    .from('asset_master')
    .select('*')
    .or('name.ilike.%L&T Finance%,name.ilike.%LTF%');
  console.log('asset_master for L&T Finance:', samLt);

  const { data: samNippon } = await s
    .from('asset_master')
    .select('*')
    .ilike('name', '%Nippon%Multi Asset%');
  console.log('asset_master for Nippon Multi Asset:', samNippon);

  // Check sum_table records for L&T Finance and Nippon Multi Asset
  // First get ACMAC1 IDs
  const { data: acmac1Rows } = await s
    .from('acmac1')
    .select('id, name, acid')
    .or('name.ilike.%L&T Finance%,name.ilike.%Nippon India Multi Asset%');
  console.log('ACMAC1 rows for L&T Finance and Nippon Multi Asset:', acmac1Rows);

  if (acmac1Rows && acmac1Rows.length > 0) {
    const ids = acmac1Rows.map(a => a.id);
    const { data: holdings } = await s
      .from('sum_table')
      .select('*')
      .in('amid', ids);
    console.log('sum_table holdings for these ACMAC1 IDs:', holdings);

    const { data: prices } = await s
      .from('mprices')
      .select('*')
      .in('amid', ids);
    console.log('mprices for these ACMAC1 IDs:', prices);
  }
}
testPriceResolution();

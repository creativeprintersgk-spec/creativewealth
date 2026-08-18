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

async function search() {
  console.log('=== BROAD SEARCH FOR L&T AND NIPPON IN SAM & SUM_TABLE ===');

  // Search SAM for L&T
  const { data: ltSam } = await s.from('sam').select('*').or('anm.ilike.%L&T%,anm.ilike.%LT%');
  console.log('L&T matches in SAM:', ltSam?.map(x => ({ amid: x.amid, anm: x.anm, atyp: x.atyp })));

  // Search SAM for Nippon
  const { data: nipponSam } = await s.from('sam').select('*').ilike('anm', '%Nippon%');
  console.log('Nippon matches in SAM:', nipponSam?.map(x => ({ amid: x.amid, anm: x.anm, atyp: x.atyp })));

  // Search SAM for Multi Asset
  const { data: maSam } = await s.from('sam').select('*').ilike('anm', '%Multi%');
  console.log('Multi Asset matches in SAM:', maSam?.map(x => ({ amid: x.amid, anm: x.anm, atyp: x.atyp })));

  // Now check holdings in sum_table for these amids
  const allAmids = [
    ...(ltSam || []).map(x => x.amid),
    ...(nipponSam || []).map(x => x.amid),
    ...(maSam || []).map(x => x.amid)
  ];

  if (allAmids.length > 0) {
    const { data: holdings } = await s.from('sum_table').select('sid, amid, qnt, amtinv, currv, pfolio_id').in('amid', allAmids);
    console.log('Holdings in sum_table:', holdings);

    // Get current price records for these amids in mprices
    const { data: prices } = await s.from('mprices').select('*').in('amid', allAmids);
    console.log('mprices for these AMIDs:', prices);
  }
}
search();

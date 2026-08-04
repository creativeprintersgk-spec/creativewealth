import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  console.log('Searching for "Edelweiss Liquid" in asset_master...');
  const { data: assets, error } = await sb
    .from('asset_master')
    .select('*')
    .ilike('name', '%Edelweiss%Liquid%');

  if (error) {
    console.error('Error fetching assets:', error);
    return;
  }

  console.log(`Found ${assets?.length || 0} matching assets:`);
  assets?.forEach(a => {
    console.log(`- AMID: ${a.amid}, Name: "${a.name}", nse_symbol: "${a.nse_symbol}", bse_symbol: "${a.bse_symbol}", ISIN: "${a.isin}"`);
  });

  // Let's also check if there are any prices mapped to these AMIDs in mprices
  if (assets && assets.length > 0) {
    const amids = assets.map(a => a.amid);
    const { data: prices } = await sb
      .from('mprices')
      .select('*')
      .in('amid', amids);
    console.log('\nExisting mprices entries for these AMIDs:');
    prices?.forEach(p => {
      console.log(`- AMID: ${p.amid}, Date: ${p.date}, CURRP: ${p.currp}, PREVP: ${p.prevp}`);
    });
  }
}

main().catch(console.error);

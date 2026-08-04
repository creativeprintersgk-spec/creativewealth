import { initDatabase, getStoredPortfolios } from '../src/logic';
import { supabase } from '../src/supabase';

async function main() {
  await initDatabase();
  const { data: links } = await supabase.from('accPflink').select('*');
  console.log('accPflink rows:');
  console.log(links);

  const { data: portfolios } = await supabase.from('portfolios').select('*');
  console.log('\nAll Portfolios in database:');
  portfolios?.forEach(p => {
    console.log(`id=${p.id}, investor_name="${p.investor_name}", pfolio_type=${p.pfolio_type}, is_group=${p.is_group}`);
  });
}

main().catch(console.error);

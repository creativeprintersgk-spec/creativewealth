import { initDatabase, getStoredPortfolios, getStoredAccounts } from '../src/logic';
import { supabase } from '../src/supabase';

async function main() {
  await initDatabase();
  
  // Find bs1 row with trid = 13331
  const { data: bsRows } = await supabase.from('bs1').select('*').eq('trid', 13331);
  console.log('BS1 Row for TRID 13331:');
  console.log(bsRows);

  if (bsRows && bsRows.length > 0) {
    const row = bsRows[0];
    console.log(`\nPortfolio ID: ${row.pfid}`);
    
    // Find portfolio
    const portfolios = getStoredPortfolios();
    const port = portfolios.find(p => Number(p.id) === Number(row.pfid));
    console.log('Matched Portfolio:', port);

    // Find account
    const accounts = getStoredAccounts();
    const acc = accounts.find(a => Number(a.id) === Number(port?.accountId));
    console.log('Matched Account:', acc);
  }
}

main().catch(console.error);

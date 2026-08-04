import { initDatabase, getStoredAccounts } from '../src/logic';
import { supabase } from '../src/supabase';

async function main() {
  await initDatabase();
  const accounts = getStoredAccounts();

  // Search for the bank accounts in acmac1
  const { data: rows } = await supabase
    .from('acmac1')
    .select('id, name, acid, parent_id')
    .or('name.ilike.%39223256906%,name.ilike.%5348805437%,name.ilike.%10055495198%,name.ilike.%Bank of Baroda%');

  console.log('Matching rows in acmac1:');
  rows?.forEach(r => {
    const acc = accounts.find(a => Number(a.id) === Number(r.acid));
    console.log(`id=${r.id}, name="${r.name}", acid=${r.acid} (${acc?.name}), parent_id=${r.parent_id}`);
  });
}

main().catch(console.error);

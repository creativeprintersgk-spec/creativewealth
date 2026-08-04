import { supabase } from '../src/supabase';

async function main() {
  const { data, error } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', '%mutual%');

  if (error) console.error("Error:", error.message);
  else console.log("Mutual Fund group/ledger in acmac1:", data);
}
main().catch(console.error);

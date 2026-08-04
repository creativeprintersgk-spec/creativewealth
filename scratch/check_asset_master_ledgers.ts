import { supabase } from '../src/supabase';

async function main() {
  const ids = [502931, 502923, 503080, 502854, 502862, 502965, 503078, 502867, 502819, 502735, 503010];
  
  const { data, error } = await supabase
    .from('asset_master')
    .select('*')
    .in('amid', ids);

  if (error) console.error("Error:", error.message);
  else console.log("Found in asset_master:", data);
}
main().catch(console.error);

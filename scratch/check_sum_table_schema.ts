import { supabase } from '../src/supabase';

async function main() {
  const { data, error } = await supabase.from('sum_table').select('*').limit(3);
  if (error) {
    console.error("Error fetching sum_table:", error.message);
  } else {
    console.log("sum_table sample:", data);
  }

  // Get max sid from sum_table
  const { data: maxData, error: maxError } = await supabase
    .from('sum_table')
    .select('sid')
    .order('sid', { ascending: false })
    .limit(1);

  if (maxError) {
    console.error("Error getting max sid:", maxError.message);
  } else {
    console.log("Max sid in sum_table:", maxData);
  }
}

main().catch(console.error);

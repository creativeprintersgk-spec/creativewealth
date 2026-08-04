import { supabase } from '../src/supabaseClient';
async function main() { 
  const { data, error } = await supabase.from('bs1').select('*').limit(1); 
  console.log(Object.keys(data[0] || {})); 
} 
main();

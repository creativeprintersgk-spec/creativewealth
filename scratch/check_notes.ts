import { supabase } from '../src/supabaseClient';
async function main() { 
  const { data, error } = await supabase.from('notes1').select('*').limit(1); 
  console.log(data, error); 
} 
main();

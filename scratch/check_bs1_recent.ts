import { supabase } from '../src/supabaseClient';
async function main() { 
  const { data, error } = await supabase.from('bs1').select('trid, acvch, amt, chrgs, brkg, narr').order('trid', { ascending: false }).limit(20); 
  console.table(data); 
} 
main();

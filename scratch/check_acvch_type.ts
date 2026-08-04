import { supabase } from '../src/supabase';

async function main() {
  // Let's get 5 rows from bs1 where acvch is not null
  const { data, error } = await supabase
    .from('bs1')
    .select('trid, acvch')
    .not('acvch', 'is', null)
    .limit(5);

  if (error) {
    console.error('Error fetching non-null acvch:', error);
  } else {
    console.log('Non-null acvch rows:', data);
  }

  // Let's query postgres system catalogs to get column type of acvch in bs1 table
  const { data: colInfo, error: colErr } = await supabase
    .rpc('get_column_type', { table_name: 'bs1', column_name: 'acvch' });
  
  if (colErr) {
    console.log('RPC check failed (normal if function doesn\'t exist), trying query...');
    // We can run a direct query on information_schema if we have access, or just test a number vs string.
    const { data: testStr, error: errStr } = await supabase
      .from('bs1')
      .update({ acvch: '123' })
      .eq('trid', 490)
      .select('trid, acvch');
    console.log('Update with integer-string "123": success=', !errStr, 'err=', errStr?.message);

    const { data: testChar, error: errChar } = await supabase
      .from('bs1')
      .update({ acvch: 'abc' })
      .eq('trid', 490)
      .select('trid, acvch');
    console.log('Update with char-string "abc": success=', !errChar, 'err=', errChar?.message);
  } else {
    console.log('Column info:', colInfo);
  }
}

main().catch(console.error);

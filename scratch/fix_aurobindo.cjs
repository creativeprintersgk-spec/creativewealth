const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function fixAurobindo() {
  // Old amid=102791 "Aurobindo Pharma" nse="AUROBINDO PH" (wrong symbol, no ISIN)
  // New amid=253975 "Aurobindo Pharma Limited" nse="AUROPHARMA" isin=INE406A01037 (correct)
  
  // The CN imported 2 qty into amid=253975 (correct amid with proper NSE symbol)
  // The old portfolio has Aurobindo Pharma under amid=102791 with broken NSE symbol
  
  // Fix: update amid=102791 to have the correct NSE symbol AUROPHARMA
  // so prices can be fetched. We keep both as separate amids for now since
  // they have different purchase histories.
  
  console.log('Fixing old Aurobindo Pharma nse_symbol...');
  const { error } = await supabase
    .from('asset_master')
    .update({ nse_symbol: 'AUROPHARMA', isin: 'INE406A01037' })
    .eq('amid', 102791);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Updated amid=102791 "Aurobindo Pharma" nse_symbol -> AUROPHARMA');
  }

  // Now check: what portfolios have Aurobindo holdings and via which amid?
  const { data: bs1Auro } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, qn, purpr, dt, narr')
    .in('amid', [102791, 253975])
    .order('dt', {ascending: false});
  console.log('\nAll bs1 Aurobindo rows:', JSON.stringify(bs1Auro, null, 2));

  // Check sum_table for these amids
  const { data: sums } = await supabase
    .from('sum_table')
    .select('sid, pfid, amid, holdingqn, avgprice, totcost')
    .in('amid', [102791, 253975]);
  console.log('\nsum_table for Aurobindo:', JSON.stringify(sums, null, 2));
}

fixAurobindo().catch(console.error);

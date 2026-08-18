const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function investigate() {
  console.log('=== 1. CHECK SUM_TABLE FOR ABSLAMC (amid=253791) ===');
  const { data: absRows } = await supabase.from('sum_table').select('*').eq('amid', 253791);
  console.log('sum_table rows for amid=253791:', absRows);

  console.log('\n=== 2. CHECK ALL CN STOCKS IN SUM_TABLE (pfolio_id=1) ===');
  const cnAmids = [102791, 253791, 253886, 254030, 254076, 254119, 254140, 254204,
                   254501, 254634, 254647, 254741, 254761, 255147, 255214, 255274,
                   255475, 255530, 256104, 605726];
  const { data: allCnSums } = await supabase.from('sum_table').select('*').in('amid', cnAmids);
  console.log('All sum_table rows for CN amids (all portfolios):');
  allCnSums?.forEach(r => console.log(`  sid=${r.sid} pfid=${r.pfolio_id} amid=${r.amid} qnt=${r.qnt} amtinv=${r.amtinv}`));

  console.log('\n=== 3. CHECK SAAHIL (acid=31 or 32 or 36) BALANCE SHEET & ENTRIES ===');
  // Saahil Shah account id:
  const { data: accounts } = await supabase.from('acmac1').select('id, name, acid').ilike('name', '%saahil%');
  console.log('Saahil accounts/ledgers in acmac1:', accounts);

  // Check all accounts in portfolio
  const { data: pfs } = await supabase.from('portfolio').select('*');
  console.log('Portfolios:', pfs);

  // Check trial balance / vouchers for Saahil's acid (acid=31? or 36? let's check)
}

investigate().catch(console.error);

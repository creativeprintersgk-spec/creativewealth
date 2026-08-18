import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDuplicateCNVouchers() {
  console.log('Deleting duplicate vouchers on 2026-08-11...');
  
  // Find vouchers on 2026-08-11 with narration containing CNT-26/27-77026007
  const { data: vList } = await supabase
    .from('vouchersc1')
    .select('vid, narr')
    .eq('dt', '2026-08-11');
  
  console.log('Found vouchers to delete:', vList);

  for (const v of vList || []) {
    await supabase.from('transc1').delete().eq('vid', v.vid);
    await supabase.from('bs1').delete().eq('acvch', v.vid);
    await supabase.from('vouchersc1').delete().eq('vid', v.vid);
    console.log(`Deleted vid ${v.vid}`);
  }

  // Also clean up sum_table for amid 253791 (ABSLAMC) in portfolio 3 to reset its count if needed
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('amid', 253791).eq('pfolio_id', 3);
  console.log('Current sum_table for ABSLAMC:', sumRows);
  if (sumRows && sumRows.length > 0) {
    // Reset or update based on remaining bs1
    const { data: remainingBs1 } = await supabase.from('bs1').select('*').eq('amid', 253791).eq('pfid', 3);
    const totalQty = (remainingBs1 || []).reduce((s: number, r: any) => s + (Number(r.qn) || 0), 0);
    const totalAmt = (remainingBs1 || []).reduce((s: number, r: any) => s + (Number(r.amt) || 0), 0);
    if (totalQty === 0) {
      await supabase.from('sum_table').delete().eq('amid', 253791).eq('pfolio_id', 3);
      console.log('Removed ABSLAMC from sum_table since remaining qty is 0');
    } else {
      await supabase.from('sum_table').update({ qnt: totalQty, amtinv: totalAmt }).eq('amid', 253791).eq('pfolio_id', 3);
      console.log(`Updated ABSLAMC sum_table to qty: ${totalQty}, amt: ${totalAmt}`);
    }
  }
}

cleanDuplicateCNVouchers().catch(console.error);

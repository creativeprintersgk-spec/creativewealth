import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fixHdfc() {
  console.log('=== FIXING HDFC BANK BUY LOTS ON 03/07/2024 ACROSS ALL PORTFOLIOS ===\n');

  // Find all HDFC Bank buy lots on 03/07/2024
  const { data: hdfcBuyLots } = await supabase
    .from('bs1')
    .select('*')
    .eq('dt', '2024-07-03')
    .in('trty', [19, 20, 12, 25, 30, 45, 46]);

  console.log('Found HDFC buy lots on 03/07/2024:', hdfcBuyLots);

  if (hdfcBuyLots && hdfcBuyLots.length > 0) {
    for (const lot of hdfcBuyLots) {
      await supabase
        .from('bs1')
        .update({ qn: 23, purpr: 1783.00, netpr: 1783.00, amt: 23 * 1783.00 })
        .eq('trid', lot.trid);
      console.log(`✅ Updated lot trid ${lot.trid} (pfid ${lot.pfid}) to 23 shares @ 1783.00`);
    }
  } else {
    // Insert 23-share lot for pfid 1
    const { data: maxTr } = await supabase.from('bs1').select('trid').order('trid', { ascending: false }).limit(1);
    const nextTrid = (maxTr?.[0]?.trid || 0) + 1;

    await supabase.from('bs1').insert({
      trid: nextTrid,
      pfid: 1,
      amid: 502404,
      atyid: 50,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      dt: '2024-07-03',
      qn: 23,
      purpr: 1783.00,
      brkg: 0,
      netpr: 1783.00,
      amt: 23 * 1783.00,
      chrgs: 0,
      narr: 'HDFC Merger Lot 23 Shares'
    });
    console.log('✅ Inserted 23-share HDFC lot on 03/07/2024 for pfid 1');
  }

  // Also check if there is an existing 15-share lot in bs1 for HDFC Bank (amid 502404 or 502826) that needs to be updated to 23
  const { data: allHdfcLots } = await supabase.from('bs1').select('*').in('pfid', [1, 31, 36]).eq('dt', '2024-07-03');
  console.log('\nAll HDFC lots after fix:', allHdfcLots);
}

fixHdfc().catch(console.error);

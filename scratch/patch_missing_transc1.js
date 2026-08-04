/**
 * Patch script: Fix vouchers 13333 and 13334 which are missing transc1 accounting entries.
 * These dividends for pfid=4 (Pramesh Inv, acid=30) were saved without transc1 entries
 * because the bank/dividend ledger lookup failed at save time.
 * 
 * This script inserts proper transc1 entries:
 * - Bank (Kotak Bank for acid=30): maid=? → need to check
 * - Dividend Income (Dividend for acid=30): maid=415
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Find the bank ledger for acid=30
  const { data: ledgers } = await supabase.from('acmac1').select('*').eq('acid', 30).eq('is_group', false);
  console.log('\n=== LEDGERS FOR acid=30 ===');
  ledgers?.forEach(l => console.log(`  id=${l.id} name=${l.name} parent_id=${l.parent_id}`));

  const bankLedger = ledgers?.find(l => l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('cash'));
  const divLedger = ledgers?.find(l => l.name.toLowerCase().includes('dividend'));
  
  console.log('\nBank ledger:', bankLedger ? `id=${bankLedger.id} name=${bankLedger.name}` : 'NOT FOUND');
  console.log('Dividend ledger:', divLedger ? `id=${divLedger.id} name=${divLedger.name}` : 'NOT FOUND');

  if (!bankLedger || !divLedger) {
    console.error('Cannot fix: bank or dividend ledger not found for acid=30');
    return;
  }

  // Check current transc1 max transid to know what IDs to use
  const { data: maxTrans } = await supabase.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
  let nextTransid = (maxTrans?.[0]?.transid || 22900) + 1;
  console.log(`\nNext transid will start at: ${nextTransid}`);

  // Voucher 13333: amt=1 (from bs1 trid=15942 pfid=4 amid=101856 amt=1 dt=2026-05-30)
  // Voucher 13334: amt=2.1 (from bs1 trid=15943 pfid=4 amid=101856 amt=2.1 dt=2026-05-30)
  
  const vouchersToFix = [
    { vid: 13333, amount: 1, date: '2026-05-30' },
    { vid: 13334, amount: 2.1, date: '2026-05-30' },
  ];

  for (const v of vouchersToFix) {
    // Check if already has entries
    const { data: existing } = await supabase.from('transc1').select('transid').eq('vid', v.vid);
    if (existing && existing.length > 0) {
      console.log(`vid=${v.vid} already has transc1 entries, skipping`);
      continue;
    }

    const rows = [
      { transid: nextTransid++, vid: v.vid, acid: 30, maid: bankLedger.id, dramt: v.amount, cramt: 0, dt: v.date },
      { transid: nextTransid++, vid: v.vid, acid: 30, maid: divLedger.id, dramt: 0, cramt: v.amount, dt: v.date },
    ];
    
    console.log(`\nInserting transc1 for vid=${v.vid} (amount=${v.amount}):`);
    rows.forEach(r => console.log(`  transid=${r.transid} maid=${r.maid} dr=${r.dramt} cr=${r.cramt}`));

    const { error } = await supabase.from('transc1').insert(rows);
    if (error) {
      console.error(`❌ Failed to insert for vid=${v.vid}:`, error.message);
    } else {
      console.log(`✅ Inserted transc1 entries for vid=${v.vid}`);
    }

    // Also update the voucher acid to 30
    const { error: vError } = await supabase.from('vouchersc1').update({ acid: 30 }).eq('vid', v.vid);
    if (vError) {
      console.error(`❌ Failed to update voucher acid for vid=${v.vid}:`, vError.message);
    } else {
      console.log(`✅ Updated vouchersc1 acid=30 for vid=${v.vid}`);
    }
  }
  
  console.log('\nDone! Refresh the app to see the changes.');
}

run().catch(console.error);

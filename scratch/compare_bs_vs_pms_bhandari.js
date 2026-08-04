import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const saahilAcid = 31;
  const saahilPfid = 1;
  const bhandariAmid = 101556;
  const bhandariLedgerId = 500589;

  console.log('Comparing Balance Sheet Ledger entries vs PMS Portfolio Transactions for Bhandari...');

  // 1. Fetch BS ledger entries (transc1/trans1 where acid=31, maid=500589)
  const { data: trans1 } = await supabase.from('trans1').select('*').eq('maid', bhandariLedgerId).eq('acid', saahilAcid);
  const { data: transc1 } = await supabase.from('transc1').select('*').eq('maid', bhandariLedgerId).eq('acid', saahilAcid);
  
  const bsEntries = [
    ...(trans1 || []).map(e => ({ ...e, type: 'BS' })),
    ...(transc1 || []).map(e => ({ ...e, type: 'BS' }))
  ];

  // 2. Fetch PMS entries (bs1 where pfid=1, amid=101556)
  const { data: pmsEntries } = await supabase.from('bs1').select('*').eq('pfid', saahilPfid).eq('amid', bhandariAmid);

  console.log(`\nBalance Sheet has ${bsEntries.length} entries. Total Debit: ${bsEntries.reduce((s, e) => s + (Number(e.dramt) || 0), 0).toFixed(2)}`);
  console.log(`PMS has ${pmsEntries?.length || 0} entries. Total Cost: ${pmsEntries?.reduce((s, t) => {
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    return s + (isBuy ? Number(t.amt) : -Number(t.amt));
  }, 0).toFixed(2)}`);

  console.log('\n=== Comparing Vouchers/Transactions by Date and Amount ===');

  // Let's create a map of BS entries by date and amount
  const bsGroups = {};
  bsEntries.forEach(e => {
    const key = `${e.dt}_${(Number(e.dramt) || Number(e.cramt)).toFixed(2)}`;
    if (!bsGroups[key]) bsGroups[key] = [];
    bsGroups[key].push(e);
  });

  const pmsGroups = {};
  (pmsEntries || []).forEach(t => {
    const key = `${t.dt}_${Number(t.amt).toFixed(2)}`;
    if (!pmsGroups[key]) pmsGroups[key] = [];
    pmsGroups[key].push(t);
  });

  // Check which keys exist in one but not the other, or have different counts
  const allKeys = new Set([...Object.keys(bsGroups), ...Object.keys(pmsGroups)]);

  console.log('\nDiscrepancies found:');
  let hasDiscrepancy = false;

  Array.from(allKeys).sort().forEach(key => {
    const bsList = bsGroups[key] || [];
    const pmsList = pmsGroups[key] || [];

    if (bsList.length !== pmsList.length) {
      hasDiscrepancy = true;
      const [dt, amt] = key.split('_');
      console.log(`\n❌ Mismatch on Date: ${dt}, Amount: ${amt}`);
      console.log(`   - BS has ${bsList.length} entry/entries:`);
      bsList.forEach(e => {
        console.log(`     * transid: ${e.transid}, vid: ${e.vid}, dr: ${e.dramt}, cr: ${e.cramt}`);
      });
      console.log(`   - PMS has ${pmsList.length} entry/entries:`);
      pmsList.forEach(t => {
        const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
        console.log(`     * trid: ${t.trid}, pfid: ${t.pfid}, qty: ${t.qn}, type: ${isBuy ? 'BUY' : 'SELL'}, acvch: ${t.acvch}`);
      });
    }
  });

  if (!hasDiscrepancy) {
    console.log('No discrepancies found by Date + Amount key matching.');
  }
}

run().catch(console.error);

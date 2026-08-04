/**
 * Fix existing broken entries and verify the system is clean.
 * vid=13333 (amt=1) and vid=13334 (amt=2.1) for pfid=4 (Pramesh, acid=30)
 * were patched with maid=205 (Cash on Hand) as bank - fix to use correct Kotak bank.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Find correct bank for acid=30 (Pramesh Shah Ac)
  const { data: ledgers30 } = await sb.from('acmac1').select('*').eq('acid', 30).eq('is_group', false);
  const bankLedgers = ledgers30?.filter(l => l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('cash'));
  const divLedger = ledgers30?.find(l => l.name.toLowerCase().includes('dividend'));
  
  console.log('Bank ledgers for acid=30:', bankLedgers?.map(l => `id=${l.id} name="${l.name}"`));
  console.log('Dividend ledger for acid=30:', divLedger ? `id=${divLedger.id} name="${divLedger.name}"` : 'NOT FOUND');

  if (!bankLedgers || bankLedgers.length === 0) {
    console.error('No bank ledger found for acid=30!');
    return;
  }
  
  // Use the actual bank (prefer name with 'kotak bank' specifically, and exclude unassigned)
  const bankLedger = bankLedgers.find(l => l.name.toLowerCase().includes('kotak bank')) 
                  || bankLedgers.find(l => l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('unassigned')) 
                  || bankLedgers[0];
  console.log(`\nUsing bank: id=${bankLedger.id} name="${bankLedger.name}"`);

  // Check current state of transc1 for vid=13333, 13334
  const { data: existing } = await sb.from('transc1').select('*').in('vid', [13333, 13334]);
  console.log('\nCurrent transc1 for vid 13333/13334:');
  existing?.forEach(t => console.log(`  transid=${t.transid} vid=${t.vid} maid=${t.maid} dr=${t.dramt} cr=${t.cramt}`));

  // Delete wrong transc1 entries (maid=205 Cash on Hand or maid=210 Unassigned Bank/Ledger)
  const wrongEntries = existing?.filter(t => t.maid === 205 || t.maid === 210);
  if (wrongEntries && wrongEntries.length > 0) {
    console.log(`\nDeleting ${wrongEntries.length} wrong placeholder entries...`);
    const { error } = await sb.from('transc1').delete().in('transid', wrongEntries.map(t => t.transid));
    if (error) console.error('Delete error:', error.message);
    else console.log('✅ Deleted wrong entries');
  }

  // Re-check and insert correct bank entries
  const { data: afterDelete } = await sb.from('transc1').select('*').in('vid', [13333, 13334]);
  const bankEntries = afterDelete?.filter(t => t.maid === bankLedger.id);
  
  // For vid=13333 (amt=1) - insert bank debit if missing
  if (!bankEntries?.find(t => t.vid === 13333)) {
    const { data: maxT } = await sb.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
    let nextId = (maxT?.[0]?.transid || 22920) + 1;
    
    const rows = [
      { transid: nextId++, vid: 13333, acid: 30, maid: bankLedger.id, dramt: 1, cramt: 0, dt: '2026-05-30' },
    ];
    const { error } = await sb.from('transc1').insert(rows);
    if (error) console.error('❌ Insert error vid=13333:', error.message);
    else console.log('✅ Fixed vid=13333 bank entry → maid=' + bankLedger.id + ' (' + bankLedger.name + ')');
  }

  if (!bankEntries?.find(t => t.vid === 13334)) {
    const { data: maxT } = await sb.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
    let nextId = (maxT?.[0]?.transid || 22920) + 1;
    
    const rows = [
      { transid: nextId++, vid: 13334, acid: 30, maid: bankLedger.id, dramt: 2.1, cramt: 0, dt: '2026-05-30' },
    ];
    const { error } = await sb.from('transc1').insert(rows);
    if (error) console.error('❌ Insert error vid=13334:', error.message);
    else console.log('✅ Fixed vid=13334 bank entry → maid=' + bankLedger.id + ' (' + bankLedger.name + ')');
  }

  // Final state
  const { data: final } = await sb.from('transc1').select('*').in('vid', [13333, 13334]).order('transid');
  console.log('\nFINAL transc1 for vid 13333/13334:');
  final?.forEach(t => console.log(`  transid=${t.transid} vid=${t.vid} acid=${t.acid} maid=${t.maid} dr=${t.dramt} cr=${t.cramt}`));
  
  // Summary: check dividend entries have both bank+dividend transc1
  const has13333 = final?.filter(t => t.vid === 13333);
  const has13334 = final?.filter(t => t.vid === 13334);
  console.log(`\n✅ vid=13333: ${has13333?.length || 0} entries (need 2: bank dr + dividend cr)`);
  console.log(`✅ vid=13334: ${has13334?.length || 0} entries (need 2: bank dr + dividend cr)`);
}

run().catch(console.error);

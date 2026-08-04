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

async function run() {
  console.log("=== SEARCHING FOR PORTFOLIO 1 BROKERS ===");
  
  // Find all vouchers for pfid = 1
  const { data: vouchers, error: vErr } = await supabase
    .from('vouchersc1')
    .select('vid, narr, acid')
    .eq('pfid', 1);

  if (vErr) {
    console.error("Error fetching vouchers:", vErr);
    return;
  }

  console.log(`Found ${vouchers.length} vouchers for portfolio 1.`);
  
  if (vouchers.length > 0) {
    const vids = vouchers.map(v => v.vid);
    // Find all entries in transc1 for these vids that are under group 75 (brokers)
    const { data: entries, error: eErr } = await supabase
      .from('transc1')
      .select('vid, maid, cramt, dramt')
      .in('vid', vids);

    if (eErr) {
      console.error("Error fetching entries:", eErr);
      return;
    }

    // Load acmac1 to resolve names
    const { data: ledgers } = await supabase.from('acmac1').select('id, name, parent_id');
    const ledgerMap = new Map(ledgers?.map(l => [l.id, l]));

    entries.forEach(e => {
      const led = ledgerMap.get(e.maid);
      if (led && (led.parent_id === 75 || led.parent_id === 90)) {
        console.log(`Voucher ${e.vid}: Broker ledger matched: id=${e.maid} name="${led.name}" parent_id=${led.parent_id} cr=${e.cramt} dr=${e.dramt}`);
      }
    });
  }
}

run();

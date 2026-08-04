import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== FINDING LEDGERS ===');
  const { data: ledgers } = await supabase
    .from('acmac1')
    .select('id, name')
    .or('name.ilike.%OLD Shares%,name.ilike.%Pramesh%');

  if (!ledgers || ledgers.length === 0) {
      console.log('No ledgers found');
      return;
  }
  
  for (const ledger of ledgers) {
      const { data: trans } = await supabase
          .from('transc1')
          .select('*')
          .eq('acid', ledger.id)
          .eq('dt', '2019-04-01');
          
      if (trans && trans.length > 0) {
          console.log(`\nFound 2019-04-01 transc1 entries for ${ledger.name} (id: ${ledger.id}):`);
          trans.forEach(t => {
              console.log(`  transid: ${t.transid}, vid: ${t.vid}, vtyp: ${t.vtyp}, dt: ${t.dt}, cramt: ${t.cramt}, dramt: ${t.dramt}`);
          });
      }
      
      const { data: transAll } = await supabase
          .from('transc1')
          .select('*')
          .eq('acid', ledger.id)
          .gt('cramt', 0)
          .order('dt', { ascending: true })
          .limit(5);
          
      if (transAll && transAll.length > 0) {
          console.log(`\nSample transc1 entries for ${ledger.name} (id: ${ledger.id}):`);
          transAll.forEach(t => {
              console.log(`  transid: ${t.transid}, vid: ${t.vid}, vtyp: ${t.vtyp}, dt: ${t.dt}, cramt: ${t.cramt}, dramt: ${t.dramt}`);
          });
      }
  }
}

run().catch(console.error);

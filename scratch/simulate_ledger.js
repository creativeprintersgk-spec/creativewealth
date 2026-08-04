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
  for (const lid of [27, 66]) {
      const { data: acmac1 } = await supabase.from('acmac1').select('*').eq('id', lid);
      const ledgerObj = acmac1[0];
      let openingBalance = (Number(ledgerObj.db_bal) || 0) - (Number(ledgerObj.cr_bal) || 0);
      let runningBalance = openingBalance;
      
      const { data: trans1 } = await supabase.from('trans1').select('*').eq('maid', lid).neq('vid', 0);
      const { data: transc1 } = await supabase.from('transc1').select('*').eq('maid', lid).neq('vid', 0);
      
      const entries = [...(trans1||[]), ...(transc1||[])].sort((a, b) => a.dt.localeCompare(b.dt));
      
      const startDate = '2026-04-01';
      entries.forEach(e => {
          const dr = Number(e.dramt) || 0;
          const cr = Number(e.cramt) || 0;
          if (e.dt < startDate) {
              runningBalance += dr - cr;
              openingBalance = runningBalance;
          } else {
              runningBalance += dr - cr;
          }
      });
      
      console.log(`\nLedger ${lid}:`);
      console.log(`Opening Balance on ${startDate}: ${openingBalance}`);
      console.log(`Closing Balance: ${runningBalance}`);
  }
}

run().catch(console.error);

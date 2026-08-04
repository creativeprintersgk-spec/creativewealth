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
  const saahilPfids = [1, 13, 11, 12, 38];
  
  console.log('Querying all bs1 rows with amid = 101556 or 500589 for Saahil portfolios...');
  const { data: bs1Rows } = await supabase
    .from('bs1')
    .select('*')
    .in('pfolio_id', saahilPfids)
    .in('amid', [101556, 500589]);

  // Wait, let's also query without pfolio_id just in case pfolio_id is named pfid in bs1
  const { data: bs1RowsByPfid } = await supabase
    .from('bs1')
    .select('*')
    .in('pfid', saahilPfids)
    .in('amid', [101556, 500589]);

  const allBs1 = bs1RowsByPfid || bs1Rows || [];
  
  console.log(`Found ${allBs1.length} rows in bs1:`);
  
  let total101556Qty = 0;
  let total101556Amt = 0;
  let total500589Qty = 0;
  let total500589Amt = 0;

  allBs1.forEach(tx => {
    const qty = Number(tx.qn) || 0;
    const amt = Number(tx.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(tx.trty);
    
    if (tx.amid === 101556) {
      if (isBuy) {
        total101556Qty += qty;
        total101556Amt += amt;
      } else {
        total101556Qty -= qty;
        total101556Amt -= amt;
      }
    } else if (tx.amid === 500589) {
      if (isBuy) {
        total500589Qty += qty;
        total500589Amt += amt;
      } else {
        total500589Qty -= qty;
        total500589Amt -= amt;
      }
    }

    console.log(`trid=${tx.trid}, pfid=${tx.pfid}, amid=${tx.amid}, ${isBuy ? 'BUY ' : 'SELL'}, qn=${qty}, purpr=${tx.purpr}, amt=${amt.toFixed(2)}, acvch=${tx.acvch}, dt=${tx.dt}, narr="${tx.narr || ''}"`);
  });

  console.log('\n--- CALCULATED TOTALS ---');
  console.log(`AMID 101556 (Bhandari - Original): Qty = ${total101556Qty}, Amt = ${total101556Amt.toFixed(2)}`);
  console.log(`AMID 500589 (Bhandari - Duplicate): Qty = ${total500589Qty}, Amt = ${total500589Amt.toFixed(2)}`);
  console.log(`Combined PMS Total: Qty = ${total101556Qty + total500589Qty}, Amt = ${(total101556Amt + total500589Amt).toFixed(2)}`);
}

run().catch(console.error);

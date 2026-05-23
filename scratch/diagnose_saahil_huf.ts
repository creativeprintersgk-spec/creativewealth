import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: persons } = await s.from('acmac1').select('id, name, acid').ilike('name', '%Saahil%HUF%');
  console.log('Persons in acmac1:', persons);
  
  if (!persons || persons.length === 0) return;
  const acid = persons[0].acid; // Or id? In MProfit acid is the person id
  console.log('Using acid:', acid);

  const { data: ledgers } = await s.from('acmac1').select('id, name, acid, parent_id').eq('acid', acid);
  
  const targetNames = ['Brokerage Income', 'Interest On Saving', 'Kotak Bank', 'Mediclaim'];
  const targets = ledgers?.filter(l => targetNames.some(t => l.name.toLowerCase().includes(t.toLowerCase())));
  console.log('\nTarget Ledgers:', targets);

  // Deduplicate ledgers based on id
  const uniqueTargets = Array.from(new Map(targets?.map(t => [t.id, t])).values());

  if (uniqueTargets) {
    for (const l of uniqueTargets) {
      console.log(`\n--- Transactions for ${l.name} (id: ${l.id}) ---`);
      const { data: transc1 } = await s.from('transc1').select('transid, dt, dramt, cramt, vid').eq('maid', l.id);
      const { data: trans1 } = await s.from('trans1').select('transid, dt, dramt, cramt, vid').eq('maid', l.id);
      
      const allTrans = [...(transc1 || []), ...(trans1 || [])];
      
      // Filter for 25-26
      const inYear = allTrans.filter(t => t.dt >= '2025-04-01' && t.dt <= '2026-03-31');
      console.log(`Transactions in 25-26 (${inYear.length} total):`);
      inYear.forEach(t => console.log(`  dt: ${t.dt}, dr: ${t.dramt}, cr: ${t.cramt}, vid: ${t.vid}`));
      
      const totalDr = inYear.reduce((sum, t) => sum + (Number(t.dramt) || 0), 0);
      const totalCr = inYear.reduce((sum, t) => sum + (Number(t.cramt) || 0), 0);
      console.log(`  -> 25-26 Net (CR - DR): ${totalCr - totalDr}`);
    }
  }
}
run();

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
  console.log("=== SEARCHING FOR SPECIFIC ASSETS IN SUM_TABLE ===");

  const targetNames = ["Reliance Industries", "Jio Financial Services", "Canara Bank", "Skipper", "UltraTech Cement", "IDFC First Bank"];
  
  // Get all sam records matching target names
  const { data: sams } = await supabase.from('sam').select('amid, anm');
  const matchedSams = sams?.filter(s => targetNames.some(t => s.anm.toLowerCase().includes(t.toLowerCase()))) || [];
  
  console.log("Matched SAM records:");
  matchedSams.forEach(s => console.log(`  amid=${s.amid} name="${s.anm}"`));

  const amids = matchedSams.map(s => s.amid);
  if (amids.length === 0) return;

  // Search sum_table for these amids
  const { data: sumRows } = await supabase.from('sum_table').select('*').in('amid', amids);
  
  // Load portfolios to show names
  const { data: portfolios } = await supabase.from('portfolios').select('id, investor_name, full_name');
  const portMap = new Map(portfolios?.map(p => [p.id, p.investor_name || p.full_name]));

  console.log("\nMatches in sum_table:");
  sumRows?.forEach(r => {
    const samName = matchedSams.find(s => s.amid === r.amid)?.anm;
    const portName = portMap.get(r.pfolio_id) || `Port ${r.pfolio_id}`;
    console.log(`  - asset="${samName}" (amid=${r.amid}) port="${portName}" (pfid=${r.pfolio_id}) qnt=${r.qnt} amtinv=${r.amtinv} currv=${r.currv}`);
  });
}
run();

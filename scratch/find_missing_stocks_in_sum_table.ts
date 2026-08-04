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
  console.log("=== SEARCHING ALL SUM_TABLE FOR MISSING STOCKS ===");

  const targetNames = [
    "Canara Bank", "Jio Financial Services", "Reliance Industries", 
    "UltraTech Cement", "Skipper", "IDFC First Bank", 
    "Bhilwara Technical", "Tarc", "Vodafone Idea", "HDFC Bank"
  ];

  // 1. Fetch asset_master to map names to amids
  const { data: assets } = await supabase.from('asset_master').select('amid, name');
  const matchedAssets = assets?.filter(a => targetNames.some(t => a.name.toLowerCase().includes(t.toLowerCase()))) || [];

  // Also check sam table in case they are there
  const { data: sams } = await supabase.from('sam').select('amid, anm');
  const matchedSams = sams?.filter(s => targetNames.some(t => s.anm.toLowerCase().includes(t.toLowerCase()))) || [];

  const nameMap = new Map<number, string>();
  matchedAssets.forEach(a => nameMap.set(a.amid, a.name));
  matchedSams.forEach(s => nameMap.set(s.amid, s.anm));

  const amids = Array.from(nameMap.keys());
  console.log(`Found amids matching targets: ${amids.join(', ')}`);

  if (amids.length === 0) return;

  // 2. Paginate and fetch all sum_table rows
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('sum_table')
      .select('*')
      .in('amid', amids)
      .order('sid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  // Load portfolios
  const { data: portfolios } = await supabase.from('portfolios').select('id, investor_name, full_name');
  const portMap = new Map(portfolios?.map(p => [p.id, p.investor_name || p.full_name]));

  console.log(`\nFound ${allRows.length} matches in sum_table:`);
  allRows.forEach(r => {
    console.log(`  - asset="${nameMap.get(r.amid)}" (amid=${r.amid}) port="${portMap.get(r.pfolio_id)}" (pfid=${r.pfolio_id}) qnt=${r.qnt} amtinv=${r.amtinv} currv=${r.currv}`);
  });
}
run();

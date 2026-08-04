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
  console.log("=== INDIVIDUAL PORTFOLIO INVESTED TOTALS IN SUM_TABLE ===");

  const { data: sumRows } = await supabase
    .from('sum_table')
    .select('amtinv, currv, qnt, pfolio_id');

  const { data: portfolios } = await supabase.from('portfolios').select('id, investor_name, full_name, is_group');
  const portMap = new Map(portfolios?.map(p => [p.id, p]));

  const activeRows = sumRows?.filter((r: any) => 
    Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01 || Number(r.amtinv) > 0.01
  ) || [];

  const portTotals: Record<number, { name: string, invested: number, currv: number, count: number, is_group: boolean }> = {};
  
  activeRows.forEach(r => {
    const p = portMap.get(r.pfolio_id);
    if (!portTotals[r.pfolio_id]) {
      portTotals[r.pfolio_id] = {
        name: p ? (p.investor_name || p.full_name) : `Port ${r.pfolio_id}`,
        invested: 0,
        currv: 0,
        count: 0,
        is_group: p ? p.is_group : false
      };
    }
    portTotals[r.pfolio_id].invested += Number(r.amtinv) || 0;
    portTotals[r.pfolio_id].currv += Number(r.currv) || 0;
    portTotals[r.pfolio_id].count++;
  });

  console.log("Portfolio Totals:");
  Object.entries(portTotals).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([pid, s]) => {
    console.log(`  Port ID ${pid} ("${s.name}", is_group=${s.is_group}): count=${s.count} invested=${s.invested.toLocaleString('en-IN', {minimumFractionDigits: 2})} currv=${s.currv.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
  });
}
run();

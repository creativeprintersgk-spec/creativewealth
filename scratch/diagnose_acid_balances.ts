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
  const pageSize = 1000;

  // Fetch ALL trans1
  let allT1: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await s
      .from('trans1')
      .select('maid,dramt,cramt,acid,dt,vid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching trans1:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allT1 = allT1.concat(data);
    page++;
  }

  // Fetch ALL vouchers1
  let allV1: any[] = [];
  page = 0;
  while (true) {
    const { data, error } = await s
      .from('vouchers1')
      .select('vid,acid,dt')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching vouchers1:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allV1 = allV1.concat(data);
    page++;
  }

  const voucherMap = new Map<number, any>();
  allV1.forEach(v => voucherMap.set(v.vid, v));

  // Group balances by acid
  const acidT1Stats = new Map<string, { dr: number; cr: number; count: number }>();
  const entryCountWithoutAcid = 0;

  allT1.forEach((e: any) => {
    // Determine acid: from trans1 entry itself, or if missing/null, from its voucher
    const v = voucherMap.get(e.vid);
    const acid = e.acid ? String(e.acid) : (v?.acid ? String(v.acid) : 'unknown');

    const stats = acidT1Stats.get(acid) || { dr: 0, cr: 0, count: 0 };
    stats.dr += Number(e.dramt) || 0;
    stats.cr += Number(e.cramt) || 0;
    stats.count++;
    acidT1Stats.set(acid, stats);
  });

  console.log('=== trans1 Stats by acid ===');
  for (const [acid, stats] of acidT1Stats.entries()) {
    console.log(`acid=${acid}: Count=${stats.count}, DR=${stats.dr.toFixed(2)}, CR=${stats.cr.toFixed(2)}, Diff=${(stats.dr - stats.cr).toFixed(2)}`);
  }
}
run();

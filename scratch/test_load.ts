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

async function safeFetch(table: string, max = 50000): Promise<any[]> {
  try {
    let all: any[] = [];
    const pkMap: Record<string, string> = {
      bs1: 'trid',
      transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
      acmac1: 'id', sam: 'amid', asset_master: 'amid',
      sum_table: 'sid', mprices: 'amid'
    };
    let page = 0;
    const size = 1000;
    while (all.length < max) {
      const { data, error } = await supabase
        .from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
      if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      page++;
    }
    return all;
  } catch (e) {
    console.warn(`⚠️ ${table}:`, e);
    return [];
  }
}

async function run() {
  console.log('Starting parallel load of all tables...');
  const start = Date.now();
  const [portfolios, igm, accPflink, acmac1,
         bs1, sumTable, vouchersC1, vouchers1, transC1, trans1, mprices] = await Promise.all([
    safeFetch('portfolios'), safeFetch('investor_group_members'),
    safeFetch('acc_pflink'), safeFetch('acmac1'),
    safeFetch('bs1'), safeFetch('sum_table'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'), safeFetch('transc1'), safeFetch('trans1'), safeFetch('mprices'),
  ]);
  console.log(`Loaded in ${Date.now() - start}ms:`);
  console.log('  portfolios:', portfolios.length);
  console.log('  igm:', igm.length);
  console.log('  accPflink:', accPflink.length);
  console.log('  acmac1:', acmac1.length);
  console.log('  bs1:', bs1.length);
  console.log('  sumTable:', sumTable.length);
  console.log('  vouchersC1:', vouchersC1.length);
  console.log('  vouchers1:', vouchers1.length);
  console.log('  transC1:', transC1.length);
  console.log('  trans1:', trans1.length);
  console.log('  mprices:', mprices.length);
  
  const allVids = [
    ...vouchersC1.map((v: any) => v.vid || 0),
    ...vouchers1.map((v: any) => v.vid || 0),
  ];
  console.log('Calculated nextVid in test_load:', allVids.length > 0 ? Math.max(...allVids) + 1 : 1);
}

run().catch(console.error);

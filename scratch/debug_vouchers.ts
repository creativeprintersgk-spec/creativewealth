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
  const { data: vC1 } = await supabase.from('vouchersc1').select('vid');
  const { data: v1 } = await supabase.from('vouchers1').select('vid');
  
  const vC1Vids = vC1?.map((v: any) => v.vid) || [];
  const v1Vids = v1?.map((v: any) => v.vid) || [];
  
  const maxC1 = Math.max(...vC1Vids, 0);
  const max1 = Math.max(...v1Vids, 0);
  
  console.log('Max vid in vouchersc1:', maxC1);
  console.log('Max vid in vouchers1:', max1);
  console.log('Total in vouchersc1:', vC1Vids.length);
  console.log('Total in vouchers1:', v1Vids.length);
  
  const allVids = [...vC1Vids, ...v1Vids];
  const nextVal = Math.max(...allVids, 0) + 1;
  console.log('Calculated nextVid():', nextVal);
  
  // Check if nextVal exists in vouchersc1
  const { data: existsC1 } = await supabase.from('vouchersc1').select('vid').eq('vid', nextVal);
  console.log(`Does calculated nextVid (${nextVal}) exist in vouchersc1?`, existsC1 && existsC1.length > 0 ? 'YES' : 'NO');
  
  // Let's also check if there are vids in vouchersc1 that are larger than the loaded ones or if there's any issue with range/safeFetch
  // Let's simulate safeFetch for vouchersc1
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('vouchersc1').select('*').order('vid').range(page * size, (page + 1) * size - 1);
    if (error) { console.error('safeFetch error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  const loadedVids = all.map(v => v.vid);
  const maxLoaded = Math.max(...loadedVids, 0);
  console.log('safeFetch loaded vouchersc1 max vid:', maxLoaded);
  console.log('safeFetch loaded vouchersc1 count:', loadedVids.length);
  
  // Find if there are any vids in vC1 that were NOT loaded by safeFetch
  const loadedSet = new Set(loadedVids);
  const missing = vC1Vids.filter(id => !loadedSet.has(id));
  console.log('Vids in DB but NOT loaded by safeFetch:', missing.length);
  if (missing.length > 0) {
    console.log('Sample missing vids:', missing.slice(0, 10));
  }
}

run().catch(console.error);

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
  console.log("=== RUNNING DIRECT SUPABASE QUERIES ===");

  // 1. Fetch portfolios of type 10 (Accounts)
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, investor_name, full_name, pfolio_type, is_group');
  
  const accounts = portfolios?.filter((p: any) => p.pfolio_type === 10) || [];
  console.log("Accounts (pfolio_type = 10):", accounts.map(a => ({ id: a.id, name: a.investor_name })));

  // 2. Fetch acc_pflink to see portfolio links
  const { data: pflinks } = await supabase
    .from('acc_pflink')
    .select('acid, pfid');
  console.log("pflinks samples (first 10):", pflinks?.slice(0, 10));

  // 3. Fetch count of transc1 entries grouped by acid
  const { data: transAcids } = await supabase
    .from('transc1')
    .select('acid');
  
  const transCountByAcid: Record<string, number> = {};
  transAcids?.forEach((t: any) => {
    transCountByAcid[t.acid] = (transCountByAcid[t.acid] || 0) + 1;
  });
  console.log("Transaction entries count grouped by acid:", transCountByAcid);

  // 4. Fetch count of vouchersc1 entries grouped by acid
  const { data: voucherAcids } = await supabase
    .from('vouchersc1')
    .select('acid');
  
  const voucherCountByAcid: Record<string, number> = {};
  voucherAcids?.forEach((v: any) => {
    voucherCountByAcid[v.acid] = (voucherCountByAcid[v.acid] || 0) + 1;
  });
  console.log("Voucher entries count grouped by acid:", voucherCountByAcid);

  // 5. Let's see some samples of acmac1 to see the relationship
  const { data: acmacSamples } = await supabase
    .from('acmac1')
    .select('id, name, acid, is_group')
    .limit(20);
  console.log("acmac1 samples (first 20):", acmacSamples);
}

run();

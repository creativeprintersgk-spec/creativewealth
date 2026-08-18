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

async function findRGandhiGold() {
  console.log('=== SEARCHING FOR R GANDHI 100 GM GOLD (28/09/20) ACROSS ALL TABLES ===\n');

  // 1. Search bs1 for dt = 2020-09-28 or qn = 100 or amt = 5055 or narr ilike %gandhi%
  const { data: bs1Date } = await s.from('bs1').select('*').eq('dt', '2020-09-28');
  console.log('bs1 rows on 2020-09-28:', bs1Date);

  const { data: bs1Gandhi } = await s.from('bs1').select('*').ilike('narr', '%gandhi%');
  console.log('bs1 rows matching "gandhi":', bs1Gandhi);

  const { data: bs15055 } = await s.from('bs1').select('*').eq('amt', 5055);
  console.log('bs1 rows matching amt=5055:', bs15055);

  // 2. Check vouchers1 and vouchersc1 for 2020-09-28
  const { data: v1 } = await s.from('vouchers1').select('*').eq('dt', '2020-09-28');
  console.log('vouchers1 on 2020-09-28:', v1);

  const { data: vc1 } = await s.from('vouchersc1').select('*').eq('dt', '2020-09-28');
  console.log('vouchersc1 on 2020-09-28:', vc1);

  // 3. Check current sum_table row for Portfolio 3 & Gold (amid 466)
  const { data: sumPF3Gold } = await s.from('sum_table').select('*').eq('pfolio_id', 3).eq('amid', 466);
  console.log('\nCurrent sum_table row for PF3 & Gold:', sumPF3Gold);
}

findRGandhiGold();

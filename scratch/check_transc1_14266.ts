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

async function check14266() {
  console.log('=== CHECKING VOUCHER 14266 (R GANDHI 100 GM GOLD) ===');

  const { data: v } = await s.from('vouchersc1').select('*').eq('vid', 14266);
  console.log('vouchersc1 for vid=14266:', v);

  const { data: tc1 } = await s.from('transc1').select('*').eq('vid', 14266);
  console.log('transc1 for vid=14266:', tc1);

  const { data: bs1 } = await s.from('bs1').select('*').or('acvch.eq.14266,trid.eq.14266');
  console.log('bs1 for vid/trid=14266:', bs1);
}
check14266();

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
  const t1 = await s.from('trans1').select('*', { count: 'exact', head: true });
  const tc1 = await s.from('transc1').select('*', { count: 'exact', head: true });
  const v1 = await s.from('vouchers1').select('*', { count: 'exact', head: true });
  const vc1 = await s.from('vouchersc1').select('*', { count: 'exact', head: true });
  console.log('trans1:', t1.count);
  console.log('transc1:', tc1.count);
  console.log('vouchers1:', v1.count);
  console.log('vouchersc1:', vc1.count);
}
run();

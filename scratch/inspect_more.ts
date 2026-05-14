import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectData() {
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  console.log('Portfolios:', portfolios);
  
  const { data: vouchers } = await supabase.from('vouchers').select('*');
  console.log('Vouchers:', vouchers?.length);

  const { data: sampleVoucher } = await supabase.from('vouchers').select('*').limit(1);
  console.log('Sample Voucher:', sampleVoucher);
}

inspectData();

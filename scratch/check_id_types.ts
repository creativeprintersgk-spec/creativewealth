
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

async function checkTypes() {
  const { data: vCols, error: vErr } = await supabase.from('vouchers').select('*').limit(1);
  const { data: pCols, error: pErr } = await supabase.from('portfolios').select('*').limit(1);
  const { data: lCols, error: lErr } = await supabase.from('ledgers').select('*').limit(1);

  console.log('--- Table ID Types (Inferred) ---');
  if (vCols && vCols[0]) console.log('Vouchers ID type:', typeof vCols[0].id, '(Value:', vCols[0].id, ')');
  if (pCols && pCols[0]) console.log('Portfolios ID type:', typeof pCols[0].id, '(Value:', pCols[0].id, ')');
  if (lCols && lCols[0]) console.log('Ledgers ID type:', typeof lCols[0].id, '(Value:', lCols[0].id, ')');
}

checkTypes();

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

async function checkKrishaHindCopper() {
  console.log('=== INVESTIGATING KRISHA PORTFOLIOS & HINDUSTAN COPPER ===');

  // 1. Get Krisha's portfolio IDs
  const { data: portfolios } = await s
    .from('portfolios')
    .select('id, full_name, investor_name')
    .or('full_name.ilike.%krisha%,investor_name.ilike.%krisha%');

  console.log('Krisha Portfolios:', portfolios);
  const pids = portfolios?.map(p => p.id) || [];

  // 2. Search SAM for Hindustan Copper
  const { data: hindCopperSam } = await s
    .from('sam')
    .select('amid, anm, atyp')
    .ilike('anm', '%Hindustan Copper%');

  console.log('Hindustan Copper in SAM:', hindCopperSam);
  const amid = hindCopperSam?.[0]?.amid || 101684;

  // 3. Search sum_table for Krisha + Hindustan Copper
  const { data: sumRows } = await s
    .from('sum_table')
    .select('*')
    .in('pfolio_id', pids)
    .eq('amid', amid);

  console.log('sum_table for Krisha & Hindustan Copper:', sumRows);

  // 4. Search bs1 (Portfolio Transactions) for Krisha & Hindustan Copper
  const { data: bs1Rows } = await s
    .from('bs1')
    .select('*')
    .in('pfid', pids)
    .eq('amid', amid);

  console.log('bs1 transactions for Krisha & Hindustan Copper:', bs1Rows);

  // 5. Check vouchers1 and transc1/trans1 for Krisha & Hindustan Copper
  const { data: vouchers1Rows } = await s
    .from('vouchers1')
    .select('*')
    .in('pfid', pids);

  console.log('Total vouchers1 count for Krisha:', vouchers1Rows?.length);
}
checkKrishaHindCopper();

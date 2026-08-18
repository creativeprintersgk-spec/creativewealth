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

async function testGoldEditPreservation() {
  console.log('=== TESTING GOLD TRANSACTION EDIT & PRESERVATION ===');

  const pfid = 3;
  const amid = 466; // Gold

  // 1. Get current Gold bs1 rows for Portfolio 3
  const { data: beforeTxs } = await s
    .from('bs1')
    .select('trid, dt, qn, purpr, amt')
    .eq('pfid', pfid)
    .eq('amid', amid);

  console.log(`Initial bs1 Gold count: ${beforeTxs?.length}`);

  const totalQtyBefore = beforeTxs?.reduce((acc, t) => acc + Number(t.qn || 0), 0);
  console.log(`Initial Total Gold Qty: ${totalQtyBefore} gm`);

  // 2. Verify all 10 rows exist including 28/09/20 R Gandhi (100 gm)
  const rGandhiRow = beforeTxs?.find(t => t.dt === '2020-09-28' && Number(t.qn) === 100);
  if (rGandhiRow) {
    console.log('✅ R Gandhi 100 gm Gold row (28/09/20) IS PRESENT:', rGandhiRow);
  } else {
    console.error('❌ R Gandhi row is missing!');
  }

  // 3. Verify sum_table row
  const { data: sumRow } = await s.from('sum_table').select('qnt, amtinv, currv').eq('pfolio_id', pfid).eq('amid', amid).single();
  console.log('Current sum_table row:', sumRow);
}

testGoldEditPreservation();

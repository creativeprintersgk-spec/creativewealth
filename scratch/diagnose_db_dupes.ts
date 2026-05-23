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
  const checkDupes = async (table: string, idCol: string) => {
    const { count } = await s.from(table).select('*', { count: 'exact', head: true });
    
    // Check if transid 16148 has duplicates
    const { data: rows } = await s.from(table).select(idCol).limit(10);
    if (!rows || rows.length === 0) return;
    
    const sampleId = rows[0][idCol];
    const { data: dupes } = await s.from(table).select(idCol).eq(idCol, sampleId);
    console.log(`${table} (total: ${count}): sample ${idCol}=${sampleId} appears ${dupes?.length} times`);
  };

  await checkDupes('transc1', 'transid');
  await checkDupes('trans1', 'transid');
  await checkDupes('vouchersc1', 'vid');
  await checkDupes('vouchers1', 'vid');
  await checkDupes('acmac1', 'id');
}
run();

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

async function restore13999() {
  console.log('=== RESTORING TRID 13999 (HDFC MERGER LOT: 30 SHARES @ 1544.83 ON 2023-07-13) ===\n');

  const record = {
    trid: 13999,
    pfid: 1,
    amid: 100128,
    atyid: 50,
    trty: 20,
    trstr: 'Buy (HDFC Merger Lot)',
    dt: '2023-07-13',
    qn: 30,
    purpr: 1544.83
  };

  const { error } = await supabase.from('bs1').upsert(record);
  if (error) {
    console.error('Error inserting TRID 13999:', error);
  } else {
    console.log('✅ Successfully restored TRID 13999!');
  }
}

restore13999().catch(console.error);

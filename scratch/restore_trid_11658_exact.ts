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

async function restore11658() {
  console.log('=== RESTORING TRID 11658 (28 SHARES @ 1783.00 ON 2024-07-03) ===\n');

  const record = {
    trid: 11658,
    pfid: 1,
    amid: 100128,
    atyid: 50,
    trty: 20,
    trstr: 'Buy',
    dt: '2024-07-03',
    qn: 28,
    purpr: 1783.00
  };

  const { error } = await supabase.from('bs1').upsert(record);
  if (error) {
    console.error('Error inserting TRID 11658:', error);
  } else {
    console.log('✅ Successfully restored TRID 11658!');
  }
}

restore11658().catch(console.error);

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

async function fixTrid11658() {
  console.log('=== UPDATING HDFC BANK LOT TRID 11658 (AMID 100128) TO 23 SHARES ===\n');

  const { error } = await supabase.from('bs1').update({
    qn: 23,
    purpr: 1783.00,
    netpr: 1783.00,
    amt: 41009.00
  }).eq('trid', 11658);

  console.log('Update status:', error || 'SUCCESS');
}

fixTrid11658().catch(console.error);

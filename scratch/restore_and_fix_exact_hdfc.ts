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

async function restoreExact() {
  console.log('=== RESTORING NON-HDFC TRADES ON 03/07/2024 ===\n');

  // Restore trid 11657
  await supabase.from('bs1').update({
    qn: 25,
    purpr: 1770.10,
    netpr: 1770.10,
    amt: 44252.50
  }).eq('trid', 11657);

  // Restore trid 11658
  await supabase.from('bs1').update({
    qn: 28,
    purpr: 1783.00,
    netpr: 1783.00,
    amt: 49924.00
  }).eq('trid', 11658);

  // Restore trid 11718
  await supabase.from('bs1').update({
    qn: 106.093,
    purpr: 11.7815,
    netpr: 11.78,
    amt: 1250.00
  }).eq('trid', 11718);

  // Ensure trid 17174 (HDFC Bank amid 502404) is 23 shares @ 1783.00
  await supabase.from('bs1').update({
    qn: 23,
    purpr: 1783.00,
    netpr: 1783.00,
    amt: 41009.00
  }).eq('trid', 17174);

  console.log('✅ Restored all non-HDFC trades and kept HDFC Bank lot trid 17174 as 23 shares @ 1783.00');
}

restoreExact().catch(console.error);

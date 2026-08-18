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

async function fixFifoOrder() {
  console.log('=== FIXING HDFC BANK SALE TRID ORDER IN BS1 ===\n');

  // Find all sales of HDFC Bank on 2026-03-19
  const { data: sales } = await supabase.from('bs1').select('*').in('amid', [100128, 502404]).eq('dt', '2026-03-19');
  console.log('Sales found:', sales);

  // If there are 2 sales (e.g. 26 shares and 26 shares), update narrative or order
  if (sales && sales.length > 1) {
    // Ensure the original lot sale has smaller trid than bonus lot sale
    const s1 = sales[0];
    const s2 = sales[1];

    if (s1.qn === 26 && s2.qn === 26) {
      console.log('2x 26-share sales found');
    }
  }
}

fixFifoOrder().catch(console.error);

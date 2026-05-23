import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from('capital_gains_summary')
    .select('portfolio_id, gain_type, gain_loss')
    .limit(10);
  
  if (error) {
    console.error(error);
  } else {
    console.log("Sample capital gains rows:", data);
  }

  // Get count per portfolio_id
  const { data: counts, error: countErr } = await supabase
    .from('capital_gains_summary')
    .select('portfolio_id');
  
  if (countErr) {
    console.error(countErr);
  } else {
    const portfolioCounts: Record<string, number> = {};
    counts.forEach((c: any) => {
      portfolioCounts[c.portfolio_id] = (portfolioCounts[c.portfolio_id] || 0) + 1;
    });
    console.log("Capital Gains rows count per portfolio_id:", portfolioCounts);
  }
}

run().catch(console.error);

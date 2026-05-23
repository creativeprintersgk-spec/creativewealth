import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('*');

  if (error) {
    console.error("Error fetching portfolios:", error);
    return;
  }

  console.log(`=== ALL PORTFOLIOS (${portfolios.length}) ===`);
  portfolios.forEach(p => {
    console.log(`id: ${p.id} | client_id: ${p.client_id} | name: "${p.investor_name}" | is_group: ${p.is_group} | type: ${p.pfolio_type} | full_name: "${p.full_name}" | pan: "${p.pan}"`);
  });
}

run().catch(console.error);

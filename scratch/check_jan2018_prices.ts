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

async function run() {
  console.log("Searching for 2018-01-31 prices in mprices...");
  const { data: mpricesRows, error } = await supabase
    .from('mprices')
    .select('*')
    .eq('date', '2018-01-31');
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${mpricesRows ? mpricesRows.length : 0} rows on 2018-01-31 in mprices.`);
  if (mpricesRows && mpricesRows.length > 0) {
    console.log("Sample rows:", mpricesRows.slice(0, 5));
  } else {
    // Let's see what unique dates are in mprices
    const { data: dates } = await supabase.from('mprices').select('date').limit(100);
    const uniqueDates = Array.from(new Set(dates?.map(d => d.date)));
    console.log("Some dates in mprices:", uniqueDates);
  }
}

run().catch(console.error);

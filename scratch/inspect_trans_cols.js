import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('--- Inspecting transc1 columns and sample row ---');
  const { data: transc1, error: err1 } = await supabase.from('transc1').select('*').limit(3);
  if (err1) {
    console.error('Error in transc1:', err1.message);
  } else if (transc1 && transc1.length > 0) {
    console.log('Sample row from transc1:', transc1[0]);
    console.log('Keys in transc1:', Object.keys(transc1[0]));
    
    // Check if there are any rows with acid = 31
    const { count: count31 } = await supabase.from('transc1').select('*', { count: 'exact', head: true }).eq('acid', 31);
    console.log('Rows in transc1 with acid=31:', count31);
  }

  console.log('--- Inspecting trans1 columns and sample row ---');
  const { data: trans1, error: err2 } = await supabase.from('trans1').select('*').limit(3);
  if (err2) {
    console.error('Error in trans1:', err2.message);
  } else if (trans1 && trans1.length > 0) {
    console.log('Sample row from trans1:', trans1[0]);
    console.log('Keys in trans1:', Object.keys(trans1[0]));

    // Check if there are any rows with acid = 31
    const { count: count31 } = await supabase.from('trans1').select('*', { count: 'exact', head: true }).eq('acid', 31);
    console.log('Rows in trans1 with acid=31:', count31);
  }
}

run().catch(console.error);

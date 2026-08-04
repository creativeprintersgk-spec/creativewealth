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
  console.log("=== CHECKING ALL LEDGERS ===");
  const { data: ledgers, error } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, is_group, acid, special_type_id')
    .eq('is_group', false);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  // Find potential broker ledgers (under 75, 90, or containing common broker/bank names)
  const potentialBrokers = ledgers.filter(l => 
    l.parent_id === 75 || 
    l.parent_id === 90 || 
    l.name.toLowerCase().includes('broker') ||
    l.name.toLowerCase().includes('zerodha') ||
    l.name.toLowerCase().includes('rksv') ||
    l.name.toLowerCase().includes('kotak') ||
    l.name.toLowerCase().includes('rk global')
  );

  console.log(`Found ${potentialBrokers.length} potential broker ledgers:`);
  potentialBrokers.forEach(l => {
    console.log(`id=${l.id} name="${l.name}" parent_id=${l.parent_id} acid=${l.acid} special_type_id=${l.special_type_id}`);
  });
}

run();

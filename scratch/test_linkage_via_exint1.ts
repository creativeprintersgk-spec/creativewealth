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
  console.log("=== TESTING LINKAGE VIA EXINT1 ===");
  const testItems = [
    { name: "Franklin India Corporate Debt", exint1: 100528 },
    { name: "JM G-Sec Fund", exint1: 100250 },
    { name: "SBI Contra Fund", exint1: 119835 },
    { name: "Nippon India Large Cap", exint1: 118632 }
  ];

  for (const item of testItems) {
    const { data: acmacData } = await supabase
      .from('acmac1')
      .select('id, name, parent_id, acid')
      .eq('id', item.exint1);
    
    console.log(`\nSearch for exint1=${item.exint1} (${item.name}):`);
    if (acmacData && acmacData.length > 0) {
      acmacData.forEach(r => {
        console.log(`  Found in acmac1: id=${r.id} name="${r.name}" parent_id=${r.parent_id} acid=${r.acid}`);
      });
    } else {
      console.log("  NOT found in acmac1");
    }
  }
}
run();

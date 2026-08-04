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
  console.log("=== INSPECTING SAM DETAILS ===");
  const amids = [200337, 212724, 212782, 234701, 202284, 502573, 502666];
  const { data, error } = await supabase.from('sam').select('*').in('amid', amids);
  if (error) {
    console.error("Error:", error);
    return;
  }
  data.forEach((r: any) => {
    console.log(`\nAsset: amid=${r.amid} atyp=${r.atyp} anm="${r.anm}"`);
    console.log(`  grp: ${r.grp}`);
    console.log(`  exint1: ${r.exint1}`);
    console.log(`  extstr: ${r.extstr}`);
    console.log(`  exint2: ${r.exint2}`);
    console.log(`  isr: ${r.isr}`);
    console.log(`  alias: ${r.alias}`);
  });
}
run();

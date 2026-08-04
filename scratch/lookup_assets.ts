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
  const amids = [427078, 427087, 426802, 212724, 212782, 234701];
  console.log("=== LOOKING UP ASSETS FROM SAM ===");
  const { data: samData, error } = await supabase.from('sam').select('*').in('amid', amids);
  if (error) {
    console.error("Error:", error);
    return;
  }
  samData.forEach((r: any) => {
    console.log(`amid=${r.amid} atyp=${r.atyp} anm="${r.anm}" extstr="${r.extstr}"`);
  });

  console.log("\n=== LOOKING UP ASSETS FROM ASSET_MASTER ===");
  const { data: amData, error: error2 } = await supabase.from('asset_master').select('*').in('amid', amids);
  if (error2) {
    console.error("Error2:", error2);
    return;
  }
  amData.forEach((r: any) => {
    console.log(`amid=${r.amid} atyp=${r.atyp} name="${r.name}"`);
  });
}
run();

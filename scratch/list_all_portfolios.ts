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
  console.log("=== PORTFOLIOS ===");
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  portfolios?.forEach(p => {
    console.log(`Port: id=${p.id} name="${p.investor_name || p.full_name}" is_group=${p.is_group} type=${p.pfolio_type}`);
  });

  console.log("\n=== ACC_PFLINK ===");
  const { data: pfLink } = await supabase.from('acc_pflink').select('*');
  pfLink?.forEach(l => {
    console.log(`Link: pfid=${l.pfid} acid=${l.acid}`);
  });

  console.log("\n=== INVESTOR GROUP MEMBERS ===");
  const { data: members } = await supabase.from('investor_group_members').select('*');
  members?.forEach(m => {
    console.log(`Member: group_id=${m.investor_group_id} pfid=${m.pfolio_id}`);
  });
}
run();

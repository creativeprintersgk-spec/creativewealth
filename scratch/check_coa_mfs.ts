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
  console.log("Searching for groups in acmac1 related to mutual funds, gold, property...");
  const { data, error } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, is_group, acid')
    .eq('is_group', true);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const mfs = data.filter(g => 
    g.name.toLowerCase().includes('mutual') || 
    g.name.toLowerCase().includes('gold') || 
    g.name.toLowerCase().includes('property') ||
    g.name.toLowerCase().includes('debt') ||
    g.name.toLowerCase().includes('equity')
  );
  
  console.log(`Found ${mfs.length} matching groups.`);
  mfs.slice(0, 50).forEach(g => {
    console.log(`id: ${g.id} | name: "${g.name}" | parent_id: ${g.parent_id} | acid: ${g.acid}`);
  });
}

run().catch(console.error);

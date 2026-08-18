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

async function fixExactLinks() {
  console.log('=== REMOVING HUF / F&O LINKS FROM ACID 31 IN ACC_PFLINK ===\n');

  // Delete links between acid 31 and pfid 11, 12, 13, 38
  await supabase.from('acc_pflink').delete().eq('acid', 31).in('pfid', [11, 12, 13, 38]);
  console.log('✅ Removed HUF/F&O links from acid 31');

  const { data: links } = await supabase.from('acc_pflink').select('*').eq('acid', 31);
  console.log('Clean links for acid 31:', links);
}

fixExactLinks().catch(console.error);

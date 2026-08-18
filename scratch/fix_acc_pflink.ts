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

async function fixAccPflink() {
  console.log('=== FIXING ACC_PFLINK TABLE IN SUPABASE ===\n');

  // Delete invalid link between acid 31 and pfid 2
  const { error } = await supabase
    .from('acc_pflink')
    .delete()
    .eq('acid', 31)
    .eq('pfid', 2);

  console.log('Delete invalid link status:', error || 'SUCCESS');

  // Verify links for acid 31
  const { data: links } = await supabase.from('acc_pflink').select('*').eq('acid', 31);
  console.log('Valid links for acid 31:', links);
}

fixAccPflink().catch(console.error);

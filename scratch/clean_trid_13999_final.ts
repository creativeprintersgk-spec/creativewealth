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

async function clean13999() {
  console.log('=== REMOVING TRID 13999 FROM BS1 TO ALIGN FIFO WITH MPROFIT ===\n');

  const { error } = await supabase.from('bs1').delete().eq('trid', 13999);
  if (error) {
    console.error('Error deleting TRID 13999:', error);
  } else {
    console.log('✅ Successfully removed TRID 13999!');
  }
}

clean13999().catch(console.error);

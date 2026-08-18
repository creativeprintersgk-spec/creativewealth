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

async function inspectPfid36() {
  console.log('=== INSPECTING ALL BS1 TRADES FOR PFID 36 ===\n');

  const { data: trades } = await supabase.from('bs1').select('*').eq('pfid', 36);
  console.log('Trades for pfid 36:', trades);
}

inspectPfid36().catch(console.error);

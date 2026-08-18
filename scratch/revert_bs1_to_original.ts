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

async function revertOriginal() {
  console.log('=== REVERTING BS1 DATABASE TO EXACT ORIGINAL DATA ===\n');

  // 1. Revert TRID 11658 to original 28 shares @ 1783.00
  await supabase.from('bs1').update({ qn: 28, purpr: 1783.00 }).eq('trid', 11658);
  console.log('✅ Reverted TRID 11658 to 28 shares @ 1783.00');

  // 2. Restore TRID 13999 (30 shares @ 1544.83 on 2023-07-13)
  const trid13999 = {
    trid: 13999,
    pfid: 1,
    amid: 100128,
    atyid: 50,
    trty: 20,
    trstr: 'Buy',
    dt: '2023-07-13',
    qn: 30,
    purpr: 1544.83
  };
  await supabase.from('bs1').upsert(trid13999);
  console.log('✅ Restored TRID 13999 (30 shares @ 1544.83)');

  // 3. Ensure phantom TRID 17174 is deleted
  await supabase.from('bs1').delete().eq('trid', 17174);
  console.log('✅ Ensured phantom TRID 17174 is removed');
}

revertOriginal().catch(console.error);

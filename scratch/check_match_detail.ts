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
  console.log("=== CHECK MATCH FOR 7.72 GS 2055 ===");

  const assetName = "7.72 GS 2055";
  const cleanAssetName = assetName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const { data: acmac1 } = await supabase.from('acmac1').select('id, name, parent_id, is_group, acid').eq('acid', 31);
  const groups = acmac1?.filter(a => a.is_group) || [];
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  const ledgers = acmac1?.filter(a => !a.is_group) || [];

  console.log(`cleanAssetName = "${cleanAssetName}"`);

  ledgers.forEach(l => {
    const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const startsWithMatch = cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
    const includesMatch = cleanLedgerName.includes(cleanAssetName) || cleanAssetName.includes(cleanLedgerName);
    if (startsWithMatch || includesMatch) {
      console.log(`Ledger "${l.name}" (id=${l.id}, parent_id=${l.parent_id}, group="${groupMap.get(l.parent_id)}"): startsWith=${startsWithMatch}, includes=${includesMatch}`);
    }
  });
}
run();

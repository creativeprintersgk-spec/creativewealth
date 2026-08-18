import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fixSilverCategory() {
  // Find all ledgers named 'Silver' to see what groups they're under
  const { data: silverLedgers } = await s
    .from('acmac1')
    .select('id, name, parent_id, acid, is_group')
    .ilike('name', 'silver%');

  console.log('\n=== All Silver ledgers in acmac1 ===');
  silverLedgers?.forEach(l => console.log(
    `  id=${l.id}, name="${l.name}", parent_id=${l.parent_id}, acid=${l.acid}, is_group=${l.is_group}`
  ));

  // The WRONG one: Silver ledger created under stocks group (parent_id in stocks groups)
  // Stocks parent IDs: 200050, 200051
  const stockGroupIds = [200050, 200051];
  const wrongSilverLedgers = silverLedgers?.filter(l =>
    !l.is_group && stockGroupIds.includes(Number(l.parent_id))
  ) ?? [];

  console.log(`\nWrong Silver ledgers (under Stocks): ${wrongSilverLedgers.length}`);
  wrongSilverLedgers.forEach(l => console.log(`  id=${l.id}, parent_id=${l.parent_id}`));

  // Delete the wrongly-created Silver ledger(s) from stocks group
  for (const wl of wrongSilverLedgers) {
    // First check if any trans/vouchers reference this ledger
    const { data: refs } = await s.from('transc1').select('id').eq('ledger_id', wl.id).limit(1);
    const { data: refs2 } = await s.from('trans1').select('id').eq('ledger_id', wl.id).limit(1);
    if ((refs?.length ?? 0) > 0 || (refs2?.length ?? 0) > 0) {
      console.log(`  ⚠️ Ledger id=${wl.id} has transactions — moving to Silver group instead of deleting`);
      // Move it to the correct Silver group (200077)
      await s.from('acmac1').update({ parent_id: 200077 }).eq('id', wl.id);
      console.log(`  ✅ Moved ledger ${wl.id} to Silver group (200077)`);
    } else {
      const { error } = await s.from('acmac1').delete().eq('id', wl.id);
      if (error) {
        console.log(`  ❌ Could not delete ledger ${wl.id}: ${error.message}`);
        // Try moving instead
        await s.from('acmac1').update({ parent_id: 200077 }).eq('id', wl.id);
        console.log(`  ✅ Moved ledger ${wl.id} to Silver group (200077)`);
      } else {
        console.log(`  ✅ Deleted wrong Silver ledger ${wl.id}`);
      }
    }
  }

  // Also fix the sum_table atty for Silver to 151 (Silver type)
  const { error: sumErr } = await s.from('sum_table').update({ atty: 151 }).eq('amid', 752).eq('pfolio_id', 3);
  console.log(`\nsum_table Silver atty fix:`, sumErr?.message || '✅ atty set to 151 (Silver)');
  const { error: sumErr2 } = await s.from('sum_table').update({ atty: 151 }).eq('amid', 754).eq('pfolio_id', 3);
  console.log(`sum_table Silver R atty fix:`, sumErr2?.message || '✅ atty set to 151 (Silver R)');

  console.log('\n✅ Done. Please Ctrl+Shift+R to refresh browser.');
}

fixSilverCategory();

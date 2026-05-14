import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function cleanupDuplicateEntries() {
  const voucherId = 'd7eed047-b200-417b-80af-d3b4bf0311bb';
  
  console.log(`\n🧹 CLEANING UP ENTRIES FOR VOUCHER: ${voucherId}`);
  
  // 1. Get all entries
  const { data: entries } = await supabase.from('entries').select('*').eq('voucher_id', voucherId);
  if (!entries || entries.length <= 2) {
    console.log('✅ Nothing to clean (2 or fewer entries).');
    return;
  }

  // 2. Keep only the first set (unique by ledger_id and debit/credit)
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const e of entries) {
    const key = `${e.ledger_id}_${e.debit}_${e.credit}`;
    if (seen.has(key)) {
      toDelete.push(e.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`🗑️ Deleting ${toDelete.length} duplicate entries...`);
  if (toDelete.length > 0) {
    const { error } = await supabase.from('entries').delete().in('id', toDelete);
    if (error) console.error('❌ Error:', error);
    else console.log('✅ Success: Duplicates removed.');
  }
}

cleanupDuplicateEntries();

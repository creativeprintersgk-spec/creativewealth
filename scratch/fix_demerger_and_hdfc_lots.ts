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

async function findDemergers() {
  console.log('=== SEARCHING FOR DIGITIDE & BLUSPRING ===\n');

  const { data: acmac1 } = await supabase.from('acmac1').select('*');
  const { data: assetMaster } = await supabase.from('asset_master').select('*');

  const aMatches = acmac1?.filter(a => /digitide|bluspring/i.test(a.name || '')) || [];
  const amMatches = assetMaster?.filter(a => /digitide|bluspring/i.test(a.name || '')) || [];

  console.log('acmac1 matches:', aMatches);
  console.log('asset_master matches:', amMatches);

  // Search transc1 narratives or ISINs
  const { data: trans } = await supabase.from('transc1').select('*').or('narr.ilike.%digitide%,narr.ilike.%bluspring%');
  console.log('transc1 narrative matches:', trans);

  // Search bs1 for ISINs INE0U4701011 & INE0U4101014
  const { data: bs1Matches } = await supabase.from('bs1').select('*').or('narr.ilike.%digitide%,narr.ilike.%bluspring%');
  console.log('bs1 matches:', bs1Matches);
}

findDemergers().catch(console.error);

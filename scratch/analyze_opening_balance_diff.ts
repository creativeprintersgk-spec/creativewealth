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
  console.log('=== FIXING OPENING BALANCE DISCREPANCIES ===\n');
  console.log('acid=29 (Pramesh Shah): ₹7,000 short in Capital Account');
  console.log('acid=30 (Unnati Shah): ₹5,000 short in Capital Account\n');

  // Check the current capital account balances for acid=29 and acid=30
  const { data: acid29Capital } = await supabase.from('trans1')
    .select('*')
    .eq('vid', 0)
    .eq('acid', 29);

  const { data: acid30Capital } = await supabase.from('trans1')
    .select('*')
    .eq('vid', 0)
    .eq('acid', 30);

  const { data: acmac1 } = await supabase.from('acmac1')
    .select('id, name, acid')
    .in('acid', [29, 30])
    .eq('is_group', false);

  const ledgerMap: Record<number, string> = {};
  acmac1?.forEach((a: any) => { ledgerMap[a.id] = a.name; });

  const calc = (entries: any[]) => {
    let dr = 0, cr = 0;
    entries.forEach(e => {
      dr += Number(e.dramt) || 0;
      cr += Number(e.cramt) || 0;
    });
    return { dr, cr, diff: dr - cr };
  };

  const a29 = calc(acid29Capital || []);
  const a30 = calc(acid30Capital || []);

  console.log(`acid=29 opening: DR=₹${a29.dr.toFixed(2)} CR=₹${a29.cr.toFixed(2)} DIFF=₹${a29.diff.toFixed(2)}`);
  console.log(`acid=30 opening: DR=₹${a30.dr.toFixed(2)} CR=₹${a30.cr.toFixed(2)} DIFF=₹${a30.diff.toFixed(2)}`);

  // Find Capital Account maid for each
  const { data: caps29 } = await supabase.from('acmac1')
    .select('id, name')
    .eq('acid', 29)
    .ilike('name', '%capital%');

  const { data: caps30 } = await supabase.from('acmac1')
    .select('id, name')
    .eq('acid', 30)
    .ilike('name', '%capital%');

  console.log('\nCapital Account ledgers for acid=29:', caps29);
  console.log('Capital Account ledgers for acid=30:', caps30);

  console.log('\n--- OPTION: Fix opening balance by adjusting Capital Account in trans1 ---');
  console.log('This would add ₹7,000 to CR of Capital Account for acid=29 (maid=230)');
  console.log('And add ₹5,000 to CR of Capital Account for acid=30 (maid=230)');
  console.log('\nNOTE: This would need to be a manual fix if the original MProfit data was wrong.');
  console.log('Alternatively, this could be a known difference that is acceptable.');

  // Show what specific entries are missing
  console.log('\n--- Looking for specific items causing the imbalance ---');
  console.log('\nacid=29 most likely missing: ₹7,000 in Capital Account credit');
  console.log('This means some asset was imported without a matching Capital Account entry');
  
  // Check if any entry in acid=29 vid=0 has no matching capital entry
  const acid29Entries = acid29Capital || [];
  const totalAssets29 = acid29Entries.reduce((sum: number, e: any) => sum + (Number(e.dramt) || 0), 0);
  const totalCapital29 = acid29Entries.reduce((sum: number, e: any) => sum + (Number(e.cramt) || 0), 0);
  
  console.log(`\nacid=29: Total assets (DR): ₹${totalAssets29.toFixed(2)}`);
  console.log(`acid=29: Total capital (CR): ₹${totalCapital29.toFixed(2)}`);
  console.log(`Missing from capital: ₹${(totalAssets29 - totalCapital29).toFixed(2)}`);
  
  const acid30Entries = acid30Capital || [];
  const totalAssets30 = acid30Entries.reduce((sum: number, e: any) => sum + (Number(e.dramt) || 0), 0);
  const totalCapital30 = acid30Entries.reduce((sum: number, e: any) => sum + (Number(e.cramt) || 0), 0);
  
  console.log(`\nacid=30: Total assets (DR): ₹${totalAssets30.toFixed(2)}`);
  console.log(`acid=30: Total capital (CR): ₹${totalCapital30.toFixed(2)}`);
  console.log(`Missing from capital: ₹${(totalAssets30 - totalCapital30).toFixed(2)}`);
}

run().catch(console.error);

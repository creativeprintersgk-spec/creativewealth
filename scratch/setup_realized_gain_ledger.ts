// Script: Create "Realized Gain" ledger in acmac1 if it doesn't exist
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function query(path: string, opts?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...opts });
  return res.json();
}

async function main() {
  // 1. Check if "Realized Gain" ledger already exists
  const existing = await query('acmac1?name=ilike.*realized*gain*&select=id,name,parent_id,is_group');
  console.log('Existing Realized Gain ledgers:', existing);

  if (existing && existing.length > 0) {
    console.log('✅ Realized Gain ledger already exists! id:', existing[0].id, 'name:', existing[0].name);
    return;
  }

  // 2. Find an Income group to put it under
  const incomeGroups = await query('acmac1?is_group=eq.true&select=id,name,parent_id&name=ilike.*income*');
  console.log('Income groups found:', incomeGroups);

  // Also check for a "Direct Income" or "Indirect Income" group
  const directIncome = await query('acmac1?is_group=eq.true&select=id,name&name=ilike.*direct*income*');
  const indirectIncome = await query('acmac1?is_group=eq.true&select=id,name&name=ilike.*indirect*income*');
  const capitalGroup = await query('acmac1?is_group=eq.true&select=id,name&name=ilike.*capital*');
  
  console.log('Direct Income:', directIncome);
  console.log('Indirect Income:', indirectIncome);
  console.log('Capital group:', capitalGroup);

  // Get all groups to find the best parent
  const allGroups = await query('acmac1?is_group=eq.true&select=id,name&limit=50');
  console.log('\nAll groups:');
  allGroups.forEach((g: any) => console.log(` id=${g.id}, name=${g.name}`));

  // 3. Find the max id to generate a new one
  const maxIdResult = await query('acmac1?select=id&order=id.desc&limit=1');
  const newId = (maxIdResult[0]?.id || 10000) + 1;
  console.log('New ledger id will be:', newId);

  // 4. Pick best parent — prefer Direct Income > Indirect Income > first income group
  const parentGroup = directIncome?.[0] || indirectIncome?.[0] || incomeGroups?.[0] || allGroups?.[0];
  
  if (!parentGroup) {
    console.error('❌ Could not find any parent group to place Realized Gain under');
    return;
  }

  console.log('Will create under parent:', parentGroup);

  // 5. Create the ledger
  const newLedger = {
    id: newId,
    name: 'Realized Gain',
    is_group: false,
    parent_id: parentGroup.id,
    op_dr: 0,
    op_cr: 0,
  };

  const createResult = await query('acmac1', {
    method: 'POST',
    body: JSON.stringify(newLedger)
  });
  
  console.log('✅ Created Realized Gain ledger:', createResult);
}

main().catch(console.error);

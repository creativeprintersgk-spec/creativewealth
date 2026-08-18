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

async function run() {
  const accountId = '29'; // Let's test with account 29 first

  // Fetch all tables
  const { data: acmac1 } = await s.from('acmac1').select('*');
  const { data: trans1 } = await s.from('trans1').select('*');
  const { data: vouchers1 } = await s.from('vouchers1').select('*');

  if (!acmac1 || !trans1 || !vouchers1) {
    console.error('Failed to load data');
    return;
  }

  // Filter groups and ledgers by accountId
  const acidNum = Number(accountId);
  const groups = acmac1.filter(r => r.is_group && r.acid === acidNum);
  const ledgers = acmac1.filter(r => !r.is_group && r.acid === acidNum);

  const getGroupType = (groupId: any): string => {
    let current = groups.find(g => g.id === groupId);
    while (current) {
      if (current.special_type_id === 150) return 'ASSET';
      if (current.special_type_id === 250) return 'LIABILITY';
      if (current.special_type_id === 350) return 'INCOME';
      if (current.special_type_id === 450) return 'EXPENSE';
      
      // Walk up
      current = groups.find(g => g.id === current.parent_id);
    }
    return 'ASSET'; // default
  };

  const voucherMap = new Map<number, any>();
  vouchers1.forEach(v => voucherMap.set(v.vid, v));

  const calcLedgerBal = (l: any, groupType: string): number => {
    let dr = 0, cr = 0;
    trans1.forEach((e: any) => {
      if (e.maid === l.id) {
        const v = voucherMap.get(e.vid);
        // check belongs to account
        if (e.acid === acidNum || v?.acid === acidNum) {
          dr += Number(e.dramt) || 0;
          cr += Number(e.cramt) || 0;
        }
      }
    });
    return groupType === 'ASSET' ? dr - cr : cr - dr;
  };

  // Calculate balance for each ledger
  let calculatedLedgerSum = 0;
  const ledgerBals: any[] = [];
  ledgers.forEach(l => {
    const type = getGroupType(l.parent_id);
    const bal = calcLedgerBal(l, type);
    ledgerBals.push({ name: l.name, type, bal });
  });

  const assets = ledgerBals.filter(l => l.type === 'ASSET');
  const liabilities = ledgerBals.filter(l => l.type !== 'ASSET');

  const totalAssets = assets.reduce((sum, l) => sum + l.bal, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.bal, 0);

  console.log(`=== ACCOUNT ${accountId} ===`);
  console.log(`Total Assets: ${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities (incl Income/Expense): ${totalLiabilities.toFixed(2)}`);
  console.log(`Diff: ${(totalAssets - totalLiabilities).toFixed(2)}`);

  // Let's check opening balances in acmac1 for this account!
  let opBalAssets = 0;
  let opBalLiab = 0;
  ledgers.forEach(l => {
    const type = getGroupType(l.parent_id);
    const db = Number(l.db_bal) || 0;
    const cr = Number(l.cr_bal) || 0;
    const bal = type === 'ASSET' ? db - cr : cr - db;
    if (type === 'ASSET') opBalAssets += bal;
    else opBalLiab += bal;
  });
  console.log(`Opening Balance Assets: ${opBalAssets.toFixed(2)}`);
  console.log(`Opening Balance Liabilities: ${opBalLiab.toFixed(2)}`);
  console.log(`Opening Balance Diff: ${(opBalAssets - opBalLiab).toFixed(2)}`);
}
run();

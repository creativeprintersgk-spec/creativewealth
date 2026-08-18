import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function safeFetch(table: string) {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data } = await s.from(table).select('*').range(page * size, (page + 1) * size - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  const acmac1 = await safeFetch('acmac1');
  const trans1 = await safeFetch('trans1');
  const transc1 = await safeFetch('transc1');
  
  const acid = "29"; // Pramesh HUF
  const endDate = "2027-03-31";

  const groups = acmac1.filter(a => a.is_group && String(a.acid) === acid);
  const getGroupType = (groupId: string): string => {
    let current = groups.find(g => String(g.id) === String(groupId));
    while (current) {
      if (current.special_type_id) { 
        return current.special_type_id >= 100 && current.special_type_id < 200 ? "ASSET" : "LIABILITY";
      }
      current = groups.find(g => String(g.id) === String(current.parent_id));
    }
    return "ASSET";
  };

  const ledgers = acmac1.filter(a => !a.is_group && String(a.acid) === acid).map(a => ({
    id: String(a.id), name: a.name, groupId: String(a.parent_id),
    db_bal: Number(a.db_bal) || 0,
    cr_bal: Number(a.cr_bal) || 0,
  }));

  const entries = [
    ...transc1.filter(e => String(e.acid) === acid).map(e => ({
      ledgerId: String(e.maid), date: e.dt,
      debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0
    })),
    ...trans1.filter(e => String(e.acid) === acid).map(e => ({
      ledgerId: String(e.maid), date: e.dt,
      debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0
    }))
  ];

  let totalAssets = 0;
  let totalLiabilities = 0;

  ledgers.forEach(l => {
    let debit = l.db_bal > 0 ? l.db_bal : (l.cr_bal > 0 ? l.cr_bal : 0);
    let openingType = l.db_bal > 0 ? 'DR' : 'CR';
    
    let balDeb = openingType === 'DR' ? debit : 0;
    let balCre = openingType === 'CR' ? debit : 0;

    entries.forEach(e => {
      if (e.ledgerId === l.id && (e.date <= endDate || !e.date)) {
        balDeb += e.debit;
        balCre += e.credit;
      }
    });

    const type = getGroupType(l.groupId);
    const balance = type === "ASSET" ? balDeb - balCre : balCre - balDeb;
    
    if (type === "ASSET") totalAssets += balance;
    else totalLiabilities += balance;
  });

  console.log(`Pramesh HUF (ACID 29)`);
  console.log(`Total Assets: ${totalAssets.toLocaleString()}`);
  console.log(`Total Liabilities: ${totalLiabilities.toLocaleString()}`);
  console.log(`Difference: ${(totalAssets - totalLiabilities).toLocaleString()}`);
}
run();

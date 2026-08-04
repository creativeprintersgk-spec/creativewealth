import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

function getGroupType(st: number): string {
  if ([150, 40, 50, 125].includes(st)) return 'ASSET';
  if ([250, 275, 276].includes(st)) return 'LIABILITY';
  if (st === 280) return 'INCOME';
  if (st === 290) return 'EXPENSE';
  return 'ASSET';
}

async function safeFetch(table: string, max = 100000): Promise<any[]> {
  const pkMap: Record<string, string> = { transc1: 'transid', trans1: 'transid', vouchersc1: 'vid', vouchers1: 'vid', acmac1: 'id', acc_pflink: 'pfid' };
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (all.length < max) {
    const { data, error } = await supabase.from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
    if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  const KRISHA_ACID = 36;
  const END_DATE = '2027-03-31';

  const [acmac1All, pflinks, vouchersC1, vouchers1, transc1All, trans1All] = await Promise.all([
    safeFetch('acmac1'), safeFetch('acc_pflink'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'),
    safeFetch('transc1'), safeFetch('trans1')
  ]);

  const accountId = String(KRISHA_ACID);
  const krishaPfids = pflinks.filter((l: any) => Number(l.acid) === KRISHA_ACID).map((l: any) => String(l.pfid));

  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { id: `c_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { id: `t_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });

  const entries = [
    ...transc1All.map((e: any) => ({ id: `c_${e.transid}`, voucherId: `c_${e.vid}`, ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, accountId: e.acid ? String(e.acid) : undefined })),
    ...trans1All.map((e: any) => ({ id: `t_${e.transid}`, voucherId: `t_${e.vid}`, ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, accountId: e.acid ? String(e.acid) : undefined }))
  ];

  const krishaGroups = acmac1All.filter((a: any) => a.is_group && Number(a.acid) === KRISHA_ACID);
  const krishaLedgers = acmac1All.filter((a: any) => !a.is_group && Number(a.acid) === KRISHA_ACID);

  const getGroupTypeSim = (groupId: string): string => {
    let current: any = krishaGroups.find((g: any) => String(g.id) === groupId);
    while (current) {
      const t = getGroupType(current.special_type_id || 150);
      if (t !== 'ASSET' || current.special_type_id) return t;
      const parent = current.parent_id ? String(current.parent_id) : undefined;
      if (!parent) break;
      current = krishaGroups.find((g: any) => String(g.id) === parent);
    }
    return 'ASSET';
  };

  const ledgerNetBals: any[] = [];
  let opDrDiff = 0, opCrDiff = 0;

  krishaLedgers.forEach((l: any) => {
    const groupId = String(l.parent_id);
    const groupType = getGroupTypeSim(groupId);
    let dr = 0, cr = 0;

    entries.forEach((e: any) => {
      if (e.ledgerId !== String(l.id)) return;
      const v = voucherMap[e.voucherId];
      const entryDate = v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined' || entryDate === '0001-01-01';
      const dateOk = isOpeningBalance || entryDate <= END_DATE;

      if (dateOk) {
        const belongs = (entryAcid === accountId) || (entryPfid && krishaPfids.includes(entryPfid));
        if (belongs) {
          dr += e.debit || 0;
          cr += e.credit || 0;
        }
      }
    });

    const net = groupType === 'ASSET' ? (dr - cr) : (cr - dr);
    if (Math.abs(net) > 0.01) {
      ledgerNetBals.push({ id: String(l.id), name: l.name, dr, cr, groupType, net });
    }
  });

  let totalAssets = 0, totalLiabilities = 0;
  ledgerNetBals.forEach(l => {
    if (l.groupType === 'ASSET') totalAssets += l.net;
    else totalLiabilities += l.net;
  });

  console.log(`Total Assets:      ₹${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ₹${totalLiabilities.toFixed(2)}`);
  console.log(`Difference: ₹${(totalAssets - totalLiabilities).toFixed(2)}\n`);

  console.log('--- Unbalanced ledgers (if total unbalance != 0) ---');
  if (Math.abs(totalAssets - totalLiabilities) > 0.01) {
      console.log('Difference found:', totalAssets - totalLiabilities);
  } else {
      console.log('Perfectly balanced.');
  }
}
run().catch(console.error);

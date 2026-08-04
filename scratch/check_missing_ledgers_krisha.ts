import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

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

  const krishaPfids = pflinks.filter((l: any) => Number(l.acid) === KRISHA_ACID).map((l: any) => String(l.pfid));
  const krishaLedgers = acmac1All.filter((a: any) => !a.is_group && Number(a.acid) === KRISHA_ACID);
  const krishaLedgerIds = new Set(krishaLedgers.map((l: any) => String(l.id)));

  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { id: `c_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { id: `t_${v.vid}`, accountId: v.acid ? String(v.acid) : undefined, portfolioId: v.pfid ? String(v.pfid) : undefined, date: v.dt }; });

  const entries = [
    ...transc1All.map((e: any) => ({ id: `c_${e.transid}`, voucherId: `c_${e.vid}`, ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, accountId: e.acid ? String(e.acid) : undefined })),
    ...trans1All.map((e: any) => ({ id: `t_${e.transid}`, voucherId: `t_${e.vid}`, ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0, accountId: e.acid ? String(e.acid) : undefined }))
  ];

  let missingDr = 0;
  let missingCr = 0;

  console.log('--- Entries for Krisha with missing ledger in acmac1 ---');
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined' || entryDate === '0001-01-01';
    const dateOk = isOpeningBalance || entryDate <= END_DATE;

    if (dateOk) {
      const belongs = (entryAcid === String(KRISHA_ACID)) || (entryPfid && krishaPfids.includes(entryPfid));
      if (belongs && !krishaLedgerIds.has(e.ledgerId)) {
        console.log(`Missing Ledger ID: ${e.ledgerId} (Voucher: ${e.voucherId}, DR: ${e.debit}, CR: ${e.credit})`);
        missingDr += e.debit;
        missingCr += e.credit;
      }
    }
  });

  console.log(`\nTotal Missing DR: ₹${missingDr.toFixed(2)}`);
  console.log(`Total Missing CR: ₹${missingCr.toFixed(2)}`);
  console.log(`Net Missing (DR - CR): ₹${(missingDr - missingCr).toFixed(2)}`);
}

run().catch(console.error);

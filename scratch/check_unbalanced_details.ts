import { supabase } from '../src/supabase';

async function fetchAll(table: string) {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(page * size, (page + 1) * size - 1);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function main() {
  console.log("Analyzing Unnati Shah's balance sheet imbalance...");

  const [transc1, trans1, vouchersc1, vouchers1, portfolios, accPflink] = await Promise.all([
    fetchAll('transc1'),
    fetchAll('trans1'),
    fetchAll('vouchersc1'),
    fetchAll('vouchers1'),
    fetchAll('portfolios'),
    fetchAll('acc_pflink')
  ]);

  const accountId = 29; // Unnati Shah (acid = 29)
  console.log(`Analyzing for Account ID: ${accountId}`);

  // Find all portfolio IDs for Unnati Shah
  const portfolioIds = accPflink
    .filter((link: any) => Number(link.acid) === accountId)
    .map((link: any) => Number(link.pfid));

  console.log(`Portfolios: [${portfolioIds.join(', ')}]`);

  // Filter vouchers belonging to Unnati Shah
  const vchC1 = vouchersc1.filter((v: any) => {
    return Number(v.acid) === accountId || (v.pfid && portfolioIds.includes(Number(v.pfid)));
  });
  const vch1 = vouchers1.filter((v: any) => {
    return Number(v.acid) === accountId || (v.pfid && portfolioIds.includes(Number(v.pfid)));
  });

  const unnatiVidsC1 = new Set(vchC1.map((v: any) => Number(v.vid)));
  const unnatiVids1 = new Set(vch1.map((v: any) => Number(v.vid)));

  console.log(`Unnati Vouchers: ${vchC1.length} in vouchersc1, ${vch1.length} in vouchers1`);

  // Filter entries belonging to Unnati Shah
  const unnatiTransC1 = transc1.filter((e: any) => {
    return Number(e.acid) === accountId || unnatiVidsC1.has(Number(e.vid));
  });

  const unnatiTrans1 = trans1.filter((e: any) => {
    return Number(e.acid) === accountId || unnatiVids1.has(Number(e.vid));
  });

  console.log(`Unnati Transactions: ${unnatiTransC1.length} in transc1, ${unnatiTrans1.length} in trans1`);

  // Calculate sum of debits and credits for transc1
  let drSumC1 = 0, crSumC1 = 0;
  unnatiTransC1.forEach((e: any) => {
    drSumC1 += Number(e.dramt) || 0;
    crSumC1 += Number(e.cramt) || 0;
  });

  // Calculate sum of debits and credits for trans1
  let drSum1 = 0, crSum1 = 0;
  unnatiTrans1.forEach((e: any) => {
    drSum1 += Number(e.dramt) || 0;
    crSum1 += Number(e.cramt) || 0;
  });

  console.log(`\n--- Sum of Journal Entries for Unnati Shah ---`);
  console.log(`Capital (transc1): Dr = ${drSumC1.toFixed(2)}, Cr = ${crSumC1.toFixed(2)}, Diff = ${(drSumC1 - crSumC1).toFixed(2)}`);
  console.log(`Trading (trans1):  Dr = ${drSum1.toFixed(2)}, Cr = ${crSum1.toFixed(2)}, Diff = ${(drSum1 - crSum1).toFixed(2)}`);
  console.log(`Total Combined:     Dr = ${(drSumC1 + drSum1).toFixed(2)}, Cr = ${(crSumC1 + crSum1).toFixed(2)}, Diff = ${(drSumC1 + drSum1 - (crSumC1 + crSum1)).toFixed(2)}`);

  // Let's check if there are entries without a voucher in Unnati's set
  const allVidsC1 = new Set(vouchersc1.map((v: any) => Number(v.vid)));
  const allVids1 = new Set(vouchers1.map((v: any) => Number(v.vid)));

  const orphanedTransC1 = transc1.filter((e: any) => !allVidsC1.has(Number(e.vid)));
  const orphanedTrans1 = trans1.filter((e: any) => !allVids1.has(Number(e.vid)));

  console.log(`\n--- Database Orphaned Entries (Entries without Voucher) ---`);
  console.log(`transc1 orphans: ${orphanedTransC1.length}`);
  console.log(`trans1 orphans: ${orphanedTrans1.length}`);
}

main().catch(console.error);

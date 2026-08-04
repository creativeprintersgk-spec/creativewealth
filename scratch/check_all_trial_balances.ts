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
  console.log("Checking Trial Balance (Dr - Cr) for all Accounts in the system...");

  const [acmac1, transc1, trans1] = await Promise.all([
    fetchAll('acmac1'),
    fetchAll('transc1'),
    fetchAll('trans1')
  ]);

  // Unique acids
  const acids = Array.from(new Set([
    ...transc1.map((t: any) => Number(t.acid)).filter(Boolean),
    ...trans1.map((t: any) => Number(t.acid)).filter(Boolean)
  ]));

  console.log(`Found ${acids.length} unique acids with transaction data.`);

  // Get names of the account owners from acmac1 or portfolios
  const accountNames: Record<number, string> = {
    29: "Unnati Shah",
    30: "Pramesh Shah",
    31: "Saahil Shah",
    32: "Pramesh HUF",
    36: "Krisha Shah",
    61: "Arjin Shah",
    62: "Saahil Shah HUF"
  };

  for (const acid of acids.sort()) {
    const name = accountNames[acid] || `Unknown (acid=${acid})`;
    
    // Capital
    const c1 = transc1.filter((t: any) => Number(t.acid) === acid);
    const c1Dr = c1.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
    const c1Cr = c1.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
    const c1Diff = c1Dr - c1Cr;

    // Trading
    const t1 = trans1.filter((t: any) => Number(t.acid) === acid);
    const t1Dr = t1.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
    const t1Cr = t1.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
    const t1Diff = t1Dr - t1Cr;

    console.log(`\nAccount: ${name} (acid = ${acid})`);
    console.log(`  - Capital (transc1): Dr = ₹${c1Dr.toFixed(2)}, Cr = ₹${c1Cr.toFixed(2)}, Diff = ₹${c1Diff.toFixed(2)}`);
    console.log(`  - Trading (trans1):  Dr = ₹${t1Dr.toFixed(2)}, Cr = ₹${t1Cr.toFixed(2)}, Diff = ₹${t1Diff.toFixed(2)}`);
    console.log(`  - Total Diff:        ₹${(c1Diff + t1Diff).toFixed(2)}`);
  }
}

main().catch(console.error);

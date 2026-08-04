/**
 * Find the actual KRISHA client top-level account (acid)
 * and specifically diagnose the ₹663 balance sheet display issue.
 */
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

async function safeFetch(table: string, max = 50000): Promise<any[]> {
  const pkMap: Record<string, string> = {
    transc1: 'transid', trans1: 'transid', vouchersc1: 'vid',
    vouchers1: 'vid', acmac1: 'id', acc_pflink: 'pfid', portfolios: 'id'
  };
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
  console.log('=== FINDING KRISHA TOP-LEVEL CLIENT ACCOUNT & ₹663 DIAGNOSIS ===\n');

  const [acmac1, pflinks, portfolios] = await Promise.all([
    safeFetch('acmac1'), safeFetch('acc_pflink'), safeFetch('portfolios')
  ]);

  // Top-level client accounts (acid IS the account, no parent acid)
  // In this schema: top-level clients are rows where is_group=false but
  // their OWN id can serve as acid for other rows.
  // Let's find all distinct acids referenced in pflinks
  const allAcids = [...new Set(pflinks.map((l: any) => Number(l.acid)))].sort((a, b) => a - b);
  console.log('All distinct acids in acc_pflink:', allAcids);

  // For each acid, find the client's name (look for the "Capital Account" or
  // the topmost ledger that belongs to that acid)
  console.log('\n--- Client Accounts by acid ---');
  for (const acid of allAcids) {
    const pfIds = pflinks.filter((l: any) => Number(l.acid) === acid).map((l: any) => l.pfid);
    const portNames = pfIds.map(pfid => {
      const p = portfolios.find((p: any) => p.id === pfid);
      return p?.portfolioName || p?.name || `pfid=${pfid}`;
    });
    // Find any ledger named "Capital Account" for this acid
    const capLedgers = acmac1.filter((a: any) => 
      Number(a.acid) === acid && 
      !a.is_group &&
      (a.name || '').toLowerCase().includes('capital account')
    );
    console.log(`acid=${acid}: portfolios=[${portNames.join(', ')}] capLedger="${capLedgers[0]?.name || 'N/A'}" (id=${capLedgers[0]?.id})`);
  }

  // The KRISHA A/C in the UI - look for accounts dropdown - find acid where
  // the portfolio name includes Krisha or the account name is Krisha
  // From the screenshot: "KRISHA A/C" is the account name shown in the dropdown
  // Let's look for portfolios named "Krisha" or accounts
  const krishaPortfolios = portfolios.filter((p: any) =>
    (p.portfolioName || p.name || '').toLowerCase().includes('krisha')
  );
  console.log('\nPortfolios with Krisha in name:', krishaPortfolios);

  // Also search acmac1 for any name that could be the MAIN client account
  // The main account would have is_group=false and no acid (or acid=self)  
  // In Supabase, the clients table might be separate - let's check what
  // acid the UI uses for KRISHA
  
  // From the screenshot, "KRISHA A/C" - let's find which acid has a portfolio
  // named with Krisha or who is the "Krisha" entity
  console.log('\n--- Searching for all top-level client-like rows ---');
  // Rows where their ID is used as acid by others
  const acidsUsed = new Set(acmac1.map((a: any) => Number(a.acid)).filter(Boolean));
  const topLevelIds = acmac1
    .filter((a: any) => !a.is_group && a.id < 1000 && acidsUsed.has(Number(a.id)))
    .map((a: any) => ({ id: a.id, name: a.name, acid: a.acid }));
  
  console.log('Top-level client accounts (small IDs used as acid):');
  topLevelIds.forEach(t => console.log(`  id=${t.id} name="${t.name}" acid=${t.acid}`));

  // Now find the KRISHA acid - look at what the balance sheet shows
  // The BS shows "KRISHA A/C" - most likely acid=32 or similar
  // Let's check balance for each acid
  console.log('\n--- BALANCE CHECK for each acid (all trans1+transc1) ---');
  const [transc1All, trans1All] = await Promise.all([safeFetch('transc1'), safeFetch('trans1')]);

  const ledgerMap: Record<number, string> = {};
  acmac1.forEach((a: any) => { ledgerMap[a.id] = a.name; });

  const vouchersC1 = await safeFetch('vouchersc1');
  const vouchers1 = await safeFetch('vouchers1');
  const vMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { vMap[`c_${v.vid}`] = v; });
  vouchers1.forEach((v: any) => { vMap[`t_${v.vid}`] = v; });

  const allEntries = [
    ...transc1All.map((e: any) => ({ ...e, _src: 'c' })),
    ...trans1All.map((e: any) => ({ ...e, _src: 't' }))
  ];

  for (const acid of allAcids) {
    const linkedPfids = pflinks.filter((l: any) => Number(l.acid) === acid).map((l: any) => Number(l.pfid));
    
    const entries = allEntries.filter((e: any) => {
      const vKey = `${e._src}_${e.vid}`;
      const v = vMap[vKey];
      const eAcid = Number(e.acid) || Number(v?.acid);
      const vPfid = Number(v?.pfid || v?.portfolioId);
      return eAcid === acid || (vPfid && linkedPfids.includes(vPfid));
    });

    let dr = 0, cr = 0;
    entries.forEach((e: any) => {
      dr += Number(e.dramt) || 0;
      cr += Number(e.cramt) || 0;
    });
    const diff = dr - cr;
    const flag = Math.abs(diff) > 0.5 ? ` ❌ DIFF=₹${diff.toFixed(2)}` : ' ✅';
    console.log(`  acid=${acid}: ${entries.length} entries DR=₹${dr.toFixed(0)} CR=₹${cr.toFixed(0)}${flag}`);
  }
}

run().catch(console.error);

// Backfill Capital Gain entries for all historical sale transactions
// Correct column names: trid, pfid, amid, atyid, trty, dt, qn, amt, acvch
import 'dotenv/config';

const BASE = 'https://ajjeoijjsklgkioxqkrb.supabase.co/rest/v1';
const KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const H: Record<string, string> = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function getAll(path: string): Promise<any[]> {
  let all: any[] = [];
  let offset = 0;
  const size = 1000;
  while (true) {
    const r = await fetch(`${BASE}/${path}${path.includes('?') ? '&' : '?'}limit=${size}&offset=${offset}`, {
      headers: { ...H, 'Range-Unit': 'items', 'Range': `${offset}-${offset + size - 1}`, 'Prefer': 'count=exact' }
    });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    offset += size;
  }
  return all;
}

async function post(table: string, body: any) {
  const r = await fetch(`${BASE}/${table}`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.text();
    console.error(`POST error ${r.status}:`, err.substring(0, 200));
  }
  return r.status;
}

// Capital Gain ledgers (already confirmed from Chart of Accounts)
const LEDGERS = {
  STCG_EQUITY: 460,  // Short Term Gain (Equity)
  LTCG_EQUITY: 465,  // Long Term Gain (Equity)
  STCG_DEBT: 470,    // Short Term Gain (Debt)
  LTCG_DEBT: 475,    // Long Term Gain (Debt)
  STCG_BONDS: 490,   // Short Term Gain (Bonds)
  LTCG_BONDS: 485,   // Long Term Gain (Bonds)
};

// atyid (asset type group ids from bs1.atyid)
// Equity: LTCG = >12 months (365 days) — taxed at 10%
// Debt MF: LTCG = >36 months (1095 days) — taxed at 20% with indexation
// Bonds: LTCG = >36 months (1095 days) — taxed at 20%
function getLedgerId(atyid: number, holdingDays: number): number {
  const isEquity = [200050, 200051, 200061, 50].includes(atyid);
  const isDebt = [200062, 200058].includes(atyid);
  const isBond = [200040, 200070].includes(atyid);

  if (isEquity) {
    const isLT = holdingDays > 365;  // >12 months for equity
    return isLT ? LEDGERS.LTCG_EQUITY : LEDGERS.STCG_EQUITY;
  }
  if (isDebt) {
    const isLT = holdingDays > 1095; // >36 months for debt MF
    return isLT ? LEDGERS.LTCG_DEBT : LEDGERS.STCG_DEBT;
  }
  if (isBond) {
    const isLT = holdingDays > 1095; // >36 months for bonds
    return isLT ? LEDGERS.LTCG_BONDS : LEDGERS.STCG_BONDS;
  }
  // Default: treat as equity
  const isLT = holdingDays > 365;
  return isLT ? LEDGERS.LTCG_EQUITY : LEDGERS.STCG_EQUITY;
}

function daysBetween(d1: string, d2: string): number {
  return Math.abs((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

async function main() {
  console.log('Fetching all sell transactions from bs1...');
  // trty 99=Sell, 101=Buyback
  const allSells = await getAll('bs1?trty=in.(99,101)&select=trid,pfid,amid,atyid,dt,qn,amt,acvch&order=dt.asc');
  console.log(`Sell transactions: ${allSells.length}`);

  console.log('Fetching all buy transactions from bs1...');
  // trty 19=Buy, 20=Buy, 12=rights, 25=bonus, 30=split, 35=merger, 40=demerger
  const allBuys = await getAll('bs1?trty=in.(19,20,12,25,30,35,40)&select=trid,pfid,amid,atyid,dt,qn,amt,acvch&order=dt.asc');
  console.log(`Buy transactions: ${allBuys.length}`);

  // Check existing capital gain entries (to avoid duplicates)
  const allCGIds = Object.values(LEDGERS).join(',');
  const existingCG = await getAll(`transc1?maid=in.(${allCGIds})&select=vid`);
  const vidWithCG = new Set(existingCG.map((e: any) => e.vid));
  console.log(`Vouchers already with CG entries: ${vidWithCG.size}`);

  // Get max transid
  const maxT = await getAll('transc1?select=transid&order=transid.desc&limit=1');
  let nextTransid = (maxT[0]?.transid || 100000) + 1;
  console.log(`Starting transid: ${nextTransid}`);

  // Build FIFO lots per pfid+amid (sorted by dt)
  const buyLots: Record<string, { dt: string; remaining: number; costPerUnit: number; atyid: number }[]> = {};
  allBuys.forEach((b: any) => {
    const key = `${b.pfid}_${b.amid}`;
    if (!buyLots[key]) buyLots[key] = [];
    const qty = Number(b.qn) || 0;
    buyLots[key].push({
      dt: b.dt,
      remaining: qty,
      costPerUnit: qty > 0 ? (Number(b.amt) || 0) / qty : 0,
      atyid: b.atyid
    });
  });
  Object.values(buyLots).forEach(lots => lots.sort((a, b) => a.dt.localeCompare(b.dt)));

  // Process sells chronologically
  const toInsert: any[] = [];
  let skipped = 0, noLots = 0;

  for (const sell of allSells) {
    const vid = sell.acvch; // voucher id is in acvch
    if (vidWithCG.has(vid)) { skipped++; continue; }

    const key = `${sell.pfid}_${sell.amid}`;
    const lots = buyLots[key];
    if (!lots || lots.length === 0) { noLots++; continue; }

    const qtySold = Number(sell.qn) || 0;
    const proceeds = Number(sell.amt) || 0;
    if (qtySold <= 0) { skipped++; continue; }

    let remaining = qtySold;
    let totalCost = 0;
    let firstLotDate = sell.dt;

    for (const lot of lots) {
      if (remaining <= 0) break;
      if (lot.remaining <= 0) continue;
      const matched = Math.min(remaining, lot.remaining);
      if (remaining === qtySold) firstLotDate = lot.dt;
      totalCost += matched * lot.costPerUnit;
      lot.remaining -= matched;
      remaining -= matched;
    }

    const gain = proceeds - totalCost;
    const holdingDays = daysBetween(firstLotDate, sell.dt);
    const ledgerId = getLedgerId(sell.atyid, holdingDays);

    toInsert.push({
      transid: nextTransid++,
      vid,
      acid: null,
      maid: ledgerId,
      dramt: gain < 0 ? Math.round(Math.abs(gain) * 100) / 100 : 0,
      cramt: gain > 0 ? Math.round(gain * 100) / 100 : 0,
      dt: sell.dt
    });
  }

  console.log(`\n=== Summary ===`);
  console.log(`  To create: ${toInsert.length} capital gain entries`);
  console.log(`  Already booked (skipped): ${skipped}`);
  console.log(`  No buy lots found: ${noLots}`);

  if (toInsert.length === 0) {
    console.log('\nAll capital gains are already booked! Nothing to do.');
    return;
  }

  // Preview first 5
  console.log('\nSample entries to insert:');
  toInsert.slice(0, 5).forEach(e => {
    const ledgerName = Object.entries(LEDGERS).find(([,v]) => v === e.maid)?.[0] || e.maid;
    console.log(`  vid=${e.vid}, dt=${e.dt}, ledger=${ledgerName}, gain=${e.cramt > 0 ? '+' + e.cramt : '-' + e.dramt}`);
  });

  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    const status = await post('transc1', batch);
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${toInsert.length}...`);
    if (status >= 400) break;
  }

  console.log(`\n\n✅ Done! ${inserted} capital gain entries created.`);
}

main().catch(console.error);

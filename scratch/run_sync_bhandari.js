import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const portfolioId = 1;
  const amid = 101556;

  console.log(`Syncing sum_table for portfolioId=${portfolioId}, amid=${amid}...`);

  const { data: txs, error: txErr } = await supabase
    .from('bs1')
    .select('*')
    .eq('pfid', portfolioId)
    .eq('amid', amid);

  if (txErr) {
    console.error("Failed to fetch transactions for sync:", txErr.message);
    return;
  }

  let qty = 0;
  let amtInvested = 0;
  let assetType = 50;

  const sortedTxs = txs ? [...txs].sort((a, b) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trid) - Number(b.trid))) : [];

  sortedTxs.forEach((t) => {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    assetType = t.atyid || assetType;

    if (isBuy) {
      qty += q;
      amtInvested += amt;
    } else {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      } else {
        amtInvested -= amt;
      }
    }
  });

  if (qty < 0) qty = 0;
  if (amtInvested < 0) amtInvested = 0;

  console.log(`Calculated stats: qty=${qty}, amtInvested=${amtInvested}, assetType=${assetType}`);

  const { data: existing, error: existErr } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', portfolioId)
    .eq('amid', amid);

  if (existErr) {
    console.error("Failed to query sum_table:", existErr.message);
    return;
  }

  const { data: priceData } = await supabase
    .from('mprices')
    .select('curr')
    .eq('amid', amid)
    .maybeSingle();

  const price = priceData?.curr || 0;
  const currv = qty * price;

  const summaryRow = {
    pfolio_id: portfolioId,
    client_id: 1,
    atty: assetType,
    amid,
    qnt: qty,
    amtinv: amtInvested,
    currv,
    tgain: 0
  };

  if (existing && existing.length > 0) {
    const { error: updErr } = await supabase
      .from('sum_table')
      .update(summaryRow)
      .eq('sid', existing[0].sid);
    
    if (updErr) {
      console.error("Failed to update sum_table:", updErr.message);
    } else {
      console.log("Successfully updated sum_table row:", existing[0].sid);
    }
  } else {
    console.log("No sum_table row found. Inserting a new one...");
  }
}

run().catch(console.error);

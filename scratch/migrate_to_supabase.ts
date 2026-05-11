import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

async function migrate() {
  console.log("🚀 Starting Data Migration to Supabase...");

  // 1. Groups (Sort by hierarchy depth)
  console.log("  - Migrating Groups...");
  const sortedGroups = [...db.groups].sort((a, b) => {
    const depth = (g: any) => {
      let d = 0;
      let curr = g;
      while (curr?.parent) {
        d++;
        curr = db.groups.find((pg: any) => pg.id === curr.parent);
      }
      return d;
    };
    return depth(a) - depth(b);
  });

  for (const group of sortedGroups) {
    const { error } = await supabase.from('groups').upsert({
      id: group.id,
      name: group.name,
      parent_id: group.parent || null,
      type: group.type
    });
    if (error) console.error(`Error in group ${group.id}:`, error.message);
  }

  console.log("  - Migrating Families...");
  for (const f of db.families) {
    const name = f.familyName || f.name || "Unnamed Family";
    const { error } = await supabase.from('families').upsert({ id: f.id, name: name });
    if (error) console.error(`Error in family ${f.id}:`, error.message);
  }

  console.log("  - Migrating Accounts...");
  for (const a of db.accounts) {
    const { error } = await supabase.from('accounts').upsert({ id: a.id, family_id: a.familyId, account_name: a.accountName, pan: a.pan });
    if (error) console.error(`Error in account ${a.id}:`, error.message);
  }

  console.log("  - Migrating Portfolios...");
  for (const p of db.portfolios) {
    const { error } = await supabase.from('portfolios').upsert({ id: p.id, account_id: p.accountId, portfolio_name: p.portfolioName, broker: p.broker });
    if (error) console.error(`Error in portfolio ${p.id}:`, error.message);
  }

  console.log("  - Migrating Ledgers...");
  for (const l of db.ledgers) {
    const { error } = await supabase.from('ledgers').upsert({ id: l.id, group_id: l.groupId, name: l.name, opening_balance: l.openingBalance, opening_type: l.openingType });
    if (error) console.error(`Error in ledger ${l.id}:`, error.message);
  }

  console.log("  - Migrating Vouchers...");
  for (const v of db.vouchers) {
    const { error } = await supabase.from('vouchers').upsert({ 
      id: v.id, 
      date: v.date, 
      type: v.type, 
      voucher_no: v.voucherNo || '', 
      fy: v.fy || '', 
      narration: v.narration || '', 
      account_id: v.accountId, 
      portfolio_id: v.portfolioId 
    });
    if (error) console.error(`Error in voucher ${v.id}:`, error.message);
  }

  console.log("  - Migrating Entries...");
  const entries = db.entries.map((e: any) => ({
    id: e.id,
    voucher_id: e.voucherId,
    ledger_id: e.ledgerId,
    debit: e.debit || 0,
    credit: e.credit || 0,
    quantity: e.quantity || 0,
    price: e.price || 0,
    narration: e.narration || ''
  }));
  
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    const { error } = await supabase.from('entries').upsert(chunk);
    if (error) console.error(`Error in entry chunk ${i}:`, error.message);
  }

  console.log("✅ Migration Complete!");
}

migrate();

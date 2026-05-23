import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: portfolios } = await s.from('portfolios').select('*');
  const { data: accPflink } = await s.from('acc_pflink').select('*');
  const { data: acmac1 } = await s.from('acmac1').select('*');
  const { data: trans1 } = await s.from('trans1').select('*');
  const { data: transc1 } = await s.from('transc1').select('*');
  const { data: vouchers1 } = await s.from('vouchers1').select('*');
  
  // mock logic.ts state
  const state: any = {
    portfolios, accPflink, acmac1, trans1: trans1 || [], transC1: transc1 || [], vouchers1: vouchers1 || [], vouchersC1: []
  };

  const accountId = "62";
  const endDate = "2026-03-31";
  
  const groups = state.acmac1.filter((a: any) => a.is_group && a.acid == accountId).map((a: any) => ({
    id: String(a.id), name: a.name, parent: a.parent_id ? String(a.parent_id) : undefined, special_type_id: a.special_type_id
  }));
  
  const ledgers = state.acmac1.filter((a: any) => !a.is_group && a.acid == accountId).map((a: any) => ({
    id: String(a.id), name: a.name, groupId: String(a.parent_id)
  }));
  
  const entries = [...state.transC1, ...state.trans1].map((e: any) => ({
    ledgerId: String(e.maid), debit: Number(e.dramt) || 0, credit: Number(e.cramt) || 0,
    accountId: e.acid ? String(e.acid) : undefined, date: e.dt, voucherId: String(e.vid)
  }));
  
  const voucherMap: any = {};
  state.vouchers1.forEach((v: any) => voucherMap[v.vid] = { date: v.dt, accountId: String(v.acid) });
  
  let incomeLedgerBal = 0;
  
  const groupMap: any = {};
  groups.forEach((g: any) => groupMap[g.id] = { ...g, children: [], ledgers: [], balance: 0 });
  
  ledgers.forEach((l: any) => {
    let debit = 0, credit = 0;
    entries.forEach((e: any) => {
      if (e.ledgerId === l.id) {
        const v = voucherMap[e.voucherId]
        const entryDate = e.date || v?.date
        const entryAcid = e.accountId || v?.accountId
        
        if (entryDate && entryDate <= endDate) {
          if (entryAcid === accountId) {
            debit += e.debit; credit += e.credit;
          }
        }
      }
    });
    
    // Income type is credit - debit
    const bal = credit - debit;
    if (l.id === "145") {
      incomeLedgerBal = bal;
      console.log(`Brokerage Income calculated bal: ${bal}`);
    }
    
    if (groupMap[l.groupId]) {
      groupMap[l.groupId].ledgers.push({ ...l, balance: bal });
    }
  });
  
  const tree: any[] = [];
  Object.values(groupMap).forEach((g: any) => {
    if (g.parent && groupMap[g.parent]) groupMap[g.parent].children.push(g);
    else tree.push(g);
  });
  
  const calcGroupBalance = (group: any): number => {
    let bal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0)
    group.children.forEach((child: any) => { bal += calcGroupBalance(child) })
    group.balance = bal
    return bal
  }
  tree.forEach(g => calcGroupBalance(g));
  
  const pnl = tree.find(g => g.name === 'Profit & Loss');
  console.log('Profit & Loss final balance:', pnl?.balance);
  
  // traverse P&L to see if Brokerage Income is there
  console.log('P&L children:', pnl?.children.map((c: any) => ({ name: c.name, balance: c.balance })));
}
run();

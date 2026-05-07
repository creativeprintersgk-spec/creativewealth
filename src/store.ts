import { dbPromise, saveToDB, getAllFromDB } from './db';
import { defaultGroups } from './logic_defaults'; // I'll move defaults to a separate file to keep logic.ts clean

// State Cache
let cache = {
  groups: [] as any[],
  ledgers: [] as any[],
  vouchers: [] as any[],
  entries: [] as any[],
  initialized: false
};

const DEFAULT_LEDGERS = [
  { id: "Bank", name: "Bank", groupId: "bank", openingBalance: 0, openingType: "DR", currentBalance: 0, currentType: "DR" },
  { id: "Cash", name: "Cash", groupId: "cash", openingBalance: 0, openingType: "DR", currentBalance: 0, currentType: "DR" },
  { id: "Sales", name: "Sales", groupId: "income", openingBalance: 0, openingType: "CR", currentBalance: 0, currentType: "CR" },
  { id: "Office Expense", name: "Office Expense", groupId: "expenses", openingBalance: 0, openingType: "DR", currentBalance: 0, currentType: "DR" },
];

export async function initDatabase() {
  if (cache.initialized) return;

  const groups = await getAllFromDB('groups');
  const ledgers = await getAllFromDB('ledgers');
  const vouchers = await getAllFromDB('vouchers');
  const entries = await getAllFromDB('entries');

  cache.groups = groups.length > 0 ? groups : defaultGroups;
  cache.ledgers = ledgers.length > 0 ? ledgers : DEFAULT_LEDGERS;
  cache.vouchers = vouchers;
  cache.entries = entries;
  
  // Initial Save if empty
  if (groups.length === 0) {
    for (const g of defaultGroups) await saveToDB('groups', g);
  }
  if (ledgers.length === 0) {
    for (const l of DEFAULT_LEDGERS) await saveToDB('ledgers', l);
  }

  cache.initialized = true;
  console.log("Database Initialized:", cache);
}

// Synchronous Getters (using cache)
export function getGroups() { return cache.groups; }
export function getLedgers() { return cache.ledgers; }
export function getVouchers() { return cache.vouchers; }
export function getEntries() { return cache.entries; }

// Asynchronous Mutators
export async function saveLedger(ledger: any) {
  const idx = cache.ledgers.findIndex(l => l.id === ledger.id);
  if (idx >= 0) cache.ledgers[idx] = ledger;
  else cache.ledgers.push(ledger);
  await saveToDB('ledgers', ledger);
}

export async function saveVoucher(voucher: any, entries: any[]) {
  // Update Cache
  cache.vouchers = cache.vouchers.filter(v => v.id !== voucher.id);
  cache.vouchers.push(voucher);
  
  cache.entries = cache.entries.filter(e => e.voucherId !== voucher.id);
  cache.entries.push(...entries);

  // Update DB
  await saveToDB('vouchers', voucher);
  for (const e of entries) await saveToDB('entries', e);
}

export async function deleteVoucher(id: string) {
  cache.vouchers = cache.vouchers.filter(v => v.id !== id);
  cache.entries = cache.entries.filter(e => e.voucherId !== id);
  
  const db = await dbPromise;
  await db.delete('vouchers', id);
  // Entries don't have a simple key, but we'll handle it
  const allE = await db.getAll('entries');
  for (const e of allE) {
    if (e.voucherId === id) await db.delete('entries', e.id);
  }
}

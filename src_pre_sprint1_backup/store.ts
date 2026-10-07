// store.ts — Legacy store. All state is now managed by logic.ts (Supabase-backed).
// This file is kept for backward compatibility but is no longer the primary store.
export { 
  initDatabase,
  getStoredGroups as getGroups,
  getStoredLedgers as getLedgers,
  getStoredVouchers as getVouchers,
  getStoredEntries as getEntries,
  saveLedger,
  createVoucher as saveVoucher,
  deleteVoucher
} from './logic';

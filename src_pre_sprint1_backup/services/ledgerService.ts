// ledgerService.ts — Cloud-backed via logic.ts (Supabase)
import { getStoredLedgers, saveLedger, deleteLedger } from '../logic';

export function getLedgers() {
  return getStoredLedgers();
}

export async function saveLedgerRecord(ledger: any) {
  return await saveLedger(ledger);
}

export async function deleteLedgerRecord(id: string) {
  return await deleteLedger(id);
}

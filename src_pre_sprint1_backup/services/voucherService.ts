// voucherService.ts — Cloud-backed via logic.ts (Supabase)
import { getStoredVouchers, getStoredEntries, createVoucher, updateVoucher, deleteVoucher } from '../logic';

export function getVouchers() {
  return getStoredVouchers();
}

export function getEntries() {
  return getStoredEntries();
}

export async function saveVoucher(voucher: any) {
  return await createVoucher(voucher);
}

export async function updateVoucherRecord(voucher: any) {
  return await updateVoucher(voucher);
}

export async function deleteVoucherRecord(id: string) {
  return await deleteVoucher(id);
}

export async function deleteEntriesByVoucher(_voucherId: string) {
  // Entries are deleted automatically when the voucher is deleted via deleteVoucher
}

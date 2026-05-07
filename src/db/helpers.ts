import { 
  getStoredGroups, 
  getStoredLedgers, 
  getStoredVouchers, 
  getStoredEntries,
  saveLedger,
  deleteLedger,
  updateVoucher,
  deleteVoucher
} from "../logic"

export async function getAll(store: string) {
  if (store === "groups") return getStoredGroups()
  if (store === "ledgers") return getStoredLedgers()
  if (store === "vouchers") return getStoredVouchers()
  if (store === "entries") return getStoredEntries()
  return []
}

export async function save(store: string, item: any) {
  if (store === "ledgers") return await saveLedger(item)
  if (store === "vouchers") return await updateVoucher(item)
  // For entries, usually they are saved as part of a voucher in logic.ts
  return null
}

export async function remove(store: string, id: string) {
  if (store === "ledgers") return await deleteLedger(id)
  if (store === "vouchers") return await deleteVoucher(id)
}

export async function clearStore(store: string) {
  console.warn("clearStore not implemented for persistent DB")
}

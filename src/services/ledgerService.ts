import { getAll, save, remove } from "../db/helpers"

export async function getLedgers() {
  return await getAll("ledgers")
}

export async function saveLedger(ledger: any) {
  return await save("ledgers", ledger)
}

export async function deleteLedger(id: string) {
  return await remove("ledgers", id)
}

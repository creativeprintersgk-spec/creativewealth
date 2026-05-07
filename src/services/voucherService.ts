import { getAll, save, remove } from "../db/helpers"
import { dbPromise } from "../db/database"

export async function getVouchers() {
  return await getAll("vouchers")
}

export async function saveVoucher(voucher: any) {
  const db = await dbPromise;
  console.log("➡️ Saving voucher:", voucher);

  const tx = db.transaction("vouchers", "readwrite");
  const store = tx.objectStore("vouchers");
  await store.put(voucher);
  await tx.done;

  console.log("✅ Voucher saved");

  const all = await db.getAll("vouchers");
  console.log("📦 DB now has:", all.length);
}

export async function deleteVoucher(id: string) {
  const db = await dbPromise;
  await db.delete("vouchers", id);
}

export async function getEntries() {
  return await getAll("entries")
}

export async function saveEntry(entry: any) {
  return await save("entries", entry)
}

export async function deleteEntriesByVoucher(voucherId: string) {
  const entries = await getEntries();
  for (const e of entries) {
    if (e.voucherId === voucherId) {
      await remove("entries", e.id);
    }
  }
}

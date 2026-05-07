import { openDB } from "idb"

export const dbPromise = openDB("mprofit-clone-db", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("ledgers")) {
      db.createObjectStore("ledgers", { keyPath: "id" })
    }
    if (!db.objectStoreNames.contains("vouchers")) {
      db.createObjectStore("vouchers", { keyPath: "id" })
    }
    if (!db.objectStoreNames.contains("entries")) {
      db.createObjectStore("entries", { keyPath: "id" })
    }
    if (!db.objectStoreNames.contains("groups")) {
      db.createObjectStore("groups", { keyPath: "id" })
    }
  },
})

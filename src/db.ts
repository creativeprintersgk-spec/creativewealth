import { openDB } from 'idb';

export const dbPromise = openDB('wealthcore-db', 3, {
  upgrade(db: any) {
    if (!db.objectStoreNames.contains('ledgers')) db.createObjectStore('ledgers', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('vouchers')) db.createObjectStore('vouchers', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('entries')) {
      const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
      entryStore.createIndex('by-voucher', 'voucherId');
      entryStore.createIndex('by-ledger', 'ledgerId');
    }
    if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
  },
});

export async function saveToDB(store: 'ledgers' | 'vouchers' | 'entries' | 'groups', data: any) {
  const db = await dbPromise;
  await db.put(store, data);
}

export async function getAllFromDB(store: 'ledgers' | 'vouchers' | 'entries' | 'groups') {
  const db = await dbPromise;
  return db.getAll(store);
}

export async function clearStore(store: 'ledgers' | 'vouchers' | 'entries' | 'groups') {
  const db = await dbPromise;
  await db.clear(store);
}

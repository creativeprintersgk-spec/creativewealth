import { openDB } from 'idb';

export const dbPromise = openDB('wealthcore-db', 3, {
  upgrade(db: any) {
    console.log("Upgrading database to version 3...");
    if (!db.objectStoreNames.contains('ledgers')) {
      db.createObjectStore('ledgers', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('vouchers')) {
      db.createObjectStore('vouchers', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('entries')) {
      const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
      entryStore.createIndex('by-voucher', 'voucherId');
      entryStore.createIndex('by-ledger', 'ledgerId');
    }
    if (!db.objectStoreNames.contains('groups')) {
      db.createObjectStore('groups', { keyPath: 'id' });
    }
  },
  blocked() {
    console.warn("IndexedDB open blocked! Please close other tabs.");
    alert("Database upgrade blocked by another tab. Please close other WealthCore tabs and refresh.");
  },
  blocking() {
    console.warn("IndexedDB blocking an upgrade elsewhere. Closing...");
  },
});


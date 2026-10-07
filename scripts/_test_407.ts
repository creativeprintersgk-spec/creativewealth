import { forceRefreshDatabase, getStoredEntries, getStoredVouchers } from '../src/logic';

forceRefreshDatabase();
getStoredVouchers();
const allEntries = getStoredEntries();
const entries407 = allEntries.filter(e => e.ledgerId == '407');
console.log("Total entries for 407:", entries407.length);

const entries407_36 = entries407.filter(e => e.accountId == '36');
console.log("Entries for 407 and acid 36:", entries407_36.length);

import { forceRefreshDatabase, getLedgerWithBalance } from '../src/logic';

forceRefreshDatabase();
const lid = "407";
const acid = "29"; // Unnati
const result = getLedgerWithBalance(lid, "2026-04-01", "2027-03-31", acid);
console.log("Opening Balance:", result.openingBalance);
console.log("Closing Balance:", result.closingBalance);
console.log("Tx count:", result.transactions.length);

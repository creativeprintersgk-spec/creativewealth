const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync("backups/latest_snapshot/manifest.json", "utf8"));
console.log("Manifest:", manifest);

// Check sample of transc1 in snapshot vs Trans1 in SQLite
const snapC1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/transc1.json", "utf8"));
console.log("Snapshot transc1 count:", snapC1.length);
console.log("Snapshot transc1 sample 3 rows:", snapC1.slice(0, 3));

const snapV1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/vouchersc1.json", "utf8"));
console.log("Snapshot vouchersc1 count:", snapV1.length);
console.log("Snapshot vouchersc1 sample 3 rows:", snapV1.slice(0, 3));

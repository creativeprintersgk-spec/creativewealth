const fs = require("fs");
const snapAcmac1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/acmac1.json", "utf8"));
console.log("Total rows in snapshot acmac1:", snapAcmac1.length);
const dh = snapAcmac1.filter(a => a.name && a.name.includes("Dharampur"));
console.log("Dharampur in snapshot acmac1:", dh);
const jew = snapAcmac1.filter(a => a.name && a.name.includes("Jewellery"));
console.log("Jewellery in snapshot acmac1:", jew);

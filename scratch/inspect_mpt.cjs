const fs = require('fs');
const buffer = fs.readFileSync('C:\\Users\\Admin\\Desktop\\MasterDb\\Templates\\Zerodha_Sec_Daily_Email_CN_PDF_v8.mpt');
console.log(buffer.slice(0, 32).toString('hex'));
console.log(buffer.slice(0, 32).toString('ascii'));

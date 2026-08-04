const fs = require('fs');
const pdfParse = require('pdf-parse');

const buffer = fs.readFileSync('C:\\\\Users\\\\Admin\\\\Desktop\\\\contract notes\\\\COMM_CONTRACT_20251230_MA2690_6767911.pdf');

pdfParse(buffer, { password: 'AAIPS3625H' }).then(data => {
  console.log(data.text);
}).catch(err => {
  console.error("Error parsing PDF:", err);
});

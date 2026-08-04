const fs = require('fs');
const text = fs.readFileSync('scratch/extracted_cn_text.txt', 'utf8');

const summaryRegex = /(INE[A-Z0-9]{9})\s+([A-Z0-9\-\s&]+?)\s+(\d+)\s+([\d\.]+)\s+[\d\.]+\s+[\d\.]+\s+([\d\.]+)\s+(\d+)\s+([\d\.]+)\s+[\d\.]+\s+[\d\.]+\s+([\d\.]+)/g;

let match;
let count = 0;
while ((match = summaryRegex.exec(text)) !== null) {
  count++;
  console.log("Matched!");
  console.log("ISIN:", match[1]);
  console.log("Name:", match[2]);
  console.log("BuyQty:", match[3], "BuyWAP:", match[4], "BuyVal:", match[5]);
  console.log("SellQty:", match[6], "SellWAP:", match[7], "SellVal:", match[8]);
}
console.log("Total matches:", count);

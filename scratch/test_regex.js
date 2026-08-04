const text = "INE733E01010 NTPC 35 402.1500 0.0000 402.1500 14075.25 0 0.0000 0.0000 0.0000 0.00 35 −14075.25";

const summaryRegex = /(INE[A-Z0-9]{9})\s+([A-Z0-9\-\s&]+?)\s+(\d+)\s+([\d\.]+)\s+[\d\.]+\s+[\d\.]+\s+([\d\.]+)\s+(\d+)\s+([\d\.]+)\s+[\d\.]+\s+[\d\.]+\s+([\d\.]+)/g;

let match;
while ((match = summaryRegex.exec(text)) !== null) {
  console.log("Matched!");
  console.log("ISIN:", match[1]);
  console.log("Name:", match[2]);
  console.log("BuyQty:", match[3], "BuyWAP:", match[4], "BuyVal:", match[5]);
  console.log("SellQty:", match[6], "SellWAP:", match[7], "SellVal:", match[8]);
}

import { getBalanceSheet } from '../src/services/balanceSheet';
import { initDatabase } from '../src/logic';

function printGroupRecursive(group: any, level = 0) {
  const indent = '  '.repeat(level);
  if (Math.abs(group.balance) < 0.01) return;
  console.log(`${indent}Group: ${group.name} (id=${group.id}, parent=${group.parent}) = ₹${group.balance.toFixed(2)}`);
  
  group.ledgers.forEach((l: any) => {
    console.log(`${indent}  - Ledger: ${l.name} (id=${l.id}) = ₹${l.balance.toFixed(2)} (type=${l.groupType})`);
  });

  group.children.forEach((child: any) => {
    printGroupRecursive(child, level + 1);
  });
}

async function main() {
  console.log("Initializing database...");
  await initDatabase();

  const acid = '29'; // Unnati Shah
  const endDate = '2026-03-31';

  console.log(`\nCalculating Balance Sheet for Unnati Shah (acid = ${acid}) as of ${endDate}...`);
  const bs = await getBalanceSheet('2025-04-01', endDate, acid);

  console.log(`\n--- RESULTS ---`);
  console.log(`Total Assets:      ₹${bs.totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ₹${bs.totalLiabilities.toFixed(2)}`);
  console.log(`Difference:        ₹${(bs.totalAssets - bs.totalLiabilities).toFixed(2)}`);

  console.log(`\n--- RECURSIVE ASSETS BREAKDOWN ---`);
  bs.assets.forEach((g: any) => {
    printGroupRecursive(g, 0);
  });

  console.log(`\n--- RECURSIVE LIABILITIES BREAKDOWN ---`);
  bs.liabilities.forEach((g: any) => {
    printGroupRecursive(g, 0);
  });
}

main().catch(console.error);

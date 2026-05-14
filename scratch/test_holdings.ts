import { getHoldings, initDatabase } from '../src/logic';

async function test() {
  await initDatabase();
  // Family PRAMESH SHAH -> account 8fsdnspd2 -> portfolios 0wpdrjsvq, 8hgulm5ay, z7hv9y8lm
  const holdings = getHoldings(['0wpdrjsvq', '8hgulm5ay', 'z7hv9y8lm', '79dvmya60']);
  console.log("Holdings length:", holdings.length);
  if (holdings.length > 0) {
    console.log("Sample holding:", holdings[0]);
  }
}

test();

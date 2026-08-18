import 'dotenv/config';
import { initDatabase, state } from '../src/logic.ts';

async function inspectHdfcLots() {
  await initDatabase();

  const hdfcTx = state.bs1.filter((t: any) => [100128, 502404].includes(Number(t.amid)) && [1, 31, 36].includes(Number(t.pfid)))
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

  console.log('=== HDFC BANK TRANSACTIONS IN BS1 ===');
  hdfcTx.forEach((t: any) => {
    console.log(`TRID ${t.trid} | PFID ${t.pfid} | Type: ${t.trty} (${t.trstr}) | Date: ${t.dt} | Qty: ${t.qn} | Price: ${t.purpr} | Amt: ${t.amt}`);
  });
}

inspectHdfcLots().catch(console.error);

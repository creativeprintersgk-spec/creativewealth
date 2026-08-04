import { initDatabase, getStoredLedgers } from '../src/logic.ts';

async function run() {
  await initDatabase();

  const ledgers = getStoredLedgers('30');
  const kotak = ledgers.find(l => l.name.toLowerCase().includes('kotak'));
  console.log('Kotak Ledger in logic:', kotak);

  // Let's find the raw record in state.acmac1
  const rawKotak = (global as any).state?.acmac1?.find((a: any) => a.id === 48 && a.acid === 30) 
                || (global as any).acmac1?.find((a: any) => a.id === 48 && a.acid === 30)
                || null;
  
  // Wait, let's just inspect the logic's internal state directly
  // We can import 'state' if it was exported, or we can look up in Supabase
  console.log('Raw Kotak from state:', rawKotak);
}

run().catch(console.error);

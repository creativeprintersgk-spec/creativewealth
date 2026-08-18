import { initDatabase, state } from '../src/logic.ts';

async function inspect() {
  await initDatabase();
  const am466 = state.acmac1.find((a: any) => Number(a.exint1 || a.amid || a.id) === 466);
  console.log('acmac1 for 466 (Gold):', am466);
  const sum466 = state.sumTable.filter((s: any) => Number(s.amid) === 466);
  console.log('sum_table for 466:', sum466);

  const am753 = state.acmac1.find((a: any) => Number(a.exint1 || a.amid || a.id) === 753);
  console.log('acmac1 for 753 (Gold R):', am753);
  const sum753 = state.sumTable.filter((s: any) => Number(s.amid) === 753);
  console.log('sum_table for 753:', sum753);

  const am752 = state.acmac1.find((a: any) => Number(a.exint1 || a.amid || a.id) === 752);
  console.log('acmac1 for 752 (Silver):', am752);
  const sum752 = state.sumTable.filter((s: any) => Number(s.amid) === 752);
  console.log('sum_table for 752:', sum752);
}

inspect().catch(console.error);

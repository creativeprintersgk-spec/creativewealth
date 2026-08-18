import { initDatabase, state } from '../src/logic.ts';

async function checkAssetMaster() {
  await initDatabase();
  console.log('assetMaster count:', state.assetMaster.length);
  const sample = state.assetMaster.slice(0, 5);
  console.log('Sample assetMaster:', sample);

  // Check the 20 ISINs from the contract note
  const isins = [
    "INE404A01024", "INE463V01026", "INE406A01037", "INE084A01016", "INE257A01026",
    "INE029A01011", "INE476A01022", "INE522F01014", "INE481Y01014", "INE548A01028",
    "INE094A01015", "INE121J01017", "INE242A01010", "INE0FS801015", "INE470Y01017",
    "INE0NDH25011", "INE213A01029", "INE020B01018", "INE777K01022", "INE075A01022"
  ];

  console.log('\nChecking ISIN matches in state.assetMaster:');
  for (const isin of isins) {
    const m = state.assetMaster.find((a: any) => a.isin === isin || (a.s && a.s === isin));
    console.log(`ISIN ${isin}: ${m ? `Found amid=${m.amid || m.id}, name="${m.name || m.n}", asset_type=${m.asset_type || m.atyid}` : 'NOT FOUND'}`);
  }
}

checkAssetMaster().catch(console.error);

import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

function parseCSV(fileName) {
  return new Promise((resolve) => {
    const rows = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

async function run() {
  console.log('--- Checking Portfolios.csv ---');
  const portfolios = await parseCSV('Portfolios.csv');
  console.log('Total portfolios:', portfolios.length);
  const saahilPort = portfolios.find(p => p.ID === '1');
  console.log('Portfolio 1:', saahilPort);

  console.log('\n--- Checking SumTable.csv for 104519 ---');
  const sumRows = await parseCSV('SumTable.csv');
  const ntpcSum = sumRows.filter(r => r.AMID === '104519');
  console.log('NTPC SumTable rows:', ntpcSum);

  console.log('\n--- Checking BS1.csv for 104519 ---');
  const bsRows = await parseCSV('BS1.csv');
  const ntpcBs = bsRows.filter(r => r.AMID === '104519');
  console.log('NTPC BS1 rows count:', ntpcBs.length);
  ntpcBs.forEach(r => {
    console.log(`BS1 Row: trid=${r.TRID}, pfid=${r.PFID}, qn=${r.QN}, purpr=${r.PURPR}, amt=${r.AMT}, dt=${r.DT}, trstr=${r.TRSTR}`);
  });

  console.log('\n--- Checking Trans1.csv for 104519 or 503134 ---');
  const trans = await parseCSV('Trans1.csv');
  const ntpcTrans = trans.filter(r => r.MAID === '104519' || r.MAID === '503134');
  console.log('NTPC Trans1 rows count:', ntpcTrans.length);
  ntpcTrans.forEach(r => {
    console.log(`Trans1 Row: transid=${r.TRANSID}, vid=${r.VID}, maid=${r.MAID}, dr=${r.DRAMT}, cr=${r.CRAMT}`);
  });

  console.log('\n--- Checking TransC1.csv for 104519 or 503134 ---');
  const transc = await parseCSV('TransC1.csv');
  const ntpcTransc = transc.filter(r => r.MAID === '104519' || r.MAID === '503134');
  console.log('NTPC TransC1 rows count:', ntpcTransc.length);
  ntpcTransc.forEach(r => {
    console.log(`TransC1 Row: transid=${r.TRANSID}, vid=${r.VID}, maid=${r.MAID}, dr=${r.DRAMT}, cr=${r.CRAMT}`);
  });
}

run().catch(console.error);

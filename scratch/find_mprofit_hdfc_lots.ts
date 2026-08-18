import fs from 'fs';
import path from 'path';

function findHdfcInMprofit() {
  const file = path.resolve(process.cwd(), 'scratch/mprofit_csv/BS1.csv');
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const hdfcLines = lines.filter(l => l.includes('HDFC') || l.includes('100128'));
    console.log('=== HDFC LINES IN MPROFIT BS1.CSV ===');
    hdfcLines.forEach(l => console.log(l));
  } else {
    console.log('BS1.csv not found');
  }
}

findHdfcInMprofit();

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { initDatabase, getGroupType } from '../src/logic';

async function run() {
  await initDatabase();
  console.log('Database initialized');
  console.log('Type of group 90:', getGroupType('90'));
  
  // also let's manually trace
  const state = require('../src/logic').state;
  let currentId: string | undefined = '90';
  let iters = 0;
  console.log('Trace:');
  while (currentId && iters < 20) {
    console.log(' -> currentId:', currentId);
    if (currentId === '1' || currentId === '2' || currentId === '3' || currentId === '4') {
      break;
    }
    const g = state.acmac1.find((a: any) => String(a.id) === currentId && a.is_group);
    currentId = g ? String(g.parent_id) : undefined;
    iters++;
  }
}
run();

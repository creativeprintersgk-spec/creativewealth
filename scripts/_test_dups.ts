import { forceRefreshDatabase } from '../src/logic';
import fs from 'fs';

const state = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
const a = state.filter((x: any) => x.name === 'Interest On Saving Account');
console.log(a.map((x: any) => `acid:${x.acid} DB:${x.db_bal} CR:${x.cr_bal}`));

const b = state.filter((x: any) => x.name === 'Other Income');
console.log("Other Income:");
console.log(b.map((x: any) => `acid:${x.acid} DB:${x.db_bal} CR:${x.cr_bal}`));

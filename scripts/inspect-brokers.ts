import { readFileSync } from 'fs';
import path from 'path';

const snapshotDir = path.resolve('c:/Users/Admin/Desktop/wealthcore-clean/backups/latest_snapshot');
function loadJson(name: string) { return JSON.parse(readFileSync(path.join(snapshotDir, `${name}.json`), 'utf-8')); }

const vouchersc1 = loadJson('vouchersc1');
const transc1 = loadJson('transc1');
const scnote1 = loadJson('scnote1');
const acmac1 = loadJson('acmac1');

// Look for contract notes around 2013-05-23
console.log('Contract notes around 2013-05-23:');
const sc2013 = scnote1.filter((s: any) => (s.dt || '').startsWith('2013-05'));
console.log('scnote1 count:', sc2013.length);

// Look for other vouchers of type 15 around 2013-05
const v2013 = vouchersc1.filter((v: any) => (v.dt || '').startsWith('2013-05'));
console.log('vouchers around May 2013:', v2013);

// Brokers for acid 29 in acmac1
const brokers = acmac1.filter((a: any) => a.acid === 29 && (a.parent_id === 75 || a.name.toLowerCase().includes('broker') || a.name.toLowerCase().includes('security') || a.name.toLowerCase().includes('global') || a.name.toLowerCase().includes('motilal') || a.name.toLowerCase().includes('kotak') || a.name.toLowerCase().includes('hdfc')));
console.log('Brokers for acid 29:', brokers.map((b: any) => ({ id: b.id, name: b.name, parent_id: b.parent_id })));

import fs from 'fs';

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
console.log('Total ledgers in db.json:', db.ledgers?.length);
console.log('Total entries in db.json:', db.entries?.length);

const incomeGroup = db.groups?.find((g: any) => g.name === 'Income');
console.log('Income group in db.json:', incomeGroup);

const rrBroker = db.ledgers?.find((l: any) => l.name === 'RR Broker');
console.log('RR Broker in db.json:', rrBroker);

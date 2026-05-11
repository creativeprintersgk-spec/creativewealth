import { getStoredLedgers, getStoredGroups } from './src/logic';

const ledgers = getStoredLedgers();
const groups = getStoredGroups();

console.log("LEDGERS:", ledgers.map(l => ({ id: l.id, name: l.name, group: l.groupId })));
console.log("GROUPS:", groups.map(g => ({ id: g.id, name: g.name })));

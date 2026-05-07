export function calculateGroupTotalCore(
  groupId: string,
  allGroups: any[],
  allLedgers: any[],
  allEntries: any[]
): number {
  const group = allGroups.find(g => g.id === groupId);
  if (!group) return 0;

  let total = 0;
  const ledgersInGroup = allLedgers.filter(l => l.groupId === groupId);
  
  ledgersInGroup.forEach(l => {
    let bal = l.openingType === 'DR' ? l.openingBalance : -l.openingBalance;
    allEntries.filter(e => e.ledgerId === l.id).forEach(e => {
      bal += e.debit;
      bal -= e.credit;
    });
    total += bal;
  });

  const childGroups = allGroups.filter(g => g.parent === groupId);
  childGroups.forEach(cg => {
    total += calculateGroupTotalCore(cg.id, allGroups, allLedgers, allEntries);
  });

  return total;
}

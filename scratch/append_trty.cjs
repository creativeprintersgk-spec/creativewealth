export function getTransactionType(voucherId: string | number | null | undefined): { type: string, isDividend: boolean, corpActionType: string | null } {
  if (!voucherId) return { type: '', isDividend: false, corpActionType: null };
  const vid = Number(voucherId);
  const bsEntry = state.bs1.find((b: any) => b.acvch === vid);
  if (!bsEntry) return { type: '', isDividend: false, corpActionType: null };
  
  const trty = bsEntry.trty;
  const isDiv = trty === 62 || trty === 60;
  const isCA = [25, 30, 35, 40, 45, 46].includes(trty);
  
  const TRTY_LABEL: Record<number, string> = {
    19: 'Buy', 20: 'Buy', 12: 'Buy',
    25: 'Bonus', 30: 'Split', 35: 'Merger', 40: 'Demerger',
    45: 'Switch In', 46: 'Switch Out', 47: 'SIP',
    50: 'Sell', 51: 'Sell', 52: 'Sell', 99: 'Sell',
    60: 'Dividend', 62: 'Dividend', 70: 'Interest', 80: 'Maturity',
  };
  
  const typeLabel = TRTY_LABEL[trty] || bsEntry.trstr || 'Buy';
  
  let corpActionType = null;
  if (isCA) {
    if (trty === 25) corpActionType = 'bonus';
    else if (trty === 30) corpActionType = 'split';
    else if (trty === 45) corpActionType = 'merger';
    else if (trty === 40 || trty === 46) corpActionType = 'demerger';
  }

  return { type: typeLabel, isDividend: isDiv, corpActionType };
}

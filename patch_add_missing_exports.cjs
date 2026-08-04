/**
 * Add all missing exports to logic.ts:
 * 1. export const state
 * 2. export async function createVouchersBulk
 * 3. export function getTransactionType
 * 4. export async function getTransactionAssetDetails
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/logic.ts');
let content = fs.readFileSync(filePath, 'utf8');

// ── 1. Export state ──────────────────────────────────────────────────────────
// Find "const state = {" and make it "export const state = {"
if (content.includes('\nexport const state ')) {
  console.log('ℹ️  state already exported');
} else if (content.includes('\nconst state = ')) {
  content = content.replace('\nconst state = ', '\nexport const state = ');
  console.log('✅ Exported state');
} else if (content.includes('\nconst state={') || content.includes('\nconst state =')) {
  content = content.replace(/\nconst state\s*=/, '\nexport const state =');
  console.log('✅ Exported state (variant)');
} else {
  console.error('❌ Could not find const state declaration');
}

// ── 2. Add createVouchersBulk, getTransactionType, getTransactionAssetDetails ──
// Append before the last line of the file

const newFunctions = `

// ── BULK VOUCHER CREATION ────────────────────────────────────────────────────
/**
 * Create multiple vouchers in sequence (used by MF CAS import).
 * Each item in the array follows the same shape as createVoucher's data param.
 */
export async function createVouchersBulk(dataList: any[]): Promise<void> {
  for (const data of dataList) {
    await createVoucher(data);
  }
}

// ── TRANSACTION TYPE HELPERS ─────────────────────────────────────────────────
const TRTY_LABEL: Record<number, string> = {
  19: 'Purchase', 20: 'Purchase (Rights)', 12: 'Purchase (IPO)',
  25: 'Bonus', 30: 'Split', 35: 'Merger', 40: 'Demerger',
  45: 'Switch In', 46: 'Switch Out', 47: 'SIP',
  50: 'Sale', 51: 'Sale (Rights)', 52: 'Redemption',
  60: 'Dividend', 70: 'Interest', 80: 'Maturity',
};

/**
 * Returns a human-readable transaction type label for a given voucher ID.
 * Looks up the voucher in vouchersc1/vouchers1 and returns its vtyp label.
 */
export function getTransactionType(voucherId: string | number | null | undefined): string {
  if (!voucherId) return '';
  const vid = Number(voucherId);
  const vtypMap: Record<number, string> = {
    2: 'Payment', 4: 'Receipt', 5: 'Journal', 14: 'Purchase', 15: 'Sale'
  };
  const vch = (state as any).vouchersC1?.find((v: any) => Number(v.vid) === vid)
    || (state as any).vouchers1?.find((v: any) => Number(v.vid) === vid);
  if (!vch) return '';
  // Try to get more specific type from bs1
  const bsRow = (state as any).bs1?.find((b: any) => Number(b.vid) === vid);
  if (bsRow && TRTY_LABEL[bsRow.trty]) return TRTY_LABEL[bsRow.trty];
  return vtypMap[vch.vtyp] || 'Journal';
}

/**
 * Returns asset details (name, type, quantity, amount) for a given voucher ID.
 * Used in PMSWorkspace to show details of a selected transaction.
 */
export async function getTransactionAssetDetails(voucherId: string | number | null | undefined): Promise<{
  assetName: string;
  assetType: string;
  quantity: number;
  amount: number;
  date: string;
} | null> {
  if (!voucherId) return null;
  const vid = Number(voucherId);

  // Look up in bs1 for portfolio transactions
  const bsRow = (state as any).bs1?.find((b: any) => Number(b.vid) === vid);
  if (bsRow) {
    const amid = bsRow.amid;
    const samRow = (state as any).sam?.find((s: any) => Number(s.amid) === Number(amid));
    return {
      assetName: samRow?.anm || samRow?.name || \`Asset \${amid}\`,
      assetType: bsRow.atyid === 1 ? 'Equity' : bsRow.atyid === 2 ? 'Mutual Fund' : 'Other',
      quantity: Number(bsRow.qn) || 0,
      amount: Number(bsRow.amt) || 0,
      date: bsRow.dt || '',
    };
  }

  // Fallback: try voucher narration
  const vch = (state as any).vouchersC1?.find((v: any) => Number(v.vid) === vid)
    || (state as any).vouchers1?.find((v: any) => Number(v.vid) === vid);
  if (vch) {
    return {
      assetName: vch.narr || 'Unknown',
      assetType: 'Unknown',
      quantity: 0,
      amount: 0,
      date: vch.dt || '',
    };
  }
  return null;
}
`;

// Append to end of file
content = content.trimEnd() + '\n' + newFunctions;
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Added createVouchersBulk, getTransactionType, getTransactionAssetDetails');

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('\n── Verification ──');
console.log('state exported:', verify.includes('export const state'));
console.log('createVouchersBulk:', verify.includes('export async function createVouchersBulk'));
console.log('getTransactionType:', verify.includes('export function getTransactionType'));
console.log('getTransactionAssetDetails:', verify.includes('export async function getTransactionAssetDetails'));

import type { VoucherType } from "./voucherValidation";

export function getNextVoucherNo(
  type: VoucherType, 
  fy: string, 
  existingVouchers: { id: string; type: string; fy?: string; date: string }[]
): string {
  const prefix = {
    receipt: 'RCPT',
    payment: 'PAY',
    journal: 'JRN',
    contra: 'CON'
  }[type] || 'VCH';

  const vouchersInFY = existingVouchers.filter(v => {
    // If the voucher already has an FY field, use it; otherwise calculate from date
    const vFY = v.fy || (() => {
      const d = new Date(v.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    })();
    return v.type === type && vFY === fy;
  });

  const nextNum = vouchersInFY.length + 1;
  return `${prefix}-${nextNum.toString().padStart(4, '0')}`;
}

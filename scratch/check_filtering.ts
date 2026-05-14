
import { getStoredVouchers } from '../src/logic';

async function test() {
  const vouchers = getStoredVouchers();
  console.log('Total Vouchers:', vouchers.length);
  if (vouchers.length > 0) {
    console.log('Sample Voucher Date:', vouchers[0].date);
    console.log('Type of date:', typeof vouchers[0].date);
  }

  const endDate = '2024-03-31';
  const filtered = vouchers.filter(v => v.date <= endDate);
  console.log(`Vouchers on or before ${endDate}: ${filtered.length}`);
  
  const nextYearEnd = '2025-03-31';
  const filteredNext = vouchers.filter(v => v.date <= nextYearEnd);
  console.log(`Vouchers on or before ${nextYearEnd}: ${filteredNext.length}`);
}

test();

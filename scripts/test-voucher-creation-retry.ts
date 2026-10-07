// Standalone verification of createVoucher's retry-on-conflict fixes
// (vid, transid, and trid allocation) -- the confirmed root cause of a real
// incident where portfolio 1's opening-balance voucher succeeded, then every
// subsequent portfolio in the same import run got NOTHING, because an
// uncaught transc1 insert error silently aborted the entire remaining loop.
//
// Run with: VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx tsx scripts/test-voucher-creation-retry.ts

import { state, createVoucher } from '../src/logic.ts';
import { supabase } from '../src/supabase.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

// Seed a dense, low id range for both vouchersc1 and transc1, mirroring the
// real database's near-zero headroom.
state.vouchersC1 = [];
state.trans1 = [];
state.transC1 = [];
state.bs1 = [];
for (let i = 1; i <= 500; i++) {
  state.vouchersC1.push({ vid: i, acid: 29, dt: '2020-01-01', narr: 'x', vtyp: 5 });
  state.transC1.push({ transid: i, vid: i, acid: 29, maid: 1, dramt: 0, cramt: 0, dt: '2020-01-01' });
}

console.log('--- Test 1: vid collision is retried, not thrown ---');
let vidInsertAttempts = 0;
let transInsertAttempts = 0;
const VID_COLLISIONS = 2;
const TRANS_COLLISIONS = 2;

(supabase as any).from = (table: string) => {
  if (table === 'vouchersc1') {
    return {
      insert: async () => {
        vidInsertAttempts++;
        if (vidInsertAttempts <= VID_COLLISIONS) {
          return { error: { code: '23505', message: 'duplicate key value violates unique constraint "vouchersc1_pkey"' } };
        }
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    };
  }
  if (table === 'transc1') {
    return {
      insert: async () => {
        transInsertAttempts++;
        if (transInsertAttempts <= TRANS_COLLISIONS) {
          return { error: { code: '23505', message: 'duplicate key value violates unique constraint "transc1_pkey"' } };
        }
        return { error: null };
      },
    };
  }
  return { insert: async () => ({ error: null }), delete: () => ({ eq: async () => ({ error: null }) }) };
};

let threw = false;
let errMsg = '';
try {
  await createVoucher({
    type: 'journal',
    date: '2025-01-01',
    accountId: 29,
    narration: 'Test voucher for retry logic',
    lines: [
      { ledgerId: 100, debit: 5000, credit: 0 },
      { ledgerId: 101, debit: 0, credit: 5000 },
    ],
  });
} catch (e: any) {
  threw = true;
  errMsg = e.message;
}

check(`createVoucher does NOT throw despite simulated vid+transid collisions (threw=${threw}${threw ? ', ' + errMsg : ''})`, !threw);
check(`vid insert was retried the expected number of times (${VID_COLLISIONS} collisions + 1 success = ${VID_COLLISIONS + 1}, got ${vidInsertAttempts})`, vidInsertAttempts === VID_COLLISIONS + 1);
check(`transc1 insert was retried the expected number of times (${TRANS_COLLISIONS} collisions + 1 success = ${TRANS_COLLISIONS + 1}, got ${transInsertAttempts})`, transInsertAttempts === TRANS_COLLISIONS + 1);

console.log('\n--- Test 2: a genuine (non-conflict) transc1 error still fails fast and rolls back the voucher header ---');
let deleteWasCalled = false;
(supabase as any).from = (table: string) => {
  if (table === 'vouchersc1') {
    return {
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => { deleteWasCalled = true; return { error: null }; } }),
    };
  }
  if (table === 'transc1') {
    return { insert: async () => ({ error: { code: '42501', message: 'permission denied' } }) };
  }
  return { insert: async () => ({ error: null }) };
};

let threw2 = false;
try {
  await createVoucher({
    type: 'journal',
    date: '2025-01-01',
    accountId: 29,
    narration: 'Test genuine failure',
    lines: [
      { ledgerId: 100, debit: 1000, credit: 0 },
      { ledgerId: 101, debit: 0, credit: 1000 },
    ],
  });
} catch (e) {
  threw2 = true;
}
check('A genuine (non-conflict) transc1 error still throws', threw2);
check('The voucher header gets rolled back (deleted) on genuine failure', deleteWasCalled);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);

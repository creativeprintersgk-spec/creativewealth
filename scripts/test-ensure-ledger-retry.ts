// Standalone verification of the ensureLedgerExists retry-on-conflict fix.
// Simulates the real failure scenario: the first N id attempts collide with
// an existing row, and the function must retry with a higher id instead of
// silently throwing (which is what caused 201 of 220 pre-2015 positions
// across the family to be silently dropped in the real incident).
//
// Run with: VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx tsx scripts/test-ensure-ledger-retry.ts

import { state, ensureLedgerExists } from '../src/logic.ts';
import { supabase } from '../src/supabase.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

// Seed minimal state: a dense, low id range mirroring what was found in the
// real database (ledgers packed 1..672 with near-zero headroom).
state.acmac1 = [];
for (let i = 1; i <= 672; i++) {
  state.acmac1.push({ id: i, name: `Existing Ledger ${i}`, parent_id: 50, is_group: false, acid: 29 });
}

console.log('--- Test 1: Simulated id collisions are retried, not thrown ---');
let insertAttempts = 0;
const collisionCountBeforeSuccess = 3; // simulate 3 collisions before a clean id is found

(supabase as any).from = (table: string) => ({
  insert: async (row: any) => {
    if (table !== 'acmac1') return { error: null };
    insertAttempts++;
    if (insertAttempts <= collisionCountBeforeSuccess) {
      return { error: { code: '23505', message: `duplicate key value violates unique constraint "acmac1_pkey"` } };
    }
    return { error: null };
  }
});

const result = await ensureLedgerExists('Test New Stock', 'stocks', 29);
check(`ensureLedgerExists eventually SUCCEEDS after collisions, doesn't throw (got result=${JSON.stringify(result)})`, result !== null);
check(`Retried the expected number of times (${collisionCountBeforeSuccess} collisions + 1 success = ${collisionCountBeforeSuccess + 1} attempts, got ${insertAttempts})`, insertAttempts === collisionCountBeforeSuccess + 1);

console.log('\n--- Test 2: Non-conflict errors still fail fast (not retried forever) ---');
insertAttempts = 0;
(supabase as any).from = (table: string) => ({
  insert: async () => {
    insertAttempts++;
    return { error: { code: '42501', message: 'permission denied for table acmac1' } };
  }
});

let threw = false;
try {
  await ensureLedgerExists('Another Test Stock', 'stocks', 29);
} catch (e) {
  threw = true;
}
check('A genuine (non-conflict) error still throws immediately', threw);
check(`Did NOT retry a non-conflict error (attempts=${insertAttempts}, expected 1)`, insertAttempts === 1);

console.log('\n--- Test 3: Persistent collisions across all retry attempts eventually give up cleanly ---');
insertAttempts = 0;
(supabase as any).from = (table: string) => ({
  insert: async () => {
    insertAttempts++;
    return { error: { code: '23505', message: 'duplicate key value violates unique constraint "acmac1_pkey"' } };
  }
});

let threwAfterMaxRetries = false;
try {
  await ensureLedgerExists('Persistently Colliding Stock', 'stocks', 29);
} catch (e) {
  threwAfterMaxRetries = true;
}
check('Eventually throws (does not loop forever) if every retry attempt collides', threwAfterMaxRetries);
check(`Made a bounded number of attempts, not unbounded (got ${insertAttempts})`, insertAttempts > 1 && insertAttempts <= 10);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);

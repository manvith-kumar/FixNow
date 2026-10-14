process.env.DB_NAME ??= 'x_test'; process.env.DB_USER ??= 'x'; process.env.JWT_SECRET ??= 'x'.repeat(40);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, TRANSITIONS, BOOKING_STATUS } from '../../src/utils/bookingStateMachine.js';
import { toCsv } from '../../src/utils/csv.js';

test('happy path is allowed for the right actors', () => {
  const path = [['PENDING', 'ASSIGNED', 'TECHNICIAN'], ['ASSIGNED', 'INSPECTING', 'TECHNICIAN'], ['INSPECTING', 'INSPECTION_COMPLETED', 'TECHNICIAN'],
    ['INSPECTION_COMPLETED', 'QUOTATION_SENT', 'TECHNICIAN'], ['QUOTATION_SENT', 'QUOTATION_APPROVED', 'CUSTOMER'], ['QUOTATION_APPROVED', 'IN_PROGRESS', 'TECHNICIAN'], ['IN_PROGRESS', 'COMPLETED', 'TECHNICIAN']];
  for (const [f, t, r] of path) assert.ok(canTransition(f, t, r), `${f}->${t} by ${r}`);
});
test('customers cannot perform technician-only transitions and vice versa', () => {
  assert.ok(!canTransition('ASSIGNED', 'INSPECTING', 'CUSTOMER'));
  assert.ok(!canTransition('QUOTATION_SENT', 'QUOTATION_APPROVED', 'TECHNICIAN'));
  assert.ok(!canTransition('QUOTATION_SENT', 'QUOTATION_APPROVED', 'ADMIN'));
  assert.ok(!canTransition('IN_PROGRESS', 'COMPLETED', 'CUSTOMER'));
});
test('cannot skip steps: no work without an approved quotation, no completion from inspection', () => {
  assert.ok(!canTransition('INSPECTION_COMPLETED', 'IN_PROGRESS', 'TECHNICIAN'));
  assert.ok(!canTransition('QUOTATION_SENT', 'IN_PROGRESS', 'TECHNICIAN'));
  assert.ok(!canTransition('QUOTATION_REJECTED', 'IN_PROGRESS', 'TECHNICIAN'));
  assert.ok(!canTransition('PENDING', 'COMPLETED', 'ADMIN'));
});
test('terminal states have no exits', () => {
  assert.deepEqual(TRANSITIONS[BOOKING_STATUS.COMPLETED], {});
  assert.deepEqual(TRANSITIONS[BOOKING_STATUS.CANCELLED], {});
});
test('CSV neutralises formula injection and quotes special characters', () => {
  const csv = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: '=HYPERLINK("x")', b: 'one, "two"' }]);
  assert.equal(csv, `A,B\n"'=HYPERLINK(""x"")","one, ""two"""\n`);
});

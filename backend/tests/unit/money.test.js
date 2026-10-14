process.env.DB_NAME ??= 'x_test'; process.env.DB_USER ??= 'x'; process.env.JWT_SECRET ??= 'x'.repeat(40);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuotation, toMinor, fromMinor } from '../../src/utils/money.js';

const item = (quantity, unitPrice, itemType = 'PART') => ({ itemType, description: 'x item', quantity, unitPrice });

test('line totals and totals use exact decimal arithmetic (0.1 + 0.2 style traps)', () => {
  const r = calculateQuotation({ items: [item('3', '0.10'), item('1', '0.20')] });
  assert.equal(r.subtotal, '0.50');
  assert.equal(r.totalAmount, '0.50');
});
test('fractional quantities round half up per line', () => {
  const r = calculateQuotation({ items: [item('1.5', '33.33')] }); // 49.995 -> 50.00
  assert.equal(r.items[0].lineTotal, '50.00');
});
test('discount (fixed) and tax (percent of discounted subtotal)', () => {
  const r = calculateQuotation({ items: [item('2', '500.00', 'LABOUR'), item('1', '250.50')], discountAmount: '50', taxRate: '18' });
  assert.equal(r.subtotal, '1250.50');
  assert.equal(r.discountAmount, '50.00');
  assert.equal(r.taxAmount, '216.09'); // 1200.50 * 0.18 = 216.09
  assert.equal(r.totalAmount, '1416.59');
});
test('tax rounding is half-up', () => {
  const r = calculateQuotation({ items: [item('1', '0.05')], taxRate: '10' }); // 0.005 -> 0.01
  assert.equal(r.taxAmount, '0.01');
});
test('rejects negative, malformed and over-precise amounts', () => {
  for (const bad of ['-1', 'abc', '1.234', '', '1e3']) assert.throws(() => calculateQuotation({ items: [item('1', bad)] }), RangeError, `unitPrice ${bad}`);
  assert.throws(() => calculateQuotation({ items: [item('0', '10')] }), RangeError);
  assert.throws(() => calculateQuotation({ items: [item('-2', '10')] }), RangeError);
});
test('rejects excessive discount, excessive tax and empty items', () => {
  assert.throws(() => calculateQuotation({ items: [item('1', '100')], discountAmount: '100.01' }), /Discount/);
  assert.throws(() => calculateQuotation({ items: [item('1', '100')], taxRate: '30.01' }), /Tax/);
  assert.throws(() => calculateQuotation({ items: [] }), /line item/);
  assert.throws(() => calculateQuotation({ items: [item('1', '100')], discountAmount: '100' }), /greater than zero/);
});
test('toMinor/fromMinor round trip', () => {
  assert.equal(toMinor('12.5'), 1250);
  assert.equal(fromMinor(5), '0.05');
  assert.equal(fromMinor(123456), '1234.56');
});

// Decimal-safe money arithmetic. All amounts are handled as INTEGER MINOR UNITS (paise/cents).
// Rounding rule (documented in docs/DECISIONS.md): round half UP (away from zero) to 2 decimal places.
// Quantities have at most 2 decimal places and are handled as hundredths.

const MONEY_RE = /^\d{1,10}(\.\d{1,2})?$/;
const QTY_RE = /^\d{1,8}(\.\d{1,2})?$/;
const RATE_RE = /^\d{1,3}(\.\d{1,2})?$/;

/** "12.5" | 12.5 -> 1250 ; throws on invalid / negative / >2 decimals. */
export function toMinor(value, label = 'amount') {
  const s = typeof value === 'number' ? value.toString() : String(value ?? '').trim();
  if (!MONEY_RE.test(s)) throw new RangeError(`${label} must be a non-negative number with at most 2 decimal places`);
  const [i, f = ''] = s.split('.');
  return Number(i) * 100 + Number((f + '00').slice(0, 2));
}
export function parseQuantityHundredths(value, label = 'quantity') {
  const s = typeof value === 'number' ? value.toString() : String(value ?? '').trim();
  if (!QTY_RE.test(s)) throw new RangeError(`${label} must be a positive number with at most 2 decimal places`);
  const [i, f = ''] = s.split('.');
  const h = Number(i) * 100 + Number((f + '00').slice(0, 2));
  if (h <= 0) throw new RangeError(`${label} must be greater than zero`);
  return h;
}
export function parseRateHundredths(value, label = 'tax rate') {
  const s = typeof value === 'number' ? value.toString() : String(value ?? '0').trim();
  if (!RATE_RE.test(s)) throw new RangeError(`${label} must be a non-negative percentage with at most 2 decimal places`);
  const [i, f = ''] = s.split('.');
  return Number(i) * 100 + Number((f + '00').slice(0, 2));
}
export const fromMinor = (m) => `${Math.floor(m / 100)}.${String(m % 100).padStart(2, '0')}`;

/** round(a*b/d) half up for non-negative integers. */
function mulDivRound(a, b, d) {
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(d);
  return Number((num * 2n + den) / (den * 2n));
}

export const MAX_TOTAL_MINOR = 100_000_000_00; // 100 million currency units safety cap
export const MAX_TAX_RATE_HUNDREDTHS = 3000;   // 30.00 %

/**
 * Calculate a quotation on the server. Never trust client totals.
 * items: [{ itemType, description, quantity, unitPrice }]
 * discountAmount: fixed amount (must not exceed subtotal)
 * taxRate: percent applied to (subtotal - discount)
 * Returns decimal strings for storage/serialization.
 */
export function calculateQuotation({ items, discountAmount = '0', taxRate = '0' }) {
  if (!Array.isArray(items) || items.length === 0) throw new RangeError('At least one line item is required');
  const lines = items.map((it, idx) => {
    const qtyH = parseQuantityHundredths(it.quantity, `items[${idx}].quantity`);
    const unitMinor = toMinor(it.unitPrice, `items[${idx}].unitPrice`);
    const lineMinor = mulDivRound(unitMinor, qtyH, 100);
    return { ...it, quantity: fromMinor(qtyH), unitPrice: fromMinor(unitMinor), lineTotal: fromMinor(lineMinor), lineMinor };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineMinor, 0);
  const discount = toMinor(discountAmount, 'discountAmount');
  if (discount > subtotal) throw new RangeError('Discount cannot exceed the subtotal');
  const rateH = parseRateHundredths(taxRate);
  if (rateH > MAX_TAX_RATE_HUNDREDTHS) throw new RangeError('Tax rate cannot exceed 30%');
  const taxable = subtotal - discount;
  const tax = mulDivRound(taxable, rateH, 10000);
  const total = taxable + tax;
  if (total > MAX_TOTAL_MINOR) throw new RangeError('Quotation total is too large');
  if (total <= 0) throw new RangeError('Quotation total must be greater than zero');
  return {
    items: lines.map(({ lineMinor, ...rest }) => rest),
    subtotal: fromMinor(subtotal),
    discountAmount: fromMinor(discount),
    taxRate: fromMinor(rateH),
    taxAmount: fromMinor(tax),
    totalAmount: fromMinor(total),
  };
}

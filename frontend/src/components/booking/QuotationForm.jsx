import { useState } from 'react';
import { quotationsApi } from '../../api/index.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { Alert, Button, Modal, SelectField, TextField, TextareaField } from '../ui/index.js';
import { ITEM_TYPES } from '../../utils/status.js';

const blank = (type = 'LABOUR') => ({ itemType: type, description: '', quantity: '1', unitPrice: '' });
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Create the first quotation or a revision (a new version; earlier ones are preserved by the backend).
 * No totals are calculated here: the server returns the authoritative subtotal, tax and total.
 */
export function QuotationForm({ open, onClose, booking, onSaved, defaultTaxRate = '0' }) {
  const current = booking.currentQuotation;
  const isRevision = !!current?.id;
  const needsRevisionNotes = ['QUOTATION_APPROVED', 'IN_PROGRESS'].includes(booking.status);
  const initialItems = () => (isRevision && current.items?.length ? current.items.map((i) => ({ itemType: i.itemType, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })) : [blank('LABOUR')]);
  const [items, setItems] = useState(initialItems);
  const [discount, setDiscount] = useState(isRevision ? String(current.discountAmount ?? '0') : '0');
  const [taxRate, setTaxRate] = useState(isRevision ? String(current.taxRate ?? '0') : String(defaultTaxRate));
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState(isRevision ? current.notes ?? '' : '');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [errs, setErrs] = useState({});

  const submit = useSubmit(async () => {
    const body = {
      bookingId: booking.id,
      items: items.map((i) => ({ itemType: i.itemType, description: i.description.trim(), quantity: i.quantity.trim(), unitPrice: i.unitPrice.trim() })),
      discountAmount: discount.trim() || '0', taxRate: taxRate.trim() || '0',
      ...(notes.trim() ? { notes: notes.trim() } : {}), ...(validUntil ? { validUntil } : {}), ...(revisionNotes.trim() ? { revisionNotes: revisionNotes.trim() } : {}),
    };
    const res = await quotationsApi.create(body);
    onSaved(res.data);
  });

  const setItem = (i, patch) => setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const validate = () => {
    const e = {};
    items.forEach((it, i) => {
      if (it.description.trim().length < 2) e[`d${i}`] = 'Describe the item.';
      if (!/^\d{1,8}(\.\d{1,2})?$/.test(it.quantity.trim()) || Number(it.quantity) <= 0) e[`q${i}`] = 'Quantity must be above 0, up to 2 decimals.';
      if (!MONEY.test(it.unitPrice.trim())) e[`p${i}`] = 'Enter a price, up to 2 decimals.';
    });
    if (!MONEY.test((discount.trim() || '0'))) e.discount = 'Enter a discount amount, up to 2 decimals.';
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(taxRate.trim() || '0') || Number(taxRate) > 30) e.taxRate = 'Tax must be between 0 and 30%.';
    if (needsRevisionNotes && revisionNotes.trim().length < 3) e.revisionNotes = 'Explain why the quotation is changing.';
    setErrs(e);
    return !Object.keys(e).length;
  };
  const fe = (k) => errs[k] || submit.fieldErrors[k];

  return (
    <Modal open={open} onClose={onClose} wide title={isRevision ? `Revise quotation (new version ${(current.versionNumber ?? 0) + 1})` : 'Create quotation'}
      footer={<><Button onClick={onClose} disabled={submit.busy}>Cancel</Button><Button variant="primary" busy={submit.busy} busyLabel="Sending..." onClick={() => validate() && submit.run()}>{isRevision ? 'Send revised quotation' : 'Send quotation'}</Button></>}>
      <p className="muted small">The system calculates the subtotal, tax and total when you send. The customer must approve this version before work can start.</p>
      {isRevision && <Alert tone="info">The previous version stays in the history. The customer will be asked to decide on the new version.</Alert>}
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ fontWeight: 700, marginBottom: 8 }}>Line items</legend>
        {items.map((it, i) => (
          <div className="item-row" key={i}>
            <SelectField label={i === 0 ? 'Type' : undefined} aria-label={`Item ${i + 1} type`} value={it.itemType} options={ITEM_TYPES} onChange={(e) => setItem(i, { itemType: e.target.value })} />
            <TextField className="desc" label={i === 0 ? 'Description' : undefined} aria-label={`Item ${i + 1} description`} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} error={fe(`d${i}`)} maxLength={255} />
            <TextField label={i === 0 ? 'Qty' : undefined} aria-label={`Item ${i + 1} quantity`} inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} error={fe(`q${i}`)} />
            <TextField label={i === 0 ? 'Unit price' : undefined} aria-label={`Item ${i + 1} unit price`} inputMode="decimal" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value })} error={fe(`p${i}`)} />
            <Button size="sm" variant="ghost" disabled={items.length === 1} onClick={() => setItems((a) => a.filter((_, x) => x !== i))} aria-label={`Remove item ${i + 1}`} style={{ marginTop: i === 0 ? '1.6rem' : 0 }}>Remove</Button>
          </div>
        ))}
        <Button size="sm" onClick={() => setItems((a) => [...a, blank(isRevision ? 'ADDITIONAL' : 'PART')])} disabled={items.length >= 50}>Add line item</Button>
      </fieldset>
      <div className="form-grid" style={{ marginTop: 'var(--s-4)' }}>
        <TextField label="Discount amount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} error={fe('discount') || fe('discountAmount')} hint="A fixed amount taken off the subtotal." />
        <TextField label="Tax rate (%)" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} error={fe('taxRate')} hint="Applied after the discount. Maximum 30%." />
        <TextField label="Valid until (optional)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} hint="Leave empty to use the default validity period." />
        <div />
        <TextareaField className="full" label="Notes for the customer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        {(isRevision) && <TextareaField className="full" label={needsRevisionNotes ? 'Reason for the revision' : 'Reason for the revision (optional)'} required={needsRevisionNotes} value={revisionNotes} onChange={(e) => setRevisionNotes(e.target.value)} error={fe('revisionNotes')} maxLength={1000} hint={needsRevisionNotes ? 'Required because work was already approved or has started, for example extra work found.' : undefined} />}
      </div>
    </Modal>
  );
}

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuotationHistory, QuotationView } from './QuotationView.jsx';

const q = (over = {}) => ({ id: 1, versionNumber: 1, status: 'PENDING', createdAt: '2026-01-01 10:00:00', subtotal: '749.50', discountAmount: '10.00', taxRate: '18.00', taxAmount: '133.11', totalAmount: '872.61', validUntil: '2026-02-01', notes: 'Valid a week', items: [
  { id: 1, itemType: 'LABOUR', description: 'Repair labour', quantity: '2.00', unitPrice: '300.00', lineTotal: '600.00' }, { id: 2, itemType: 'PART', description: 'Washer set', quantity: '1.00', unitPrice: '149.50', lineTotal: '149.50' }], ...over });

describe('QuotationView', () => {
  it('shows exactly the totals the server calculated', () => {
    render(<QuotationView quotation={q()} />);
    expect(screen.getByText('Repair labour')).toBeInTheDocument();
    expect(screen.getByText(/872\.61/)).toBeInTheDocument(); expect(screen.getByText(/133\.11/)).toBeInTheDocument(); expect(screen.getByText(/Tax \(18%\)/)).toBeInTheDocument();
    expect(screen.getByText('Awaiting decision')).toBeInTheDocument();
  });
  it('hides discount and tax rows when they are zero', () => {
    render(<QuotationView quotation={q({ discountAmount: '0.00', taxAmount: '0.00', taxRate: '0.00' })} />);
    expect(screen.queryByText('Discount')).toBeNull(); expect(screen.queryByText(/^Tax/)).toBeNull();
  });
  it('lists earlier versions separately from the current one', () => {
    render(<QuotationHistory currentId={2} versions={[q({ id: 2, versionNumber: 2 }), q({ id: 1, versionNumber: 1, status: 'REJECTED', decisionReason: 'Too high' })]} />);
    expect(screen.getByText('Earlier versions')).toBeInTheDocument(); expect(screen.getByText('Version 1')).toBeInTheDocument(); expect(screen.queryByText('Version 2')).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, Pagination } from './DataTable.jsx';

const base = { rows: [], loading: false, error: null, meta: null, setPage: () => {}, reload: () => {}, data: [] };
describe('DataTable', () => {
  it('handles loading, error and empty states', () => {
    const cols = [{ key: 'a', header: 'A' }];
    const { rerender } = render(<DataTable list={{ ...base, loading: true, data: null }} columns={cols} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    rerender(<DataTable list={{ ...base, error: { response: { status: 404, data: { error: { message: 'Nope' } } } }, data: null }} columns={cols} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Nope');
    rerender(<DataTable list={base} columns={cols} emptyTitle="No rows" />);
    expect(screen.getByText('No rows')).toBeInTheDocument();
  });
  it('renders rows and paginates', async () => {
    const setPage = vi.fn();
    render(<DataTable list={{ ...base, rows: [{ id: 1, a: 'Row one' }], data: [{ id: 1 }], meta: { page: 1, pageSize: 1, total: 3, totalPages: 3 }, setPage }} columns={[{ key: 'a', header: 'A' }]} />);
    expect(screen.getByText('Row one')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' })); expect(setPage).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
  it('shows a result count only for a single page', () => { render(<Pagination meta={{ page: 1, totalPages: 1, total: 4 }} onPage={() => {}} />); expect(screen.getByText('4 results')).toBeInTheDocument(); });
});

describe('EmptyState heading level', () => {
  it('can be the page h1 for "not found" pages and defaults to h3 inside a page', async () => {
    const { EmptyState } = await import('./Feedback.jsx');
    const { render: r, screen: sc } = await import('@testing-library/react');
    r(<EmptyState as="h1" title="Booking not found" />); expect(sc.getByRole('heading', { level: 1, name: 'Booking not found' })).toBeInTheDocument();
    r(<EmptyState title="Nothing yet" />); expect(sc.getByRole('heading', { level: 3, name: 'Nothing yet' })).toBeInTheDocument();
  });
});

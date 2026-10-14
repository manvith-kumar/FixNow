import { Button } from './Button.jsx';
import { LoadingState, ErrorState, EmptyState } from './Feedback.jsx';
import { TableWrap } from './Misc.jsx';

export function Pagination({ meta, onPage, loading }) {
  if (!meta || meta.totalPages <= 1) return meta ? <div className="pagination"><span>{meta.total} {meta.total === 1 ? 'result' : 'results'}</span></div> : null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>Page {meta.page} of {meta.totalPages} ({meta.total} results)</span>
      <span className="row">
        <Button size="sm" disabled={meta.page <= 1 || loading} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button size="sm" disabled={meta.page >= meta.totalPages || loading} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </span>
    </nav>
  );
}

/** columns: [{ key, header, render?(row), className? }]. `list` is the object returned by usePagedList. */
export function DataTable({ list, columns, rowKey = (r) => r.id, emptyTitle = 'No results', emptyText = 'Try changing the filters.', caption }) {
  const { rows, loading, error, meta, setPage, reload, data } = list;
  if (loading && data === null) return <LoadingState />;
  if (error && data === null) return <ErrorState error={error} onRetry={reload} />;
  if (!rows.length) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return (
    <>
      <TableWrap label={caption ?? 'Results'} aria-busy={loading || undefined} style={loading ? { opacity: 0.6 } : undefined}>
        <table className="table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.className}>{c.header}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={rowKey(r)}>{columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody>
        </table>
      </TableWrap>
      <Pagination meta={meta} onPage={setPage} loading={loading} />
    </>
  );
}

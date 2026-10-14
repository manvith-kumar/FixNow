import { useSearchParams } from 'react-router-dom';
import { catalogueApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useState, useEffect } from 'react';
import { Async, Button, Pagination, SelectField, TextField } from '../../components/ui/index.js';
import { ServiceCard } from '../../components/common/ServiceCard.jsx';

export default function Services() {
  useDocumentTitle('Services');
  const [sp, setSp] = useSearchParams();
  const [text, setText] = useState(sp.get('q') ?? '');
  const q = useDebounce(text, 350);
  const categoryId = sp.get('categoryId') ?? '';
  const sortBy = sp.get('sortBy') ?? 'name';
  const page = Number(sp.get('page') ?? 1);

  const update = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n, { replace: true }); };
  useEffect(() => {
    if ((sp.get('q') ?? '') !== q) update({ q, page: '' });
    // Intentionally keyed on the debounced text only: `update` reads the current URL params when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const cats = useFetch(() => catalogueApi.listCategories());
  const list = useFetch(() => catalogueApi.listServices({ q: sp.get('q') ?? '', categoryId, sortBy, sortDir: sortBy === 'name' ? 'asc' : 'asc', page, pageSize: 12 }), [sp.toString()]);

  return (
    <div className="container">
      <div className="page-hero"><h1>Browse services</h1><p>Prices are indicative starting prices. After an inspection, the technician sends an itemized quotation and you decide whether to go ahead.</p></div>
      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <TextField className="wide" label="Search" placeholder="Service or problem" value={text} onChange={(e) => setText(e.target.value)} />
        <SelectField label="Category" value={categoryId} placeholder="All categories" options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => update({ categoryId: e.target.value, page: '' })} />
        <SelectField label="Sort by" value={sortBy} options={[{ value: 'name', label: 'Name' }, { value: 'price', label: 'Lowest starting price' }]} onChange={(e) => update({ sortBy: e.target.value === 'name' ? '' : e.target.value, page: '' })} />
        {(text || categoryId) && <Button onClick={() => { setText(''); setSp({}, { replace: true }); }}>Clear filters</Button>}
      </form>
      <Async state={list} emptyTitle="No services match your search" empty="Try a different word or clear the filters.">
        {(rows) => (<><div className="svc-grid">{rows.map((s) => <ServiceCard key={s.id} service={s} />)}</div><Pagination meta={list.meta} loading={list.loading} onPage={(p) => update({ page: p > 1 ? String(p) : '' })} /></>)}
      </Async>
    </div>
  );
}

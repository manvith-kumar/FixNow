import { useState } from 'react';
import { catalogueApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ActiveBadge, Alert, Async, Badge, Button, CheckField, ConfirmDialog, DataTable, Modal, PageHeader, SelectField, TextField, TextareaField, TableWrap } from '../../components/ui/index.js';
import { formatMoney } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

function CategoryForm({ cat, onClose, onSaved }) {
  const [f, setF] = useState({ name: cat?.name ?? '', description: cat?.description ?? '', icon: cat?.icon ?? '', isActive: cat?.isActive ?? true });
  const [err, setErr] = useState({});
  const submit = useSubmit(async () => {
    const body = { name: f.name.trim(), isActive: f.isActive }; if (f.description.trim()) body.description = f.description.trim(); if (f.icon.trim()) body.icon = f.icon.trim();
    onSaved(cat ? await catalogueApi.updateCategory(cat.id, body) : await catalogueApi.createCategory(body));
  });
  return (
    <Modal open onClose={onClose} title={cat ? 'Edit category' : 'New category'} footer={<><Button onClick={onClose} disabled={submit.busy}>Cancel</Button><Button variant="primary" busy={submit.busy} onClick={() => { if (f.name.trim().length < 2) { setErr({ name: 'Enter a name.' }); return; } setErr({}); submit.run(); }}>Save category</Button></>}>
      <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err.name || submit.fieldErrors.name} required />
      <TextareaField label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
      <TextField label="Icon name (optional)" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} />
      <CheckField label="Active (visible to customers)" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
    </Modal>
  );
}

export function Categories() {
  useDocumentTitle('Categories');
  const toast = useToast();
  const list = useFetch(() => catalogueApi.listCategories({ all: 'true' }));
  const [edit, setEdit] = useState(null);
  const [toggle, setToggle] = useState(null);
  return (
    <>
      <PageHeader title="Categories" subtitle="Deactivate instead of deleting: history keeps its references." actions={<Button variant="primary" onClick={() => setEdit('new')}>New category</Button>} />
      <div className="panel panel-flush">
        <Async state={list} emptyTitle="No categories yet">
          {(rows) => <TableWrap label="Categories"><table className="table"><thead><tr><th>Name</th><th>Description</th><th className="num">Services</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map((c) => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.description}</td><td className="num">{c.serviceCount}</td><td><ActiveBadge active={c.isActive} /></td>
              <td className="actions"><span className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setEdit(c)}>Edit</Button><Button size="sm" variant={c.isActive ? 'danger' : 'secondary'} onClick={() => setToggle(c)}>{c.isActive ? 'Deactivate' : 'Activate'}</Button></span></td></tr>)}</tbody></table></TableWrap>}
        </Async>
      </div>
      {edit && <CategoryForm cat={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast.success('Category saved.'); list.reload(); }} />}
      <ConfirmDialog open={!!toggle} danger={toggle?.isActive} onClose={() => setToggle(null)} title={`${toggle?.isActive ? 'Deactivate' : 'Activate'} "${toggle?.name}"?`} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'}
        message={toggle?.isActive ? 'Its services will be hidden from customers. Existing bookings are not affected.' : 'It will be visible to customers again.'}
        onConfirm={async () => { try { await catalogueApi.updateCategory(toggle.id, { isActive: !toggle.isActive }); toast.success('Category updated.'); setToggle(null); list.reload(); } catch (e) { throw new Error(getErrorMessage(e)); } }} />
    </>
  );
}

function ServiceForm({ svc, categories, onClose, onSaved }) {
  const [f, setF] = useState({ categoryId: svc?.categoryId ?? '', name: svc?.name ?? '', description: svc?.description ?? '', imageUrl: svc?.imageUrl ?? '', price: svc?.indicativeStartingPrice ?? '', isFeatured: svc?.isFeatured ?? false, isActive: svc?.isActive ?? true });
  const [err, setErr] = useState({});
  const submit = useSubmit(async () => {
    const body = { categoryId: Number(f.categoryId), name: f.name.trim(), isFeatured: f.isFeatured, isActive: f.isActive, indicativeStartingPrice: f.price === '' ? null : String(f.price).trim() };
    if (f.description.trim()) body.description = f.description.trim(); if (f.imageUrl.trim()) body.imageUrl = f.imageUrl.trim();
    onSaved(svc ? await catalogueApi.updateService(svc.id, body) : await catalogueApi.createService(body));
  });
  const go = () => {
    const e = {};
    if (!f.categoryId) e.categoryId = 'Choose a category.';
    if (f.name.trim().length < 2) e.name = 'Enter a name.';
    if (f.price !== '' && !/^\d{1,8}(\.\d{1,2})?$/.test(String(f.price).trim())) e.price = 'Enter a price with up to 2 decimals, or leave it empty.';
    setErr(e); if (!Object.keys(e).length) submit.run();
  };
  const fe = (k) => err[k] || submit.fieldErrors[k];
  return (
    <Modal open onClose={onClose} wide title={svc ? 'Edit service' : 'New service'} footer={<><Button onClick={onClose} disabled={submit.busy}>Cancel</Button><Button variant="primary" busy={submit.busy} onClick={go}>Save service</Button></>}>
      <div className="form-grid">
        <SelectField label="Category" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} placeholder="Choose" error={fe('categoryId')} options={categories.map((c) => ({ value: c.id, label: c.name }))} required />
        <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={fe('name')} required />
        <TextareaField className="full" label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={4000} />
        <TextField label="Indicative starting price" inputMode="decimal" value={f.price ?? ''} onChange={(e) => setF({ ...f, price: e.target.value })} error={fe('price') || fe('indicativeStartingPrice')} hint="Shown to customers as indicative only, never charged." />
        <TextField label="Image URL (optional)" value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} />
      </div>
      <CheckField label="Featured on the home page" checked={f.isFeatured} onChange={(e) => setF({ ...f, isFeatured: e.target.checked })} />
      <CheckField label="Active (visible to customers)" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
    </Modal>
  );
}

export function Services() {
  useDocumentTitle('Services');
  const toast = useToast();
  const cats = useFetch(() => catalogueApi.listCategories({ all: 'true' }));
  const list = usePagedList((p) => catalogueApi.listServices({ ...p, all: 'true', sortBy: 'name', sortDir: 'asc' }), { q: '', categoryId: '' });
  const [edit, setEdit] = useState(null);
  const [toggle, setToggle] = useState(null);
  const columns = [
    { key: 'name', header: 'Service', render: (s) => <><strong>{s.name}</strong><div className="muted small">{s.categoryName}</div></> },
    { key: 'price', header: 'Indicative price', className: 'num', render: (s) => (s.indicativeStartingPrice ? formatMoney(s.indicativeStartingPrice) : '-') },
    { key: 'feat', header: 'Featured', render: (s) => (s.isFeatured ? <Badge tone="info">Featured</Badge> : '-') },
    { key: 'st', header: 'Status', render: (s) => <ActiveBadge active={s.isActive} /> },
    { key: 'a', header: '', className: 'actions', render: (s) => <span className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setEdit(s)}>Edit</Button><Button size="sm" variant={s.isActive ? 'danger' : 'secondary'} onClick={() => setToggle(s)}>{s.isActive ? 'Deactivate' : 'Activate'}</Button></span> },
  ];
  return (
    <>
      <PageHeader title="Services" subtitle="Catalogue prices are indicative only. The payable amount is always the approved quotation." actions={<Button variant="primary" onClick={() => setEdit('new')} disabled={!cats.data?.length}>New service</Button>} />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField className="wide" label="Search" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
          <SelectField label="Category" value={list.filters.categoryId} placeholder="All" options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => list.setFilter('categoryId', e.target.value)} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Services" emptyTitle="No services found" />
      </div>
      {edit && <ServiceForm svc={edit === 'new' ? null : edit} categories={cats.data ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast.success('Service saved.'); list.reload(); }} />}
      <ConfirmDialog open={!!toggle} danger={toggle?.isActive} onClose={() => setToggle(null)} title={`${toggle?.isActive ? 'Deactivate' : 'Activate'} "${toggle?.name}"?`} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'}
        message={toggle?.isActive ? 'Customers will no longer be able to book it. Existing bookings are not affected.' : 'Customers will be able to book it again.'}
        onConfirm={async () => { try { await catalogueApi.updateService(toggle.id, { isActive: !toggle.isActive }); toast.success('Service updated.'); setToggle(null); list.reload(); } catch (e) { throw new Error(getErrorMessage(e)); } }} />
    </>
  );
}

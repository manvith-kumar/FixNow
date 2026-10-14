import { useState } from 'react';
import { addressesApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, Badge, Button, Card, ConfirmDialog, PageHeader } from '../../components/ui/index.js';
import { AddressForm } from '../../components/common/AddressForm.jsx';
import { getErrorMessage } from '../../utils/errors.js';

export default function Addresses() {
  useDocumentTitle('Addresses');
  const toast = useToast();
  const list = useFetch(() => addressesApi.list());
  const [edit, setEdit] = useState(null); // null | 'new' | address
  const [del, setDel] = useState(null);
  const makeDefault = async (a) => { try { await addressesApi.setDefault(a.id); toast.success('Default address updated.'); list.reload(); } catch (e) { toast.error(getErrorMessage(e)); } };
  return (
    <>
      <PageHeader title="Your addresses" subtitle="Choose one of these when you book." actions={<Button variant="primary" onClick={() => setEdit('new')}>Add address</Button>} />
      <Async state={list} emptyTitle="No addresses yet" empty="Add the address where you need work done." emptyAction={<Button variant="primary" onClick={() => setEdit('new')}>Add address</Button>}>
        {(rows) => <div className="grid grid-2">{rows.map((a) => (
          <Card key={a.id} title={<>{a.label} {a.isDefault && <Badge tone="ok">Default</Badge>}</>}>
            <p>{[a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ')}</p>
            {a.latitude != null && <p className="small muted">Location saved: {a.latitude}, {a.longitude}</p>}
            <div className="row"><Button size="sm" onClick={() => setEdit(a)}>Edit</Button>{!a.isDefault && <Button size="sm" onClick={() => makeDefault(a)}>Make default</Button>}<Button size="sm" variant="danger" onClick={() => setDel(a)}>Delete</Button></div>
          </Card>))}</div>}
      </Async>
      {edit && <AddressForm open onClose={() => setEdit(null)} address={edit === 'new' ? null : edit} onSaved={() => { setEdit(null); toast.success('Address saved.'); list.reload(); }} />}
      <ConfirmDialog open={!!del} danger onClose={() => setDel(null)} title="Delete this address?" confirmLabel="Delete address" cancelLabel="Keep it"
        onConfirm={async () => { try { await addressesApi.remove(del.id); setDel(null); toast.success('Address deleted.'); list.reload(); } catch (e) { throw new Error(getErrorMessage(e)); } }}
        message={del ? `${del.label}: ${del.line1}. Addresses used by an existing booking cannot be deleted.` : ''} />
    </>
  );
}

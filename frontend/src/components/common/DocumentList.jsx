import { useState } from 'react';
import { applicationsApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../ui/index.js';
import { saveBlob } from '../../utils/download.js';
import { getErrorMessage } from '../../utils/errors.js';
import { formatDateTime, humanize } from '../../utils/format.js';

/** Documents are protected by the API: they are fetched with the bearer token, never linked directly. */
export function DocumentList({ applicationId, documents }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  if (!documents?.length) return <p className="muted">No documents uploaded.</p>;
  const download = async (d) => {
    setBusy(d.id);
    try { saveBlob(await applicationsApi.downloadDocument(applicationId, d.id), d.originalName); } catch (e) { toast.error(getErrorMessage(e, 'Could not download this document.')); } finally { setBusy(null); }
  };
  return (
    <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
      {documents.map((d) => (
        <li key={d.id} className="row-between panel" style={{ padding: 'var(--s-3) var(--s-4)' }}>
          <span><strong>{humanize(d.docType)}</strong><br /><span className="small muted">{d.originalName}, {(d.sizeBytes / 1024).toFixed(0)} KB, {formatDateTime(d.uploadedAt)}</span></span>
          <Button size="sm" busy={busy === d.id} onClick={() => download(d)}>Download</Button>
        </li>
      ))}
    </ul>
  );
}

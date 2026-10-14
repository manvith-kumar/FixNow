import { Button, SelectField } from '../ui/index.js';
import { FILE_RULES, validateFile } from '../../utils/download.js';

const DOC_TYPES = [{ value: 'ID_DOCUMENT', label: 'ID document' }, { value: 'CERTIFICATE', label: 'Certificate' }, { value: 'PROOF_OF_EXPERIENCE', label: 'Proof of experience' }, { value: 'OTHER', label: 'Other' }];

/** rows: [{ docType, file }]. Validates type and size in the browser; the server re-validates (including real file content). */
export function FileRows({ rows, onChange, error }) {
  const update = (i, patch) => onChange(rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ fontWeight: 700, marginBottom: 8 }}>Documents</legend>
      <p className="hint muted small">PDF, JPG or PNG, up to 5 MB each, up to {FILE_RULES.maxFiles} files. An ID document is required.</p>
      {rows.map((r, i) => {
        const fileErr = r.file ? validateFile(r.file) : '';
        return (
          <div key={i} className="form-grid" style={{ alignItems: 'start' }}>
            <SelectField label={`Document ${i + 1} type`} value={r.docType} options={DOC_TYPES} onChange={(e) => update(i, { docType: e.target.value })} />
            <div className="field">
              <label htmlFor={`file-${i}`}>File</label>
              <input id={`file-${i}`} className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => update(i, { file: e.target.files?.[0] ?? null })} />
              {fileErr && <span className="field-error" role="alert">{fileErr}</span>}
              {rows.length > 1 && <Button size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, x) => x !== i))}>Remove this document</Button>}
            </div>
          </div>
        );
      })}
      {rows.length < FILE_RULES.maxFiles && <Button size="sm" onClick={() => onChange([...rows, { docType: 'CERTIFICATE', file: null }])}>Add another document</Button>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </fieldset>
  );
}
export const rowsError = (rows, requireId) => {
  if (rows.some((r) => !r.file)) return 'Choose a file for every document row, or remove the empty row.';
  if (rows.some((r) => validateFile(r.file))) return 'One or more files are not valid.';
  if (requireId && !rows.some((r) => r.docType === 'ID_DOCUMENT')) return 'An ID document is required.';
  return '';
};

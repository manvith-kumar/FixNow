import { get, post, http } from './client.js';
/** fields: fullName, phone, specialization, experienceYears, serviceArea, bio?, serviceIds[]; files: [{file, docType}] */
export function buildApplicationForm(fields, files) {
  const fd = new FormData();
  for (const k of ['fullName', 'phone', 'specialization', 'experienceYears', 'serviceArea']) fd.append(k, String(fields[k] ?? ''));
  if (fields.bio) fd.append('bio', fields.bio);
  fd.append('serviceIds', JSON.stringify(fields.serviceIds ?? []));
  fd.append('docTypes', files.map((f) => f.docType).join(','));
  files.forEach((f) => fd.append('documents', f.file));
  return fd;
}
export const submit = (fields, files) => post('/technician-applications', buildApplicationForm(fields, files));
export const addDocuments = (id, files) => {
  const fd = new FormData();
  fd.append('docTypes', files.map((f) => f.docType).join(','));
  files.forEach((f) => fd.append('documents', f.file));
  return post(`/technician-applications/${id}/documents`, fd);
};
export const mine = () => get('/technician-applications/mine');
export const adminList = (params) => get('/technician-applications', params);
export const adminGet = (id) => get(`/technician-applications/${id}`);
export const decide = (id, decision, notes) => post(`/technician-applications/${id}/decision`, { decision, ...(notes ? { notes } : {}) });
/** Documents are protected: fetch with the bearer token and return a Blob. */
export async function downloadDocument(appId, docId) {
  const res = await http.get(`/technician-applications/${appId}/documents/${docId}/download`, { responseType: 'blob' });
  return res.data;
}

/** Save a Blob (protected document or CSV) through a temporary link. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const FILE_RULES = { maxBytes: 5 * 1024 * 1024, maxFiles: 5, types: ['application/pdf', 'image/jpeg', 'image/png'] };
export function validateFile(file) {
  if (!FILE_RULES.types.includes(file.type)) return 'Only PDF, JPG or PNG files are accepted.';
  if (file.size > FILE_RULES.maxBytes) return 'Each file must be 5 MB or smaller.';
  return '';
}

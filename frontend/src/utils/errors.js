/** Human readable message from an Axios/backend error. Never exposes stack traces. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.code === 'ECONNABORTED') return 'The request took too long. Check your connection and try again.';
  if (!error.response) return error.message === 'Network Error' ? 'Cannot reach the FixNow server. Check that the backend is running and VITE_API_BASE_URL is correct.' : (error.message || fallback);
  const e = error.response.data?.error;
  if (e?.code === 'VALIDATION_ERROR' && Array.isArray(e.details) && e.details.length) {
    return e.details.map((d) => (d.field ? `${labelOf(d.field)}: ${d.message}` : d.message)).join(' ');
  }
  if (error.response.status === 429) return e?.message || 'Too many requests. Please wait a moment and try again.';
  if (error.response.status >= 500) return 'The server had a problem. Please try again shortly.';
  return e?.message || fallback;
}
export const getErrorCode = (error) => error?.response?.data?.error?.code;
export const getStatus = (error) => error?.response?.status;

/** { fieldName: message } so forms can show errors beside inputs. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  const out = {};
  if (Array.isArray(details)) for (const d of details) if (d.field && !out[d.field]) out[d.field] = d.message;
  return out;
}
const labelOf = (f) => f.replace(/\[(\d+)\]/g, ' $1 ').replace(/\./g, ' ').replace(/([A-Z])/g, ' $1').trim().replace(/^./, (c) => c.toUpperCase());

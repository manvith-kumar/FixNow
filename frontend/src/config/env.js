const raw = import.meta.env?.VITE_API_BASE_URL;
export const env = {
  apiBaseUrl: (raw && raw.trim() ? raw.trim() : 'http://localhost:5000/api').replace(/\/+$/, ''),
};

import { useState, useCallback, useMemo } from 'react';
import { useFetch } from './useFetch.js';
import { useDebounce } from './useDebounce.js';

/** Server-side pagination + filters. `filters` values are sent as query params; text filters named `q` are debounced. */
export function usePagedList(fetcher, initialFilters = {}, { pageSize = 15 } = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const q = useDebounce(filters.q ?? '', 350);
  const params = useMemo(() => ({ ...filters, q, page, pageSize }), [filters, q, page, pageSize]);
  const result = useFetch(() => fetcher(params), [JSON.stringify(params)]);
  const setFilter = useCallback((name, value) => { setFilters((f) => ({ ...f, [name]: value })); setPage(1); }, []);
  const reset = useCallback(() => { setFilters(initialFilters); setPage(1); }, [initialFilters]);
  return { ...result, rows: result.data ?? [], filters, setFilter, reset, page, setPage };
}

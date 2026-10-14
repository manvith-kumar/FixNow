import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export function paging({ page, pageSize }) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
export const pageMeta = ({ page, pageSize }, total) => ({
  page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
/** Whitelisted ORDER BY builder: never interpolates client input. */
export function orderBy(allowed, sortBy, sortDir, fallback) {
  const col = allowed[sortBy] ?? allowed[fallback];
  return `${col} ${String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC'}`;
}

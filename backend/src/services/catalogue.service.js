import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/ids.js';
import { paging, pageMeta } from '../utils/pagination.js';
import * as repo from '../repositories/catalogue.repository.js';
import { audit } from './audit.service.js';

export const mapCategory = (c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, imageUrl: c.image_url, isActive: !!c.is_active, serviceCount: c.service_count });
export const mapService = (s) => ({
  id: s.id, categoryId: s.category_id, categoryName: s.category_name, categorySlug: s.category_slug, name: s.name, slug: s.slug,
  description: s.description, imageUrl: s.image_url, indicativeStartingPrice: s.indicative_starting_price,
  priceDisclaimer: 'Indicative only. The final price is set by an itemized quotation after inspection.',
  isFeatured: !!s.is_featured, isActive: !!s.is_active, avgRating: s.avg_rating, reviewCount: s.review_count,
});
const dupGuard = async (fn) => { try { return await fn(); } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw AppError.conflict('A record with this name already exists', 'DUPLICATE'); throw e; } };

export async function listCategories(opts) { return (await repo.listCategories(pool, opts)).map(mapCategory); }
export async function createCategory(actor, d, ip) {
  const id = await dupGuard(() => repo.insertCategory(pool, { ...d, slug: slugify(d.name) }));
  await audit(pool, actor, 'CATEGORY_CREATED', 'service_category', id, { name: d.name }, ip);
  return mapCategory(await repo.getCategory(pool, id));
}
export async function updateCategory(actor, id, d, ip) {
  if (!(await repo.getCategory(pool, id))) throw AppError.notFound('Category not found');
  await dupGuard(() => repo.updateCategory(pool, id, { ...d, slug: d.name ? slugify(d.name) : undefined }));
  await audit(pool, actor, d.isActive === undefined ? 'CATEGORY_UPDATED' : (d.isActive ? 'CATEGORY_ACTIVATED' : 'CATEGORY_DEACTIVATED'), 'service_category', id, d, ip);
  return mapCategory(await repo.getCategory(pool, id));
}
export async function listServices(q, { adminView = false } = {}) {
  const { rows, total } = await repo.listServices(pool, { ...q, activeOnly: !adminView, ...paging(q) });
  return { rows: rows.map(mapService), meta: pageMeta(q, total) };
}
export async function getService(id, { adminView = false } = {}) {
  const s = await repo.getService(pool, id);
  if (!s || (!adminView && (!s.is_active || !s.category_active))) throw AppError.notFound('Service not found');
  return mapService(s);
}
export async function createService(actor, d, ip) {
  const cat = await repo.getCategory(pool, d.categoryId);
  if (!cat) throw AppError.badRequest('Category does not exist');
  const id = await dupGuard(() => repo.insertService(pool, { ...d, slug: slugify(`${d.name}-${d.categoryId}`) }));
  await audit(pool, actor, 'SERVICE_CREATED', 'service', id, { name: d.name }, ip);
  return mapService(await repo.getService(pool, id));
}
export async function updateService(actor, id, d, ip) {
  if (!(await repo.getService(pool, id))) throw AppError.notFound('Service not found');
  if (d.categoryId && !(await repo.getCategory(pool, d.categoryId))) throw AppError.badRequest('Category does not exist');
  await dupGuard(() => repo.updateService(pool, id, { ...d, slug: d.name ? slugify(`${d.name}-${d.categoryId ?? ''}`) : undefined }));
  await audit(pool, actor, d.isActive === undefined ? 'SERVICE_UPDATED' : (d.isActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED'), 'service', id, d, ip);
  return mapService(await repo.getService(pool, id));
}

import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

export async function listCategories(db, { activeOnly, q }) {
  const where = [], params = [];
  if (activeOnly) where.push('c.is_active = 1');
  if (q) { where.push('(c.name LIKE ? OR c.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  return query(db, `SELECT c.*, (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id AND (? = 0 OR s.is_active = 1)) AS service_count
    FROM service_categories c ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.name`, [activeOnly ? 1 : 0, ...params]);
}
export const getCategory = (db, id) => queryOne(db, 'SELECT * FROM service_categories WHERE id = ?', [id]);
export async function insertCategory(db, d) {
  const r = await exec(db, 'INSERT INTO service_categories (name, slug, description, icon, image_url, is_active) VALUES (?,?,?,?,?,?)',
    [d.name, d.slug, d.description ?? null, d.icon ?? null, d.imageUrl ?? null, d.isActive ? 1 : 0]);
  return r.insertId;
}
export const updateCategory = (db, id, d) => exec(db,
  `UPDATE service_categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description), icon = COALESCE(?, icon),
   image_url = COALESCE(?, image_url), is_active = COALESCE(?, is_active) WHERE id = ?`,
  [d.name ?? null, d.slug ?? null, d.description ?? null, d.icon ?? null, d.imageUrl ?? null, d.isActive === undefined ? null : (d.isActive ? 1 : 0), id]);

const SERVICE_SELECT = `SELECT s.*, c.name AS category_name, c.slug AS category_slug, c.is_active AS category_active,
  (SELECT ROUND(AVG(r.rating),2) FROM reviews r WHERE r.service_id = s.id AND r.status='VISIBLE') AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.service_id = s.id AND r.status='VISIBLE') AS review_count
  FROM services s JOIN service_categories c ON c.id = s.category_id`;

export async function listServices(db, { activeOnly, categoryId, q, featured, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (activeOnly) where.push('s.is_active = 1 AND c.is_active = 1');
  if (categoryId) { where.push('s.category_id = ?'); params.push(categoryId); }
  if (featured !== undefined) { where.push('s.is_featured = ?'); params.push(featured ? 1 : 0); }
  if (q) { where.push('(s.name LIKE ? OR s.description LIKE ? OR c.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(db, `SELECT COUNT(*) c FROM services s JOIN service_categories c ON c.id = s.category_id ${w}`, params)).c;
  const ob = orderBy({ name: 's.name', price: 's.indicative_starting_price', created: 's.created_at' }, sortBy, sortDir, 'name');
  const rows = await query(db, `${SERVICE_SELECT} ${w} ORDER BY ${ob}, s.id LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}
export const getService = (db, id) => queryOne(db, `${SERVICE_SELECT} WHERE s.id = ?`, [id]);
export async function insertService(db, d) {
  const r = await exec(db, `INSERT INTO services (category_id, name, slug, description, image_url, indicative_starting_price, is_featured, is_active)
    VALUES (?,?,?,?,?,?,?,?)`, [d.categoryId, d.name, d.slug, d.description ?? null, d.imageUrl ?? null, d.indicativeStartingPrice ?? null, d.isFeatured ? 1 : 0, d.isActive ? 1 : 0]);
  return r.insertId;
}
export const updateService = (db, id, d) => exec(db,
  `UPDATE services SET category_id = COALESCE(?, category_id), name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description),
   image_url = COALESCE(?, image_url), indicative_starting_price = ${d.indicativeStartingPrice === undefined ? 'indicative_starting_price' : '?'},
   is_featured = COALESCE(?, is_featured), is_active = COALESCE(?, is_active) WHERE id = ?`,
  [d.categoryId ?? null, d.name ?? null, d.slug ?? null, d.description ?? null, d.imageUrl ?? null,
   ...(d.indicativeStartingPrice === undefined ? [] : [d.indicativeStartingPrice]),
   d.isFeatured === undefined ? null : (d.isFeatured ? 1 : 0), d.isActive === undefined ? null : (d.isActive ? 1 : 0), id]);

import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import * as repo from '../repositories/addresses.repository.js';

export const map = (a) => ({
  id: a.id, label: a.label, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postal_code, country: a.country,
  latitude: a.latitude === null ? null : Number(a.latitude), longitude: a.longitude === null ? null : Number(a.longitude), isDefault: !!a.is_default,
});
export async function list(userId) { return (await repo.listByUser(pool, userId)).map(map); }
export async function create(userId, d) {
  const id = await withTransaction(async (conn) => {
    const first = (await repo.countByUser(conn, userId)) === 0;
    const makeDefault = d.isDefault || first;
    if (makeDefault) await repo.clearDefault(conn, userId);
    return repo.insert(conn, userId, { ...d, isDefault: makeDefault });
  });
  return map(await repo.findOwned(pool, id, userId));
}
export async function update(userId, id, d) {
  await withTransaction(async (conn) => {
    const cur = await repo.findOwned(conn, id, userId, true);
    if (!cur) throw AppError.notFound('Address not found');
    const merged = { ...map(cur), ...d, isDefault: d.isDefault ?? !!cur.is_default };
    if (merged.isDefault) await repo.clearDefault(conn, userId);
    await repo.update(conn, id, merged);
  });
  return map(await repo.findOwned(pool, id, userId));
}
export async function remove(userId, id) {
  await withTransaction(async (conn) => {
    const cur = await repo.findOwned(conn, id, userId, true);
    if (!cur) throw AppError.notFound('Address not found');
    if ((await repo.bookingCount(conn, id)) > 0) throw AppError.conflict('This address is used by existing bookings and cannot be deleted', 'ADDRESS_IN_USE');
    await repo.remove(conn, id);
    if (cur.is_default) await repo.pickNewDefault(conn, userId);
  });
  return { deleted: true };
}
export async function setDefault(userId, id) {
  await withTransaction(async (conn) => {
    if (!(await repo.findOwned(conn, id, userId, true))) throw AppError.notFound('Address not found');
    await repo.clearDefault(conn, userId); await repo.setDefault(conn, id);
  });
  return map(await repo.findOwned(pool, id, userId));
}

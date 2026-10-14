import { exec } from '../db/pool.js';

export async function audit(db, actor, action, entityType, entityId = null, details = null, ip = null) {
  await exec(db, `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?,?)`,
    [actor?.id ?? null, actor?.role ?? null, action, entityType, entityId, details ? JSON.stringify(details) : null, ip]);
}

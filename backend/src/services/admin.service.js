import { pool, query, queryOne, exec } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { toCsv } from '../utils/csv.js';
import { paging, pageMeta } from '../utils/pagination.js';
import { audit } from './audit.service.js';

/** REVENUE DEFINITION: sum of payments with status SUCCESS. PENDING/FAILED attempts are never counted. All amounts are SIMULATED. */
export async function dashboard() {
  const one = async (sql, p = []) => Object.values(await queryOne(pool, sql, p))[0];
  const byStatus = await query(pool, 'SELECT status, COUNT(*) AS count FROM bookings GROUP BY status');
  const pay = await queryOne(pool, `SELECT COUNT(*) AS records, SUM(status='SUCCESS') AS successful, SUM(status='FAILED') AS failed,
    COALESCE(SUM(CASE WHEN status='SUCCESS' THEN amount END),0) AS collected FROM payments`);
  return {
    totalUsers: await one('SELECT COUNT(*) FROM users'),
    activeCustomers: await one("SELECT COUNT(*) FROM users WHERE role='CUSTOMER' AND status='ACTIVE'"),
    approvedTechnicians: await one("SELECT COUNT(*) FROM technician_profiles p JOIN users u ON u.id=p.user_id WHERE p.approval_status='APPROVED' AND p.is_active=1 AND u.status='ACTIVE'"),
    pendingApplications: await one("SELECT COUNT(*) FROM technician_applications WHERE status='SUBMITTED'"),
    totalBookings: await one('SELECT COUNT(*) FROM bookings'),
    bookingsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
    quotationsAwaitingDecision: await one("SELECT COUNT(*) FROM quotations WHERE status='PENDING' AND is_current=1"),
    completedBookings: await one("SELECT COUNT(*) FROM bookings WHERE status='COMPLETED'"),
    payments: { records: pay.records, successful: Number(pay.successful ?? 0), failed: Number(pay.failed ?? 0), simulatedCollectedTotal: pay.collected },
    revenueDefinition: 'Sum of SUCCESSFUL simulated payments. Pending or failed transactions are excluded. No real money is involved.',
    isSimulated: true,
  };
}

const D = /^\d{4}-\d{2}-\d{2}$/;
export function range({ from, to }) {
  const t = to && D.test(to) ? to : new Date().toISOString().slice(0, 10);
  const f = from && D.test(from) ? from : new Date(Date.parse(`${t}T00:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  if (f > t) throw AppError.badRequest('"from" must not be after "to"');
  return { from: f, to: t };
}

const REPORTS = {
  'booking-volume': {
    columns: [{ key: 'date', label: 'Date (UTC)' }, { key: 'status', label: 'Status' }, { key: 'bookings', label: 'Bookings' }],
    run: (r) => query(pool, `SELECT DATE(created_at) AS date, status, COUNT(*) AS bookings FROM bookings WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at), status ORDER BY date, status`, [r.from, r.to]),
  },
  'service-demand': {
    columns: [{ key: 'category', label: 'Category' }, { key: 'service', label: 'Service' }, { key: 'bookings', label: 'Bookings' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }],
    run: (r) => query(pool, `SELECT c.name AS category, s.name AS service, COUNT(b.id) AS bookings, COALESCE(SUM(b.status='COMPLETED'),0) AS completed, COALESCE(SUM(b.status='CANCELLED'),0) AS cancelled
      FROM bookings b JOIN services s ON s.id=b.service_id JOIN service_categories c ON c.id=s.category_id WHERE DATE(b.created_at) BETWEEN ? AND ? GROUP BY c.name, s.name ORDER BY bookings DESC, service`, [r.from, r.to]),
  },
  'technician-workload': {
    columns: [{ key: 'technician', label: 'Technician' }, { key: 'assigned', label: 'Total assigned' }, { key: 'open', label: 'Open' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }],
    run: (r) => query(pool, `SELECT u.full_name AS technician, COUNT(b.id) AS assigned, COALESCE(SUM(b.status NOT IN ('COMPLETED','CANCELLED')),0) AS open,
      COALESCE(SUM(b.status='COMPLETED'),0) AS completed, COALESCE(SUM(b.status='CANCELLED'),0) AS cancelled
      FROM bookings b JOIN technician_profiles p ON p.id=b.technician_id JOIN users u ON u.id=p.user_id WHERE DATE(b.created_at) BETWEEN ? AND ? GROUP BY u.id, u.full_name ORDER BY assigned DESC`, [r.from, r.to]),
  },
  'completed-cancelled': {
    columns: [{ key: 'outcome', label: 'Outcome' }, { key: 'bookings', label: 'Bookings' }, { key: 'percentOfAll', label: '% of bookings in range' }],
    run: async (r) => {
      const t = await queryOne(pool, 'SELECT COUNT(*) c FROM bookings WHERE DATE(created_at) BETWEEN ? AND ?', [r.from, r.to]);
      const rows = await query(pool, `SELECT status AS outcome, COUNT(*) AS bookings FROM bookings WHERE DATE(created_at) BETWEEN ? AND ? AND status IN ('COMPLETED','CANCELLED') GROUP BY status`, [r.from, r.to]);
      return rows.map((x) => ({ ...x, percentOfAll: t.c ? ((x.bookings / t.c) * 100).toFixed(2) : '0.00' }));
    },
  },
  'quotation-rates': {
    columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }],
    run: async (r) => {
      const x = await queryOne(pool, `SELECT COUNT(*) total, COALESCE(SUM(status='APPROVED'),0) approved, COALESCE(SUM(status='REJECTED'),0) rejected, COALESCE(SUM(status='PENDING'),0) pending,
        COALESCE(SUM(status='SUPERSEDED'),0) superseded, COALESCE(SUM(status='WITHDRAWN'),0) withdrawn FROM quotations WHERE DATE(created_at) BETWEEN ? AND ?`, [r.from, r.to]);
      const decided = Number(x.approved) + Number(x.rejected);
      const pct = (n) => (decided ? ((Number(n) / decided) * 100).toFixed(2) : '0.00');
      return [
        { metric: 'Quotation versions created', value: x.total }, { metric: 'Approved', value: x.approved }, { metric: 'Rejected', value: x.rejected },
        { metric: 'Awaiting decision', value: x.pending }, { metric: 'Superseded by revision', value: x.superseded }, { metric: 'Withdrawn (booking cancelled)', value: x.withdrawn },
        { metric: 'Approval rate (% of decided)', value: pct(x.approved) }, { metric: 'Rejection rate (% of decided)', value: pct(x.rejected) },
      ];
    },
  },
  'payments-summary': {
    columns: [{ key: 'date', label: 'Date (UTC)' }, { key: 'successful', label: 'Successful (simulated)' }, { key: 'failed', label: 'Failed (simulated)' }, { key: 'collected', label: 'Collected total (simulated)' }],
    run: (r) => query(pool, `SELECT DATE(created_at) AS date, COALESCE(SUM(status='SUCCESS'),0) AS successful, COALESCE(SUM(status='FAILED'),0) AS failed,
      COALESCE(SUM(CASE WHEN status='SUCCESS' THEN amount END),0) AS collected FROM payments WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY date`, [r.from, r.to]),
  },
};
export const REPORT_TYPES = Object.keys(REPORTS);

export async function report(type, q) {
  const def = REPORTS[type];
  if (!def) throw AppError.notFound('Unknown report');
  const r = range(q);
  const rows = await def.run(r);
  return { type, ...r, timezone: 'UTC', columns: def.columns, rows, isSimulated: type === 'payments-summary' };
}
export async function reportCsv(type, q) {
  const rep = await report(type, q);
  return { filename: `fixnow-${type}-${rep.from}_${rep.to}.csv`, csv: toCsv(rep.columns, rep.rows) };
}

export async function getSettings() {
  return (await query(pool, 'SELECT setting_key AS `key`, setting_value AS value, description, updated_at AS updatedAt FROM system_settings ORDER BY setting_key'));
}
const SETTING_RULES = {
  platform_name: (v) => v.length >= 2 && v.length <= 60,
  default_tax_rate: (v) => /^\d{1,2}(\.\d{1,2})?$/.test(v) && Number(v) <= 30,
  quotation_validity_days: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 90,
  support_email: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 190,
  currency: (v) => /^[A-Z]{3}$/.test(v),
};
export async function updateSettings(actor, values, ip) {
  for (const [k, v] of Object.entries(values)) {
    if (!SETTING_RULES[k]) throw AppError.badRequest(`Unknown setting: ${k}`);
    if (!SETTING_RULES[k](String(v))) throw AppError.badRequest(`Invalid value for ${k}`);
  }
  for (const [k, v] of Object.entries(values)) await exec(pool, 'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?', [String(v), actor.id, k]);
  await audit(pool, actor, 'SETTINGS_UPDATED', 'system_settings', null, values, ip);
  return getSettings();
}
export async function publicSettings() {
  const rows = await query(pool, "SELECT setting_key AS `key`, setting_value AS value FROM system_settings WHERE setting_key IN ('platform_name','support_email','currency','quotation_validity_days','default_tax_rate')");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export async function auditLogs({ page, pageSize, action, entityType }) {
  const where = [], params = [];
  if (action) { where.push('a.action = ?'); params.push(action); }
  if (entityType) { where.push('a.entity_type = ?'); params.push(entityType); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(pool, `SELECT COUNT(*) c FROM audit_logs a ${w}`, params)).c;
  const { limit, offset } = paging({ page, pageSize });
  const rows = await query(pool, `SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.details, a.actor_role AS actorRole, u.full_name AS actorName, a.created_at AS createdAt
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, meta: pageMeta({ page, pageSize }, total) };
}

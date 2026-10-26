import crypto from 'node:crypto';
import pg from 'pg';
import { getDbPool } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import { sanitizeLogValue } from '../utils/sanitizer.js';

export interface AuditLogEntry {
  actorType: 'STAFF' | 'CUSTOMER' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  outletId?: string | null;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  requestId: string;
  ipAddress?: string | null;
}

function toValidUuid(val: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(val)) return val;
  const hash = crypto.createHash('md5').update(val).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Recursively redacts sensitive credentials, PINs, card data, and OTPs
 * from an entity state object before persisting to audit_logs.
 */
export function sanitizeAuditState(state: unknown): unknown {
  return sanitizeLogValue(state);
}

/**
 * Centralized audit writer for canonical Table 57 (audit_logs).
 * Supports both standalone execution and existing transaction participation.
 *
 * @param entry The audit entry data to persist
 * @param client Optional PoolClient if writing inside an existing parent transaction
 */
export async function writeAuditLog(
  entry: AuditLogEntry,
  client?: pg.PoolClient
): Promise<string> {
  const queryRunner = client || getDbPool();

  const sanitizedOld = entry.oldState ? JSON.stringify(sanitizeAuditState(entry.oldState)) : null;
  const sanitizedNew = entry.newState ? JSON.stringify(sanitizeAuditState(entry.newState)) : null;
  const validEntityId = toValidUuid(entry.entityId);

  try {
    const query = `
      INSERT INTO public.audit_logs (
        actor_type, actor_id, action, entity_type, entity_id,
        outlet_id, old_state, new_state, request_id, ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id;
    `;

    const values = [
      entry.actorType,
      entry.actorId || null,
      entry.action,
      entry.entityType,
      validEntityId,
      entry.outletId || null,
      sanitizedOld,
      sanitizedNew,
      entry.requestId,
      entry.ipAddress || null
    ];

    const result = await queryRunner.query(query, values);
    return result.rows[0].id;
  } catch (err) {
    logger.error('Failed to write audit log entry', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error: (err as Error).message
    });
    throw err;
  }
}

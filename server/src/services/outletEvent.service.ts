import pg from 'pg';
import { getDbPool } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import { sanitizeLogValue } from '../utils/sanitizer.js';

export interface OutletEventEntry {
  outletId: string;
  channel: string;
  eventType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export interface PublishedOutletEvent {
  sequenceNumber: string;
  outletId: string;
  channel: string;
  eventType: string;
  entityId: string;
  createdAt: Date;
}

/**
 * Publishes an event to the canonical Table 56 (outlet_event_log).
 *
 * TRANSACTIONAL PATTERN (Section 10):
 * If a parent business transaction exists, pass its `client` so that the event
 * is persisted in the SAME transaction as the domain mutation.
 * This prevents ghost events if the business transaction rolls back.
 */
export async function publishOutletEvent(
  entry: OutletEventEntry,
  client?: pg.PoolClient
): Promise<PublishedOutletEvent> {
  const queryRunner = client || getDbPool();
  const sanitizedPayload = JSON.stringify(sanitizeLogValue(entry.payload));

  try {
    const query = `
      INSERT INTO public.outlet_event_log (
        outlet_id, channel, event_type, entity_id, payload
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING sequence_number, outlet_id, channel, event_type, entity_id, created_at;
    `;

    const values = [
      entry.outletId,
      entry.channel,
      entry.eventType,
      entry.entityId,
      sanitizedPayload
    ];

    const result = await queryRunner.query(query, values);
    const row = result.rows[0];

    return {
      sequenceNumber: row.sequence_number.toString(),
      outletId: row.outlet_id,
      channel: row.channel,
      eventType: row.event_type,
      entityId: row.entity_id,
      createdAt: row.created_at
    };
  } catch (err) {
    logger.error('Failed to publish outlet event', {
      outletId: entry.outletId,
      channel: entry.channel,
      eventType: entry.eventType,
      error: (err as Error).message
    });
    throw err;
  }
}

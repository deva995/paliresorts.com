import pg from 'pg';
import { getDbPool } from '../db/pool.js';
import { databaseGuestSessionId, runtimeContextEnabled } from '../db/runtimeContext.js';
import { computeRequestHash } from '../utils/hashing.js';
import { ConflictError, AppError } from '../utils/errors.js';

export interface IdempotencyAcquireParams {
  idempotencyKey: string;
  operationType: string;
  outletId?: string | null;
  actorStaffId?: string | null;
  payload: unknown;
  ttlSeconds?: number;
  lockTimeoutSeconds?: number;
}

export type IdempotencyAcquireResult =
  | { status: 'ACQUIRED'; keyId: string }
  | { status: 'REPLAY'; statusCode: number; body: unknown };

export class IdempotencyConflictError extends AppError {
  constructor(message: string) {
    super(422, message, 'IDEMPOTENCY_CONFLICT', true);
  }
}

export class IdempotencyInFlightError extends AppError {
  constructor(message = 'A request with this idempotency key is currently being processed') {
    super(409, message, 'IDEMPOTENCY_IN_FLIGHT', true);
  }
}

/**
 * Service managing central idempotency keys in public.idempotency_keys (Table 55).
 * Uses UNIQUE(operation_type, idempotency_key) for database-level concurrency protection.
 */
export class IdempotencyService {
  /**
   * Atomically acquires an idempotency key or checks its current execution status.
   */
  static async acquireOrCheck(
    params: IdempotencyAcquireParams,
    client?: pg.PoolClient,
    attempt = 0
  ): Promise<IdempotencyAcquireResult> {
    const queryRunner = client || getDbPool();
    const requestHash = computeRequestHash(params.payload);

    const ttlSeconds = params.ttlSeconds ?? 86400; // 24 hours
    const lockTimeoutSeconds = params.lockTimeoutSeconds ?? 60; // 60 seconds

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const lockedUntil = new Date(now.getTime() + lockTimeoutSeconds * 1000);

    // 1. Atomic insertion attempt
    const insertQuery = `
      INSERT INTO public.idempotency_keys (
        idempotency_key, operation_type, outlet_id, actor_staff_id,
        request_hash, status, locked_until, expires_at${runtimeContextEnabled() ? ', runtime_guest_session_id' : ''}
      )
      VALUES ($1, $2, $3, $4, $5, 'LOCKED', $6, $7${runtimeContextEnabled() ? ', $8' : ''})
      ON CONFLICT (operation_type, idempotency_key) DO NOTHING
      RETURNING id, status, request_hash, response_status, response_body, expires_at, locked_until;
    `;

    const insertValues = [
      params.idempotencyKey,
      params.operationType,
      params.outletId || null,
      params.actorStaffId || null,
      requestHash,
      lockedUntil,
      expiresAt
    ];
    if (runtimeContextEnabled()) insertValues.push(databaseGuestSessionId() as any);

    const insertResult = await queryRunner.query(insertQuery, insertValues);

    // If inserted, lock is successfully acquired
    if (insertResult.rows.length > 0) {
      return {
        status: 'ACQUIRED',
        keyId: insertResult.rows[0].id
      };
    }

    // 2. Row exists; fetch existing record for verification
    const selectQuery = `
      SELECT id, status, request_hash, response_status, response_body, expires_at, locked_until
      FROM public.idempotency_keys
      WHERE operation_type = $1 AND idempotency_key = $2;
    `;

    const selectResult = await queryRunner.query(selectQuery, [
      params.operationType,
      params.idempotencyKey
    ]);

    if (selectResult.rows.length === 0) {
      // Race edge case: record deleted concurrently; re-acquire with attempt cap
      if (attempt >= 2) {
        throw new IdempotencyConflictError('Idempotency key is unavailable in this authorization scope');
      }
      return this.acquireOrCheck(params, client, attempt + 1);
    }

    const existing = selectResult.rows[0];

    // Check if expired
    if (new Date(existing.expires_at) < now) {
      // Overwrite expired key with new lock
      const refreshQuery = `
        UPDATE public.idempotency_keys
        SET request_hash = $3,
            status = 'LOCKED',
            outlet_id = $4,
            actor_staff_id = $5,
            response_status = NULL,
            response_body = NULL,
            locked_until = $6,
            expires_at = $7,
            updated_at = CURRENT_TIMESTAMP${runtimeContextEnabled() ? ', runtime_guest_session_id = $8' : ''}
        WHERE id = $1 AND expires_at < $2
        RETURNING id;
      `;
      const refreshValues: unknown[] = [
        existing.id,
        now,
        requestHash,
        params.outletId || null,
        params.actorStaffId || null,
        lockedUntil,
        expiresAt
      ];
      if (runtimeContextEnabled()) refreshValues.push(databaseGuestSessionId());
      const refreshResult = await queryRunner.query(refreshQuery, refreshValues);

      if (refreshResult.rows.length > 0) {
        return { status: 'ACQUIRED', keyId: refreshResult.rows[0].id };
      }
    }

    // Check payload hash match
    if (existing.request_hash !== requestHash) {
      throw new IdempotencyConflictError(
        `Idempotency key '${params.idempotencyKey}' was previously submitted with a different request payload.`
      );
    }

    // Completed request -> replay cached response
    if (existing.status === 'COMPLETED') {
      return {
        status: 'REPLAY',
        statusCode: existing.response_status ?? 200,
        body: existing.response_body
      };
    }

    // Currently locked request -> check if lock is active
    if (existing.status === 'LOCKED') {
      if (existing.locked_until && new Date(existing.locked_until) > now) {
        throw new IdempotencyInFlightError();
      }

      // Lock expired without completion; reclaim lock
      const reclaimQuery = `
        UPDATE public.idempotency_keys
        SET locked_until = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'LOCKED'
        RETURNING id;
      `;
      const reclaimResult = await queryRunner.query(reclaimQuery, [existing.id, lockedUntil]);
      if (reclaimResult.rows.length > 0) {
        return { status: 'ACQUIRED', keyId: existing.id };
      }
    }

    // Default error if in FAILED state or unhandled status
    throw new ConflictError(
      `Idempotency key '${params.idempotencyKey}' ended in status '${existing.status}'.`
    );
  }

  /**
   * Marks the idempotency key as COMPLETED and stores the cached response.
   */
  static async complete(
    keyId: string,
    statusCode: number,
    responseBody: unknown,
    resourceType?: string,
    resourceId?: string,
    client?: pg.PoolClient
  ): Promise<void> {
    const queryRunner = client || getDbPool();

    const query = `
      UPDATE public.idempotency_keys
      SET status = 'COMPLETED',
          response_status = $2,
          response_body = $3,
          resource_type = $4,
          resource_id = $5,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;

    await queryRunner.query(query, [
      keyId,
      statusCode,
      JSON.stringify(responseBody),
      resourceType || null,
      resourceId || null
    ]);
  }

  /**
   * Marks the idempotency key as FAILED on unexpected business or execution error.
   */
  static async fail(keyId: string, client?: pg.PoolClient): Promise<void> {
    const queryRunner = client || getDbPool();

    const query = `
      UPDATE public.idempotency_keys
      SET status = 'FAILED',
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;

    await queryRunner.query(query, [keyId]);
  }
}

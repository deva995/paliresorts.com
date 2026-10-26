import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import crypto from 'crypto';
import { encryptQrSecret, decryptQrSecret } from '../../utils/qrEncryption.js';
import pg from 'pg';
import { getDbPool, withTransaction } from '../../db/pool.js';
import { runtimeContextEnabled } from '../../db/runtimeContext.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  RateLimitError
} from '../../utils/errors.js';
import { getEnv } from '../../config/env.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { publishOutletEvent } from '../../services/outletEvent.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import { getSmsTransport } from '../../services/sms.service.js';
import { maskPhoneNumber } from '../../utils/sanitizer.js';
import {
  FloorTable,
  TableDetailResponse,
  DiningSessionDetailResponse,
  ServiceRequestResponse,
  ServiceRequestType,
  QrResolveResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  GuestSessionSummaryResponse
} from './dining.types.js';
import { AuthenticatedGuestContext } from '../../middleware/guestAuth.js';
import { AuthenticatedStaffContext } from '../../middleware/auth.js';

// In-memory rate limiting map for OTP requests per phone: cleanPhone -> Array of request timestamps
const otpPhoneRequests = new Map<string, number[]>();

export function clearOtpPhoneRateLimits() {
  otpPhoneRequests.clear();
}

/**
 * Placeholder SMS delivery function.
 * In development or testing with an in-memory test transport, delivers OTP to capture it for assertions;
 * otherwise throws "SMS provider not configured".
 */
export async function sendOtpSms(phone: string, otp: string): Promise<boolean> {
  const transport = getSmsTransport();
  if (process.env.NODE_ENV === 'test' && transport && typeof transport.sendOtp === 'function') {
    return await transport.sendOtp(phone, otp);
  }
  throw new Error('SMS provider not configured');
}

export class DiningService {
  /** Public QR proof is validated again inside the atomic database operation. */
  static async selfSeatFromQr(input: { qrPublicCode: string; qrSecretToken: string; guestCount: number }) {
    const rawToken = 'gst_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    let result;
    try {
      result = await getDbPool().query(
        `SELECT * FROM pali_runtime.qr_self_seat($1,$2,$3,$4)`,
        [input.qrPublicCode, input.qrSecretToken, tokenHash, input.guestCount]
      );
    } catch (error: unknown) {
      const dbError = error as { code?: string; message?: string };

      if (dbError.code === '42501' &&
          dbError.message === 'Invalid table QR credential') {
        throw new ForbiddenError('Invalid table QR credential');
      }

      if (dbError.code === '23505') {
        throw new ConflictError('This table already has an active dining session');
      }

      throw error;
    }
    const row = result.rows[0];
    if (!row) throw new ConflictError('Unable to start a dining session');
    return {
      token: rawToken, tokenType: 'Bearer', expiresInSeconds: 21600,
      sessionId: row.session_id, tableId: row.table_id,
      outletId: row.outlet_id, tableNumber: row.table_number,
      openedAt: new Date(row.opened_at).toISOString()
    };
  }
  /**
   * Retrieves floor tables for an outlet from the safe restaurant_floor_view.
   * Completely excludes QR hashes and staff identifiers.
   */
  /**
   * Retrieve an existing secure QR credential for authorized reprinting.
   * Never rotate a QR during retrieval.
   */
  static async getOrderingQr(tableId: string) {
    const result = await getDbPool().query(
      `SELECT t.qr_public_code, t.qr_secret_token_hash,
              c.encrypted_secret
       FROM public.restaurant_tables t
       JOIN public.table_qr_credentials c
         ON c.table_id = t.id AND c.outlet_id = t.outlet_id
       JOIN public.outlets o ON o.id = t.outlet_id
       WHERE t.id = $1 AND t.is_active = true AND o.is_active = true`,
      [tableId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundError('Secure QR credential unavailable for this table');
    }

    const secret = decryptQrSecret(row.encrypted_secret);
    const actualHash = crypto.createHash('sha256').update(secret).digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(actualHash, 'hex'),
        Buffer.from(row.qr_secret_token_hash, 'hex')
      )
    ) {
      throw new ConflictError('Stored QR credential does not match the active table QR');
    }

    return {
      qrPublicCode: row.qr_public_code,
      qrSecretToken: secret
    };
  }

  static async issueOrderingQr(tableId:string,actorId:string,requestId:string) {
    return withTransaction(async client=>{
      const row=(await client.query(`SELECT t.id,t.outlet_id,t.qr_public_code,t.is_active,o.is_active AS outlet_active
        FROM restaurant_tables t JOIN outlets o ON o.id=t.outlet_id WHERE t.id=$1 FOR UPDATE OF t`,[tableId])).rows[0];
      if(!row) throw new NotFoundError('Restaurant table');
      if(!row.outlet_active) throw new ConflictError('Outlet is inactive');

      // Preserve existing credentials when preparing inactive tables.
      if (!row.is_active) {
        const existing = (await client.query(
          `SELECT encrypted_secret
           FROM public.table_qr_credentials
           WHERE table_id=$1 AND outlet_id=$2
           FOR UPDATE`,
          [tableId, row.outlet_id]
        )).rows[0];

        if (existing) {
          const secret = decryptQrSecret(existing.encrypted_secret);
          const hash = crypto.createHash('sha256')
            .update(secret).digest('hex');

          const saved = (await client.query(
            `SELECT qr_secret_token_hash
             FROM public.restaurant_tables WHERE id=$1`,
            [tableId]
          )).rows[0];

          if (hash !== saved?.qr_secret_token_hash) {
            throw new ConflictError('Existing QR credential mismatch');
          }

          return {
            qrPublicCode: row.qr_public_code,
            qrSecretToken: secret
          };
        }
      }

// Authorized QR preparation is permitted for inactive tables.
// QR issuance does not activate a table or change its operational status.
      const secret=crypto.randomBytes(32).toString('hex');
      await client.query('UPDATE restaurant_tables SET qr_secret_token_hash=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[tableId,crypto.createHash('sha256').update(secret).digest('hex')]);

      // Store the replacement credential atomically with its verification hash.
      await client.query(
        `INSERT INTO public.table_qr_credentials
           (table_id, outlet_id, encrypted_secret)
         VALUES ($1, $2, $3)
         ON CONFLICT (table_id)
         DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret,
                       updated_at = CURRENT_TIMESTAMP`,
        [tableId, row.outlet_id, encryptQrSecret(secret)]
      );

      await writeAuditLog({actorType:'STAFF',actorId,action:'TABLE_QR_ISSUED',entityType:'RESTAURANT_TABLE',entityId:tableId,outletId:row.outlet_id,requestId,newState:{rotated:true}},client);
      return {qrPublicCode:row.qr_public_code,qrSecretToken:secret};
    });
  }

  static async getOutletFloorStaff(outletId: string) {
    return (await getDbPool().query(`SELECT DISTINCT s.id, s.first_name || ' ' || s.last_name AS name
      FROM public.staff s JOIN public.staff_outlet_access soa ON soa.staff_id=s.id
      JOIN public.staff_roles sr ON sr.staff_id=s.id WHERE soa.outlet_id=$1 AND s.is_active=true
      AND sr.role_id IN ('WAITER','WAITER_MANAGER','SENIOR_CAPTAIN','RESTAURANT_MANAGER') ORDER BY name,s.id`,[outletId])).rows;
  }

  static async createOutletZone(
    outletId: string,
    data: { name: string; code: string; displayOrder: number },
    actorStaffId: string,
    requestId?: string
  ) {
    return withTransaction(async (client) => {
      const outlet = await client.query(
        'SELECT id, is_active FROM public.outlets WHERE id=$1 FOR SHARE',
        [outletId]
      );

      if (!outlet.rows.length) throw new NotFoundError('Restaurant not found');
      if (!outlet.rows[0].is_active) throw new ForbiddenError('Restaurant is inactive');

      const name = data.name.trim();
      const code = data.code.trim().toUpperCase();

      const duplicate = await client.query(
        `SELECT id FROM public.dining_zones
         WHERE outlet_id=$1
           AND (lower(name)=lower($2) OR lower(code)=lower($3))
         LIMIT 1`,
        [outletId, name, code]
      );

      if (duplicate.rows.length) {
        throw new ConflictError('Dining area name or code already exists');
      }

      const created = await client.query(
        `INSERT INTO public.dining_zones
           (outlet_id, name, code, display_order, is_active)
         VALUES ($1,$2,$3,$4,true)
         RETURNING id, outlet_id AS "outletId", name, code,
                   display_order AS "displayOrder", is_active AS "isActive"`,
        [outletId, name, code, data.displayOrder]
      );

      const zone = created.rows[0];

      await writeAuditLog({
        actorType: 'STAFF',
        actorId: actorStaffId,
        outletId,
        action: 'DINING_ZONE_CREATED',
        entityType: 'DINING_ZONE',
        entityId: zone.id,
        newState: { name, code, displayOrder: data.displayOrder },
        requestId: requestId || 'unknown'
      }, client);

      return zone;
    }).catch((error: any) => {
      if (error.code === '23505') {
        throw new ConflictError('Dining area code already exists');
      }
      throw error;
    });
  }

  static async getOutletZones(outletId: string) {
    return (await getDbPool().query('SELECT id,outlet_id AS "outletId",name,code FROM public.dining_zones WHERE outlet_id=$1 AND is_active=true ORDER BY display_order,name,id',[outletId])).rows;
  }

  static async getOutletTables(outletId: string): Promise<FloorTable[]> {
    const pool = getDbPool();

    // Verify outlet existence & active status
    const outletRes = await pool.query(
      'SELECT id, name, is_active FROM public.outlets WHERE id = $1',
      [outletId]
    );
    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet '${outletId}'`);
    }
    if (!outletRes.rows[0].is_active) {
      throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
    }

    const query = `
      SELECT 
        v.table_id,
        v.outlet_id,
        v.dining_zone_id,
        v.zone_name,
        v.zone_code,
        v.table_number,
        v.capacity,
        v.status,
        v.current_waiter_name,
        v.is_active,
        t.current_waiter_staff_id,
        t.active_dining_session_id,
        ds.guest_count AS active_guest_count
      FROM ${runtimeContextEnabled() ? 'pali_runtime' : 'public'}.restaurant_floor_view v
      LEFT JOIN public.restaurant_tables t ON t.id = v.table_id
      LEFT JOIN public.dining_sessions ds ON ds.id = t.active_dining_session_id AND ds.status IN ('ACTIVE','BILLED')
      WHERE v.outlet_id = $1
      ORDER BY v.table_number ASC;
    `;

    const result = await pool.query(query, [outletId]);

    return result.rows.map((row) => ({
      id: row.table_id,
      activeSessionId: row.active_dining_session_id || null,
      outletId: row.outlet_id,
      diningZoneId: row.dining_zone_id,
      zoneName: row.zone_name,
      zoneCode: row.zone_code,
      tableNumber: row.table_number,
      capacity: parseInt(row.capacity, 10),
      status: row.status,
      currentWaiterName: row.current_waiter_name,
      currentWaiterStaffId: row.current_waiter_staff_id || null,
      activeGuestCount: row.active_guest_count ? parseInt(row.active_guest_count, 10) : undefined,
      isActive: Boolean(row.is_active)
    }));
  }

  /**
   * Retrieves detailed table state including active session summary.
   */
  static async getTableById(tableId: string): Promise<TableDetailResponse> {
    const pool = getDbPool();

    const query = `
      SELECT 
        t.id, t.outlet_id, t.zone_id, t.table_number, t.capacity, t.status,
        t.current_waiter_staff_id, t.active_dining_session_id, t.is_active,
        z.name AS zone_name, z.code AS zone_code,
        CASE WHEN s.id IS NOT NULL THEN s.first_name || ' ' || s.last_name ELSE NULL END AS current_waiter_name,
        ds.guest_count AS active_guest_count,
        ds.status AS active_session_status,
        ds.opened_at AS active_session_opened_at,
        c.name AS customer_name
      FROM public.restaurant_tables t
      JOIN public.dining_zones z ON z.id = t.zone_id
      LEFT JOIN public.staff s ON s.id = t.current_waiter_staff_id
      LEFT JOIN public.dining_sessions ds ON ds.id = t.active_dining_session_id
      LEFT JOIN public.customers c ON c.id = ds.customer_id
      WHERE t.id = $1;
    `;

    const res = await pool.query(query, [tableId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Restaurant table '${tableId}'`);
    }

    const row = res.rows[0];

    const activeSession = row.active_dining_session_id
      ? {
          id: row.active_dining_session_id,
          guestCount: parseInt(row.active_guest_count, 10),
          status: row.active_session_status,
          openedAt: row.active_session_opened_at.toISOString
            ? row.active_session_opened_at.toISOString()
            : String(row.active_session_opened_at),
          customerName: row.customer_name
        }
      : null;

    return {
      id: row.id,
      outletId: row.outlet_id,
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      zoneCode: row.zone_code,
      tableNumber: row.table_number,
      capacity: parseInt(row.capacity, 10),
      status: row.status,
      currentWaiterStaffId: row.current_waiter_staff_id,
      currentWaiterName: row.current_waiter_name,
      activeSessionId: row.active_dining_session_id,
      activeSession,
      isActive: Boolean(row.is_active)
    };
  }

  /**
   * Concurrency-safe table self-assignment or allocation.
   * Uses SELECT ... FOR UPDATE on public.restaurant_tables.
   * If a second waiter claims the same table, returns 409 Conflict.
   */
  static async assignTable(
    tableId: string,
    targetStaffId: string | null,
    actorStaffId: string,
    actorStaff?: AuthenticatedStaffContext
  ): Promise<{
    success: boolean;
    tableId: string;
    tableNumber: string;
    currentWaiterStaffId: string | null;
    currentWaiterName: string | null;
  }> {
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        `SELECT 
           t.id, t.outlet_id, t.table_number, t.capacity, t.status,
           t.current_waiter_staff_id, t.active_dining_session_id, t.is_active,
           s.first_name, s.last_name
         FROM public.restaurant_tables t
         LEFT JOIN public.staff s ON s.id = t.current_waiter_staff_id
         WHERE t.id = $1
         FOR UPDATE OF t`,
        [tableId]
      );

      if (selectRes.rows.length === 0) {
        throw new NotFoundError(`Restaurant table '${tableId}'`);
      }

      const table = selectRes.rows[0];

      if (actorStaff) checkStaffOutletAccess(actorStaff,table.outlet_id);

      if (!table.is_active) throw new ConflictError('Inactive tables cannot be assigned');
      const outlet = await client.query('SELECT is_active FROM public.outlets WHERE id=$1 FOR SHARE', [table.outlet_id]);
      if (!outlet.rows[0]?.is_active) throw new ConflictError('Outlet is inactive');
      const canManage = actorStaff?.roles.some(role => role.id === 'SUPER_ADMIN') || actorStaff?.permissions.includes('table:manage');
      if (targetStaffId === null && table.current_waiter_staff_id && table.current_waiter_staff_id !== actorStaffId && !canManage) {
        throw new ForbiddenError('Only the assigned waiter or a floor manager may release this table');
      }
      if (targetStaffId) {
        const eligible = await client.query(`SELECT s.id FROM public.staff s
          JOIN public.staff_outlet_access soa ON soa.staff_id=s.id
          WHERE s.id=$1 AND s.is_active=true AND soa.outlet_id=$2 FOR SHARE OF s, soa`, [targetStaffId,table.outlet_id]);
        if (!eligible.rows.length) throw new ForbiddenError('Target staff must be active and assigned to this outlet');
      }
      const existingWaiterId = table.current_waiter_staff_id;
      const existingWaiterName = table.first_name
        ? `${table.first_name} ${table.last_name || ''}`.trim()
        : 'another server';

      // Concurrency check: If claiming (not unassigning) and already assigned to another staff member
      if (targetStaffId !== null && existingWaiterId && existingWaiterId !== targetStaffId) {
        throw new ConflictError(
          `Table ${table.table_number} is already assigned to ${existingWaiterName}. Only unassigned tables can be claimed.`
        );
      }

      // Resolve new waiter name if assigning
      let newWaiterName: string | null = null;
      if (targetStaffId) {
        if (targetStaffId === existingWaiterId) {
          newWaiterName = existingWaiterName;
        } else {
          const staffRes = await client.query(
            'SELECT first_name, last_name FROM public.staff WHERE id = $1',
            [targetStaffId]
          );
          if (staffRes.rows.length === 0) {
            throw new NotFoundError(`Staff '${targetStaffId}'`);
          }
          newWaiterName = `${staffRes.rows[0].first_name} ${staffRes.rows[0].last_name || ''}`.trim();
        }
      }

      // Update table
      await client.query(
        `UPDATE public.restaurant_tables
         SET current_waiter_staff_id = $2,
             assigned_at = CASE WHEN $2::uuid IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [tableId, targetStaffId]
      );

      // Audit assignment history
      if (targetStaffId !== existingWaiterId) {
        if (existingWaiterId) {
          await client.query(
            `UPDATE public.table_assignment_history
             SET released_at = CURRENT_TIMESTAMP
             WHERE table_id = $1 AND waiter_staff_id = $2 AND released_at IS NULL`,
            [tableId, existingWaiterId]
          );
        }

        if (targetStaffId) {
          await client.query(
            `INSERT INTO public.table_assignment_history (
               table_id, dining_session_id, waiter_staff_id, assigned_by_staff_id, assigned_at
             ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [tableId, table.active_dining_session_id || null, targetStaffId, actorStaffId]
          );
        }
      }

      await writeAuditLog({actorType:'STAFF',actorId:actorStaffId,outletId:table.outlet_id,
        requestId:'unknown',action:'TABLE_ASSIGNMENT_CHANGED',entityType:'RESTAURANT_TABLE',entityId:tableId,
        oldState:{waiterStaffId:existingWaiterId},newState:{waiterStaffId:targetStaffId}},client);
      await publishOutletEvent({outletId:table.outlet_id,channel:'FLOOR',eventType:'TABLE_ASSIGNMENT_CHANGED',
        entityId:tableId,payload:{tableId,waiterStaffId:targetStaffId}},client);
      await client.query('COMMIT');

      return {
        success: true,
        tableId: table.id,
        tableNumber: table.table_number,
        currentWaiterStaffId: targetStaffId,
        currentWaiterName: newWaiterName
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Creates a new floor table in an outlet with canonical normalization,
   * unique collision checks, and cryptographic QR token generation.
   */
  static async createTable(
    outletId: string,
    data: {
      tableNumber: string;
      zoneId?: string;
      zoneName?: string;
      capacity?: number;
      status?: string;
      isActive?: boolean;
    },
    actorStaffId: string,
    requestId?: string
  ): Promise<FloorTable> {
    return withTransaction(async (pool) => {

      // Verify outlet existence
      const outletRes = await pool.query('SELECT id, is_active FROM public.outlets WHERE id = $1 FOR SHARE', [outletId]);
      if (outletRes.rows.length === 0) {
        throw new NotFoundError(`Outlet '${outletId}'`);
      }
      if (!outletRes.rows[0].is_active) {
        throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
      }

      // Canonical table number normalization (e.g. T-1 -> T-01)
      const rawNumber = data.tableNumber.trim();
      const tMatch = rawNumber.match(/^([a-zA-Z]+)[^a-zA-Z0-9]*0*([0-9]+)$/);
      const normalizedNumber = tMatch
        ? `${tMatch[1].toUpperCase()}-${String(parseInt(tMatch[2], 10)).padStart(2, '0')}`
        : rawNumber;

      // Resolve or verify dining zone
      let resolvedZoneId = data.zoneId;
      if (!resolvedZoneId && data.zoneName) {
        const zoneRes = await pool.query(
          'SELECT id FROM public.dining_zones WHERE outlet_id = $1 AND is_active=true AND (lower(name)=lower($2) OR lower(code)=lower($2))',
          [outletId, data.zoneName.trim()]
        );
        if (zoneRes.rows.length !== 1) throw new BadRequestError('Choose a unique active zone by its ID');
        if (zoneRes.rows.length > 0) {
          resolvedZoneId = zoneRes.rows[0].id;
        }
      }
      if (!resolvedZoneId) {
        const defaultZone = await pool.query(
          'SELECT id FROM public.dining_zones WHERE outlet_id = $1 AND is_active=true ORDER BY display_order ASC LIMIT 1',
          [outletId]
        );
        if (defaultZone.rows.length === 0) {
          throw new NotFoundError(`No active dining zones configured for outlet '${outletId}'`);
        }
        resolvedZoneId = defaultZone.rows[0].id;
      }

      // Verify zone belongs to outlet
      const zoneCheck = await pool.query(
        'SELECT id, name, code FROM public.dining_zones WHERE id = $1 AND outlet_id = $2 AND is_active=true FOR SHARE',
        [resolvedZoneId, outletId]
      );
      if (zoneCheck.rows.length === 0) {
        throw new BadRequestError(`Dining zone '${resolvedZoneId}' does not belong to outlet '${outletId}'`);
      }
      const zoneRow = zoneCheck.rows[0];

      // Check collision in this outlet
      const collisionCheck = await pool.query(
        'SELECT id FROM public.restaurant_tables WHERE outlet_id = $1 AND table_number = $2',
        [outletId, normalizedNumber]
      );
      if (collisionCheck.rows.length > 0) {
        throw new ConflictError(`Table '${normalizedNumber}' already exists in outlet '${outletId}'`);
      }

      // Generate canonical QR public code and secret token hash
      const cleanNum = normalizedNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const outletCode = outletId === 'rest-1' ? 'R1' : outletId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      let qrPublicCode = `PALI-${outletCode}-${cleanNum}`;

      // Ensure qrPublicCode is unique across resort
      const qrCheck = await pool.query('SELECT id FROM public.restaurant_tables WHERE qr_public_code = $1', [qrPublicCode]);
      if (qrCheck.rows.length > 0) {
        qrPublicCode = `PALI-${outletCode}-${cleanNum}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      }

      const rawSecret = crypto.randomBytes(32).toString('hex');
      const qrSecretTokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

      const capacity = data.capacity && data.capacity > 0 ? data.capacity : 4;
      if (data.status && ['OCCUPIED','BILLED'].includes(data.status)) throw new ConflictError('Occupancy is managed by dining sessions');
      const status = data.isActive === false ? 'OUT_OF_SERVICE' : (data.status || 'AVAILABLE');
      const isActive = data.isActive !== undefined ? data.isActive : true;

      const insertRes = await pool.query(`
        INSERT INTO public.restaurant_tables (
          outlet_id, zone_id, table_number, capacity, status,
          qr_public_code, qr_secret_token_hash, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, outlet_id, zone_id, table_number, capacity, status, is_active;
      `, [outletId, resolvedZoneId, normalizedNumber, capacity, status, qrPublicCode, qrSecretTokenHash, isActive]);

      const row = insertRes.rows[0];

      // Persist recoverable QR credential in restricted encrypted storage.
      // Both records commit or roll back together.
      await pool.query(
        `INSERT INTO public.table_qr_credentials
           (table_id, outlet_id, encrypted_secret)
         VALUES ($1, $2, $3)`,
        [row.id, outletId, encryptQrSecret(rawSecret)]
      );

      await writeAuditLog({
        actorType: 'STAFF',
        actorId: actorStaffId,
        outletId,
        action: 'TABLE_CREATED',
        entityType: 'RESTAURANT_TABLE',
        entityId: row.id,
        newState: {
          tableNumber: row.table_number,
          capacity: row.capacity,
          zoneId: row.zone_id,
          qrPublicCode
        },
        requestId: requestId || 'unknown'
      }, pool);

      await publishOutletEvent({
        outletId,
        channel: 'FLOOR',
        eventType: 'TABLE_CREATED',
        entityId: row.id,
        payload: {
          tableId: row.id,
          tableNumber: row.table_number,
          capacity: row.capacity,
          qrPublicCode
        }
      }, pool);

      return {
        id: row.id,
        outletId: row.outlet_id,
        diningZoneId: row.zone_id,
        zoneName: zoneRow.name,
        zoneCode: zoneRow.code,
        tableNumber: row.table_number,
        capacity: parseInt(row.capacity, 10),
        status: row.status,
        currentWaiterName: null,
        currentWaiterStaffId: null,
        isActive: Boolean(row.is_active)
      };
    }).catch((error: any) => {
      if (error.code === '23505') throw new ConflictError('Table number or QR identity already exists');
      throw error;
    });
  }

  /**
   * Updates an existing table, protecting active dining sessions from renumbering collisions.
   */
  static async updateTable(
    tableId: string,
    data: {
      tableNumber?: string;
      zoneId?: string;
      zoneName?: string;
      capacity?: number;
      status?: string;
      isActive?: boolean;
    },
    actorStaffId: string,
    requestId?: string
  ): Promise<FloorTable> {
    return withTransaction(async (pool) => {

      // Query existing table
      const tableRes = await pool.query(`
        SELECT
          t.id, t.outlet_id, t.zone_id, t.table_number, t.capacity, t.status,
          t.active_dining_session_id, t.current_waiter_staff_id, t.is_active,
          z.name AS zone_name, z.code AS zone_code,
          CASE WHEN s.id IS NOT NULL THEN s.first_name || ' ' || s.last_name ELSE NULL END AS current_waiter_name
        FROM public.restaurant_tables t
        JOIN public.dining_zones z ON z.id = t.zone_id
        LEFT JOIN public.staff s ON s.id = t.current_waiter_staff_id
        WHERE t.id = $1 FOR UPDATE OF t;
      `, [tableId]);

      if (tableRes.rows.length === 0) {
        throw new NotFoundError(`Restaurant table '${tableId}'`);
      }

      const table = tableRes.rows[0];

      const session = await pool.query("SELECT id,guest_count FROM public.dining_sessions WHERE table_id=$1 AND status IN ('ACTIVE','BILLED')",[tableId]);
      const hasSession = Boolean(table.active_dining_session_id || session.rows.length);
      if (hasSession && (data.isActive === false || (data.status && data.status !== table.status))) {
        throw new ConflictError('Active dining session owns table occupancy; close or cancel it first');
      }
      if (!hasSession && data.status && ['OCCUPIED','BILLED'].includes(data.status)) throw new ConflictError('Occupancy requires a dining session');
      if (hasSession && data.capacity !== undefined && session.rows.some(row => row.guest_count > data.capacity!)) throw new ConflictError('Capacity is below the active guest count');
      if (!table.is_active && data.isActive !== true && data.status && data.status !== 'OUT_OF_SERVICE') throw new ConflictError('Reactivate the table before changing its status');
      // Renumbering checks
      let newNumber = table.table_number;
      if (data.tableNumber && data.tableNumber.trim() !== '') {
        const rawNumber = data.tableNumber.trim();
        const tMatch = rawNumber.match(/^([a-zA-Z]+)[^a-zA-Z0-9]*0*([0-9]+)$/);
        newNumber = tMatch
          ? `${tMatch[1].toUpperCase()}-${String(parseInt(tMatch[2], 10)).padStart(2, '0')}`
          : rawNumber;

        if (newNumber !== table.table_number) {
          if (hasSession) {
            throw new ConflictError(
              `Cannot renumber table ${table.table_number} while a dining session is active (session ${table.active_dining_session_id})`
            );
          }

          const collision = await pool.query(
            'SELECT id FROM public.restaurant_tables WHERE outlet_id = $1 AND table_number = $2 AND id != $3',
            [table.outlet_id, newNumber, tableId]
          );
          if (collision.rows.length > 0) {
            throw new ConflictError(`Table '${newNumber}' already exists in outlet '${table.outlet_id}'`);
          }
        }
      }

      // Zone resolution
      let newZoneId = table.zone_id;
      let newZoneName = table.zone_name;
      let newZoneCode = table.zone_code;

      if (data.zoneId) {
        const zCheck = await pool.query(
          'SELECT id, name, code FROM public.dining_zones WHERE id = $1 AND outlet_id = $2 AND is_active=true FOR SHARE',
          [data.zoneId, table.outlet_id]
        );
        if (zCheck.rows.length === 0) {
          throw new BadRequestError(`Dining zone '${data.zoneId}' does not belong to outlet '${table.outlet_id}'`);
        }
        newZoneId = zCheck.rows[0].id;
        newZoneName = zCheck.rows[0].name;
        newZoneCode = zCheck.rows[0].code;
      } else if (data.zoneName && data.zoneName.trim() !== '' && data.zoneName !== table.zone_name) {
        const zCheck = await pool.query(
          'SELECT id, name, code FROM public.dining_zones WHERE outlet_id = $1 AND is_active=true AND (lower(name)=lower($2) OR lower(code)=lower($2))',
          [table.outlet_id, data.zoneName.trim()]
        );
        if (zCheck.rows.length !== 1) throw new BadRequestError('Choose a unique active zone by its ID');
        if (zCheck.rows.length > 0) {
          newZoneId = zCheck.rows[0].id;
          newZoneName = zCheck.rows[0].name;
          newZoneCode = zCheck.rows[0].code;
        }
      }

      const newCapacity = data.capacity !== undefined ? data.capacity : table.capacity;
      const newStatus = data.isActive === false ? 'OUT_OF_SERVICE' : data.status || (data.isActive === true && !table.is_active ? 'AVAILABLE' : table.status);
      const newIsActive = data.isActive !== undefined ? data.isActive : table.is_active;

      await pool.query(`
        UPDATE public.restaurant_tables
        SET table_number = $1,
            zone_id = $2,
            capacity = $3,
            status = $4,
            is_active = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6;
      `, [newNumber, newZoneId, newCapacity, newStatus, newIsActive, tableId]);

      if (!newIsActive) {
        await pool.query('UPDATE public.restaurant_tables SET current_waiter_staff_id=NULL, assigned_at=NULL WHERE id=$1',[tableId]);
        await pool.query('UPDATE public.table_assignment_history SET released_at=CURRENT_TIMESTAMP WHERE table_id=$1 AND released_at IS NULL',[tableId]);
      }
      await writeAuditLog({
        actorType: 'STAFF',
        actorId: actorStaffId,
        outletId: table.outlet_id,
        action: 'TABLE_UPDATED',
        entityType: 'RESTAURANT_TABLE',
        entityId: tableId,
        oldState: {
          tableNumber: table.table_number,
          zoneId: table.zone_id,
          capacity: table.capacity,
          status: table.status,
          isActive: table.is_active
        },
        newState: {
          tableNumber: newNumber,
          zoneId: newZoneId,
          capacity: newCapacity,
          status: newStatus,
          isActive: newIsActive
        },
        requestId: requestId || 'unknown'
      }, pool);

      await publishOutletEvent({
        outletId: table.outlet_id,
        channel: 'FLOOR',
        eventType: 'TABLE_UPDATED',
        entityId: tableId,
        payload: {
          tableId,
          tableNumber: newNumber,
          capacity: newCapacity,
          status: newStatus
        }
      }, pool);

      return {
        id: tableId,
        outletId: table.outlet_id,
        diningZoneId: newZoneId,
        zoneName: newZoneName,
        zoneCode: newZoneCode,
        tableNumber: newNumber,
        capacity: parseInt(newCapacity, 10),
        status: newStatus,
        currentWaiterName: newIsActive ? table.current_waiter_name : null,
        currentWaiterStaffId: newIsActive ? table.current_waiter_staff_id : null,
        isActive: Boolean(newIsActive)
      };
    }).catch((error: any) => {
      if (error.code === '23505') throw new ConflictError('Table number or QR identity already exists');
      throw error;
    });
  }

  /**
   * Deactivates a floor table while preserving its identifiers and all historical references.
   * Blocks deletion if a session is currently active or table is occupied.
   */
  static async deleteTable(tableId: string, actorStaffId: string, requestId?: string): Promise<{ success: boolean; tableId: string }> {
    return withTransaction(async (pool) => {

      const tableRes = await pool.query(`
        SELECT id, outlet_id, table_number, status, active_dining_session_id
        FROM public.restaurant_tables
        WHERE id = $1 FOR UPDATE;
      `, [tableId]);

      if (tableRes.rows.length === 0) {
        throw new NotFoundError(`Restaurant table '${tableId}'`);
      }

      const table = tableRes.rows[0];

      if (table.active_dining_session_id) {
        throw new ConflictError(
          `Cannot delete table ${table.table_number} while a dining session is active (session ${table.active_dining_session_id})`
        );
      }
      if (table.status === 'OCCUPIED') {
        throw new ConflictError(`Cannot delete table ${table.table_number} because it is currently OCCUPIED`);
      }

      const active = await pool.query("SELECT id FROM public.dining_sessions WHERE table_id=$1 AND status IN ('ACTIVE','BILLED')", [tableId]);
      if (active.rows.length) throw new ConflictError('Active dining session prevents deactivation');
      await pool.query(`UPDATE public.restaurant_tables SET is_active=false,status='OUT_OF_SERVICE',
        current_waiter_staff_id=NULL,assigned_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[tableId]);
      await pool.query('UPDATE public.table_assignment_history SET released_at=CURRENT_TIMESTAMP WHERE table_id=$1 AND released_at IS NULL',[tableId]);

      await writeAuditLog({
        actorType: 'STAFF',
        actorId: actorStaffId,
        outletId: table.outlet_id,
        action: 'TABLE_DELETED',
        entityType: 'RESTAURANT_TABLE',
        entityId: tableId,
        oldState: {
          tableNumber: table.table_number,
          status: table.status
        },
        requestId: requestId || 'unknown'
      }, pool);

      await publishOutletEvent({
        outletId: table.outlet_id,
        channel: 'FLOOR',
        eventType: 'TABLE_DELETED',
        entityId: tableId,
        payload: {
          tableId,
          tableNumber: table.table_number
        }
      }, pool);

      return { success: true, tableId };
    }).catch((error: any) => {
      if (error.code === '23505') throw new ConflictError('Table number or QR identity already exists');
      throw error;
    });
  }

  /**
   * Resolves table information from a scanned physical QR public code or table & restaurant parameters.
   * Performs timing-safe comparison on secret token if provided.
   * Never leaks internal hashes or staff UUIDs to the guest client.
   * When an active dining session exists, mints a secure guest session token.
   */
  static async resolveTableFromQr(
    inputOrCode:
      | string
      | {
          qrPublicCode?: string;
          qrSecretToken?: string;
          table?: string;
          tableNumber?: string;
          restaurant?: string;
          outletId?: string;
        },
    legacySecretToken?: string
  ): Promise<QrResolveResponse> {
    const pool = getDbPool();

    let qrPublicCode: string | undefined;
    let qrSecretToken: string | undefined;
    let tableParam: string | undefined;
    let restaurantParam: string | undefined;

    if (typeof inputOrCode === 'string') {
      qrPublicCode = inputOrCode;
      qrSecretToken = legacySecretToken;
    } else if (inputOrCode && typeof inputOrCode === 'object') {
      qrPublicCode = inputOrCode.qrPublicCode;
      qrSecretToken = 'qrSecretToken' in inputOrCode ? inputOrCode.qrSecretToken : legacySecretToken;
      tableParam = inputOrCode.table || inputOrCode.tableNumber;
      restaurantParam = inputOrCode.restaurant || (inputOrCode as any).restaurantId || inputOrCode.outletId;
    }

    let res: pg.QueryResult;

    if (qrPublicCode && qrPublicCode.trim()) {
      const query = `
        SELECT
          t.id AS table_id, t.outlet_id, t.zone_id, t.table_number, t.capacity,
          t.status, t.active_dining_session_id, t.qr_secret_token_hash, t.is_active,
          o.name AS outlet_name, o.is_active AS outlet_active,
          z.name AS zone_name,
          ds.id AS session_id, ds.status AS session_status
        FROM public.restaurant_tables t
        JOIN public.outlets o ON o.id = t.outlet_id
        JOIN public.dining_zones z ON z.id = t.zone_id
        LEFT JOIN public.dining_sessions ds ON ds.id = t.active_dining_session_id AND ds.status IN ('ACTIVE', 'BILLED')
        WHERE t.qr_public_code = $1;
      `;
      res = await pool.query(query, [qrPublicCode.trim()]);
    } else if (tableParam && tableParam.trim() && restaurantParam && restaurantParam.trim()) {
      const cleanTable = tableParam.trim();
      const cleanRest = restaurantParam.trim();

      // Normalize table variations: e.g. T-1 <-> T-01
      let altTable = cleanTable;
      const tMatch = cleanTable.match(/^([a-zA-Z]+)[^a-zA-Z0-9]*0*([0-9]+)$/);
      if (tMatch) {
        const prefix = tMatch[1].toUpperCase();
        const num = parseInt(tMatch[2], 10);
        if (cleanTable.toLowerCase().includes('0' + num)) {
          altTable = `${prefix}-${num}`;
        } else {
          altTable = `${prefix}-${String(num).padStart(2, '0')}`;
        }
      }

      const query = `
        SELECT
          t.id AS table_id, t.outlet_id, t.zone_id, t.table_number, t.capacity,
          t.status, t.active_dining_session_id, t.qr_secret_token_hash, t.is_active,
          o.name AS outlet_name, o.is_active AS outlet_active,
          z.name AS zone_name,
          ds.id AS session_id, ds.status AS session_status
        FROM public.restaurant_tables t
        JOIN public.outlets o ON o.id = t.outlet_id
        JOIN public.dining_zones z ON z.id = t.zone_id
        LEFT JOIN public.dining_sessions ds ON ds.id = t.active_dining_session_id AND ds.status IN ('ACTIVE', 'BILLED')
        WHERE (LOWER(t.table_number) = LOWER($1) OR LOWER(t.table_number) = LOWER($2) OR t.id::text = $1)
          AND (t.outlet_id = $3 OR o.id::text = $3 OR LOWER(o.name) = LOWER($3));
      `;
      res = await pool.query(query, [cleanTable, altTable, cleanRest]);
    } else {
      throw new BadRequestError('Either qrPublicCode or table and restaurant parameters must be provided');
    }

    if (res.rows.length === 0) {
      throw new NotFoundError(
        qrPublicCode ? `Restaurant table with QR '${qrPublicCode}'` : `Restaurant table '${tableParam}'`
      );
    }

    if (res.rows.length > 1) {
      throw new BadRequestError('Ambiguous table identifier: multiple tables matched the scanned QR parameters');
    }

    const row = res.rows[0];

    if (!row.is_active) {
      throw new NotFoundError(`Restaurant table '${row.table_number}' is inactive`);
    }

    if (!row.outlet_active) {
      throw new ForbiddenError(`Outlet '${row.outlet_name}' is currently inactive`);
    }

    // Cross-outlet validation when outlet/restaurant parameter is provided
    if (restaurantParam && restaurantParam.trim()) {
      const cleanRest = restaurantParam.trim().toLowerCase();
      const outletMatches = row.outlet_id.toLowerCase() === cleanRest ||
        row.outlet_name.toLowerCase() === cleanRest;
      if (!outletMatches) {
        throw new ForbiddenError(`QR code credential does not belong to the specified outlet`);
      }
    }

    // Cryptographic proof verification
    if (qrSecretToken !== undefined) {
      if (!qrSecretToken || !qrSecretToken.trim()) {
        throw new UnauthorizedError('Invalid QR secret token proof');
      }
      const candidateHash = crypto
        .createHash('sha256')
        .update(qrSecretToken.trim())
        .digest('hex');

      const bufA = Buffer.from(candidateHash);
      const bufB = Buffer.from(row.qr_secret_token_hash || '');

      if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        throw new UnauthorizedError('Invalid QR secret token proof');
      }
    }

    const activeSessionId = row.session_id || row.active_dining_session_id || null;
    const hasActiveSession = Boolean(activeSessionId);


    return {
      tableId: row.table_id,
      outletId: row.outlet_id,
      outletName: row.outlet_name,
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      tableNumber: row.table_number,
      capacity: parseInt(row.capacity, 10),
      status: row.status,
      hasActiveSession,
      sessionId: hasActiveSession ? activeSessionId : null
    };
  }

  /**
   * Opens a new physical dining session at a table in a single atomic transaction.
   * Locks table FOR UPDATE, enforces cross-outlet integrity, enforces single-session
   * occupancy invariant, updates table pointer, records audit, and publishes outlet event.
   */
  static async createDiningSession(
    input: {
      outletId: string;
      tableId: string;
      guestCount: number;
      customer?: {
        phone: string;
        name?: string;
        email?: string;
      };
    },
    staffId: string,
    requestId: string,
    ipAddress?: string | null,
    transactionClient?:pg.PoolClient
  ): Promise<DiningSessionDetailResponse> {
    const execute = async (client:pg.PoolClient):Promise<DiningSessionDetailResponse> => {
      // 1. Lock table row FOR UPDATE to prevent race conditions
      const tableRes = await client.query(
        'SELECT * FROM public.restaurant_tables WHERE id = $1 FOR UPDATE',
        [input.tableId]
      );

      if (tableRes.rows.length === 0) {
        throw new NotFoundError(`Restaurant table '${input.tableId}'`);
      }

      const table = tableRes.rows[0];

      // 2. Cross-outlet integrity validation
      if (table.outlet_id !== input.outletId) {
        throw new BadRequestError(
          `Cross-outlet mismatch: Table '${table.table_number}' belongs to outlet '${table.outlet_id}', not '${input.outletId}'`
        );
      }

      // 2b. Confirm outlet is active (inactive outlets cannot receive new operational sessions)
      const outletRes = await client.query(
        'SELECT id, is_active FROM public.outlets WHERE id = $1 FOR SHARE',
        [input.outletId]
      );
      if (outletRes.rows.length > 0 && outletRes.rows[0].is_active === false) {
        throw new ConflictError(`Outlet '${input.outletId}' is currently inactive`);
      }

      // 3. Confirm table is active
      if (!table.is_active) {
        throw new ConflictError(`Table '${table.table_number}' is marked inactive`);
      }

      if (['CLEANING','OUT_OF_SERVICE'].includes(table.status)) throw new ConflictError('Table is not available for seating');
      // 4. Verify no active or billed session currently claims the table
      const activeSessionRes = await client.query(
        `SELECT id, status FROM public.dining_sessions
         WHERE table_id = $1 AND status IN ('ACTIVE', 'BILLED')`,
        [input.tableId]
      );

      if (activeSessionRes.rows.length > 0 || table.active_dining_session_id) {
        throw new ConflictError(
          `Table '${table.table_number}' is currently occupied with an active or billed dining session`
        );
      }

      // 5. Customer profile resolution / creation if phone provided
      let customerId: string | null = null;
      let customerRecord: { id: string; name: string | null; phone: string; email: string | null } | null = null;

      if (input.customer?.phone) {
        const cleanPhone = input.customer.phone.replace(/[\s-]/g, '');
        const custLookup = await client.query(
          'SELECT id, name, phone, email FROM public.customers WHERE phone = $1',
          [cleanPhone]
        );

        if (custLookup.rows.length > 0) {
          customerId = custLookup.rows[0].id;
          customerRecord = custLookup.rows[0];
        } else {
          const newCust = await client.query(
            `INSERT INTO public.customers (phone, name, email)
             VALUES ($1, $2, $3)
             RETURNING id, name, phone, email`,
            [cleanPhone, input.customer.name || null, input.customer.email || null]
          );
          customerId = newCust.rows[0].id;
          customerRecord = newCust.rows[0];
        }
      }

      // 6. Insert dining_sessions record
      let sessionRow;
      try {
        const insertSessionQuery = `
          INSERT INTO public.dining_sessions (
            outlet_id, table_id, customer_id, guest_count, status
          ) VALUES ($1, $2, $3, $4, 'ACTIVE')
          RETURNING id, outlet_id, table_id, customer_id, guest_count, status, opened_at, closed_at;
        `;
        const sessionRes = await client.query(insertSessionQuery, [
          input.outletId,
          input.tableId,
          customerId,
          input.guestCount
        ]);
        sessionRow = sessionRes.rows[0];
      } catch (err: any) {
        // Intercept partial unique index collision (idx_unique_active_table_session)
        if (err.code === '23505' && err.constraint === 'idx_unique_active_table_session') {
          throw new ConflictError(
            `Table '${table.table_number}' already has an active dining session (concurrency detected)`
          );
        }
        throw err;
      }

      // 7. Update restaurant_tables active session pointer & status
      await client.query(
        `UPDATE public.restaurant_tables
         SET active_dining_session_id = $2,
             status = 'OCCUPIED',
             current_waiter_staff_id = COALESCE(current_waiter_staff_id, $3),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [input.tableId, sessionRow.id, staffId]
      );

      // Each sitting receives a new history interval for the table's retained assignee.
      await client.query('UPDATE public.table_assignment_history SET released_at=CURRENT_TIMESTAMP WHERE table_id=$1 AND released_at IS NULL',[input.tableId]);
      await client.query(`INSERT INTO public.table_assignment_history
        (table_id,dining_session_id,waiter_staff_id,assigned_by_staff_id)
        SELECT id,$2,current_waiter_staff_id,$3 FROM public.restaurant_tables WHERE id=$1 AND current_waiter_staff_id IS NOT NULL`,
        [input.tableId,sessionRow.id,staffId]);

      // 8. Write audit log entry in same transaction
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'DINING_SESSION_CREATED',
          entityType: 'dining_sessions',
          entityId: sessionRow.id,
          outletId: input.outletId,
          oldState: null,
          newState: {
            sessionId: sessionRow.id,
            tableId: input.tableId,
            tableNumber: table.table_number,
            guestCount: input.guestCount,
            status: 'ACTIVE'
          },
          requestId,
          ipAddress
        },
        client
      );

      // 9. Publish outlet event in same transaction
      const pubEvent = await publishOutletEvent(
        {
          outletId: input.outletId,
          channel: 'tables',
          eventType: 'DINING_SESSION_CREATED',
          entityId: sessionRow.id,
          payload: {
            sessionId: sessionRow.id,
            tableId: input.tableId,
            tableNumber: table.table_number,
            guestCount: input.guestCount,
            status: 'ACTIVE'
          }
        },
        client
      );

      // 10. Broadcast realtime event (non-blocking)
      realtimeBroadcaster
        .publish({
          outletId: input.outletId,
          channel: 'tables',
          sequenceNumber: parseInt(pubEvent.sequenceNumber, 10) || 1,
          eventType: 'DINING_SESSION_CREATED',
          payload: {
            sessionId: sessionRow.id,
            tableId: input.tableId,
            tableNumber: table.table_number
          },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      return {
        id: sessionRow.id,
        outletId: sessionRow.outlet_id,
        tableId: sessionRow.table_id,
        tableNumber: table.table_number,
        customerId,
        customer: customerRecord
          ? {
              id: customerRecord.id,
              name: customerRecord.name,
              phone: maskPhoneNumber(customerRecord.phone),
              email: customerRecord.email
            }
          : null,
        guestCount: parseInt(sessionRow.guest_count, 10),
        status: sessionRow.status,
        openedAt: sessionRow.opened_at.toISOString ? sessionRow.opened_at.toISOString() : String(sessionRow.opened_at),
        closedAt: null,
        activeServiceRequests: []
      };
    };
    return transactionClient ? execute(transactionClient) : withTransaction(execute);
  }

  /**
   * Retrieves dining session by ID along with customer display and service requests.
   */
  static async getDiningSessionById(sessionId: string): Promise<DiningSessionDetailResponse> {
    const pool = getDbPool();

    const query = `
      SELECT 
        ds.id, ds.outlet_id, ds.table_id, ds.customer_id, ds.guest_count,
        ds.status, ds.hotel_stay_id, ds.opened_at, ds.closed_at,
        rt.table_number,
        c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
      FROM public.dining_sessions ds
      JOIN public.restaurant_tables rt ON rt.id = ds.table_id
      LEFT JOIN public.customers c ON c.id = ds.customer_id
      WHERE ds.id = $1;
    `;

    const res = await pool.query(query, [sessionId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }

    const row = res.rows[0];

    // Fetch active service requests
    const srRes = await pool.query(
      `SELECT 
        sr.id, sr.outlet_id, sr.dining_session_id, sr.table_id, sr.request_type,
        sr.status, sr.acknowledged_by_staff_id, sr.acknowledged_at, sr.resolved_at,
        sr.created_at, rt.table_number,
        CASE WHEN s.id IS NOT NULL THEN s.first_name || ' ' || s.last_name ELSE NULL END AS acknowledged_by_name
       FROM public.service_requests sr
       JOIN public.restaurant_tables rt ON rt.id = sr.table_id
       LEFT JOIN public.staff s ON s.id = sr.acknowledged_by_staff_id
       WHERE sr.dining_session_id = $1
       ORDER BY sr.created_at DESC;`,
      [sessionId]
    );

    const activeServiceRequests: ServiceRequestResponse[] = srRes.rows.map((r) => ({
      id: r.id,
      outletId: r.outlet_id,
      diningSessionId: r.dining_session_id,
      tableId: r.table_id,
      tableNumber: r.table_number,
      requestType: r.request_type,
      status: r.status,
      acknowledgedByStaffId: r.acknowledged_by_staff_id,
      acknowledgedByName: r.acknowledged_by_name,
      acknowledgedAt: r.acknowledged_at ? r.acknowledged_at.toISOString() : null,
      resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at)
    }));

    return {
      id: row.id,
      outletId: row.outlet_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      customerId: row.customer_id,
      customer: row.customer_id
        ? {
            id: row.customer_id,
            name: row.customer_name,
            phone: maskPhoneNumber(row.customer_phone),
            email: row.customer_email
          }
        : null,
      guestCount: parseInt(row.guest_count, 10),
      status: row.status,
      hotelStayId: row.hotel_stay_id,
      openedAt: row.opened_at.toISOString ? row.opened_at.toISOString() : String(row.opened_at),
      closedAt: row.closed_at ? (row.closed_at.toISOString ? row.closed_at.toISOString() : String(row.closed_at)) : null,
      activeServiceRequests
    };
  }

  /**
   * Lists dining sessions for an outlet with optional status filter.
   */
  static async listOutletDiningSessions(
    outletId: string,
    status?: string
  ): Promise<DiningSessionDetailResponse[]> {
    const pool = getDbPool();

    let query = `
      SELECT 
        ds.id, ds.outlet_id, ds.table_id, ds.customer_id, ds.guest_count,
        ds.status, ds.hotel_stay_id, ds.opened_at, ds.closed_at,
        rt.table_number,
        c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
      FROM public.dining_sessions ds
      JOIN public.restaurant_tables rt ON rt.id = ds.table_id
      LEFT JOIN public.customers c ON c.id = ds.customer_id
      WHERE ds.outlet_id = $1
    `;

    const values: unknown[] = [outletId];
    if (status) {
      query += ' AND ds.status = $2';
      values.push(status);
    }

    query += ' ORDER BY ds.opened_at DESC;';

    const res = await pool.query(query, values);

    return res.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      customerId: row.customer_id,
      customer: row.customer_id
        ? {
            id: row.customer_id,
            name: row.customer_name,
            phone: maskPhoneNumber(row.customer_phone),
            email: row.customer_email
          }
        : null,
      guestCount: parseInt(row.guest_count, 10),
      status: row.status,
      hotelStayId: row.hotel_stay_id,
      openedAt: row.opened_at.toISOString ? row.opened_at.toISOString() : String(row.opened_at),
      closedAt: row.closed_at ? (row.closed_at.toISOString ? row.closed_at.toISOString() : String(row.closed_at)) : null
    }));
  }

  /**
   * Closes a dining session:
   * 1. Locks session FOR UPDATE.
   * 2. Inspects canonical billing dependency: if an un-settled bill exists, closure is blocked.
   * 3. Sets session status to CLOSED, closed_at = CURRENT_TIMESTAMP.
   * 4. Clears restaurant_tables.active_dining_session_id and transitions table status to CLEANING.
   * 5. Revokes all active guest session tokens.
   * 6. Resolves any outstanding service requests.
   * 7. Writes audit log & outlet event atomically.
   */
  static async closeDiningSession(
    sessionId: string,
    staffId: string,
    requestId: string,
    ipAddress?: string | null,
    transactionClient?:pg.PoolClient
  ): Promise<{ sessionId: string; status: 'CLOSED' }> {
    const execute=async(client:pg.PoolClient):Promise<{sessionId:string;status:'CLOSED'}>=>{
      await client.query('SELECT rt.id FROM public.restaurant_tables rt JOIN public.dining_sessions ds ON ds.table_id=rt.id WHERE ds.id=$1 FOR UPDATE OF rt',[sessionId]);
      // 1. Lock session
      const sessionRes = await client.query(
        'SELECT * FROM public.dining_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundError(`Dining session '${sessionId}'`);
      }

      const session = sessionRes.rows[0];

      if (session.status === 'CLOSED') {
        return { sessionId: session.id, status: 'CLOSED' };
      }
      if (session.status === 'CANCELLED') {
        throw new ConflictError('Dining session was cancelled and cannot be closed');
      }

      const pendingOrders=await client.query("SELECT id FROM public.orders WHERE dining_session_id=$1 AND status NOT IN ('SERVED','CANCELLED') LIMIT 1",[sessionId]);
      if(pendingOrders.rows.length) throw new ConflictError('Cannot close a sitting with unfinished orders.');

      // 2. Canonical billing dependency check (Migration 008)
      // Any non-voided bill associated with this session must be in SETTLED status with 0 balance
      const billsRes = await client.query(
        `SELECT invoice_number, status, balance_paise
         FROM public.bills
         WHERE dining_session_id = $1 AND status != 'VOIDED'`,
        [sessionId]
      );

      for (const bill of billsRes.rows) {
        const bal = parseInt(bill.balance_paise, 10);
        if (bill.status !== 'SETTLED' && bal > 0) {
          throw new ConflictError(
            `Cannot close dining session: Outstanding bill '${bill.invoice_number}' is not settled (balance: ₹${(bal / 100).toFixed(2)})`
          );
        }
      }

      // 3. Update session
      await client.query(
        `UPDATE public.dining_sessions
         SET status = 'CLOSED',
             closed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sessionId]
      );

      // 4. Reset table: clear active pointer and mark status as CLEANING
      await client.query(
        `UPDATE public.restaurant_tables
         SET active_dining_session_id = NULL,
             status = 'CLEANING',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [session.table_id]
      );

      // 5. Revoke all active guest tokens
      await client.query(
        `UPDATE public.guest_session_tokens
         SET is_revoked = true
         WHERE dining_session_id = $1 AND is_revoked = false`,
        [sessionId]
      );

      // 6. Auto-resolve outstanding call-bell requests
      await client.query(
        `UPDATE public.service_requests
         SET status = 'RESOLVED',
             resolved_at = CURRENT_TIMESTAMP
         WHERE dining_session_id = $1 AND status IN ('PENDING', 'ACKNOWLEDGED')`,
        [sessionId]
      );

      // 7. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'DINING_SESSION_CLOSED',
          entityType: 'dining_sessions',
          entityId: sessionId,
          outletId: session.outlet_id,
          oldState: { status: session.status },
          newState: { status: 'CLOSED' },
          requestId,
          ipAddress
        },
        client
      );

      // 8. Publish outlet event
      await publishOutletEvent(
        {
          outletId: session.outlet_id,
          channel: 'tables',
          eventType: 'DINING_SESSION_CLOSED',
          entityId: sessionId,
          payload: {
            sessionId,
            tableId: session.table_id,
            status: 'CLOSED'
          }
        },
        client
      );

      // Parent billing transactions retain their committed event journal.
      if(!transactionClient) realtimeBroadcaster
        .publish({
          outletId: session.outlet_id,
          channel: 'tables',
          sequenceNumber: 1,
          eventType: 'DINING_SESSION_CLOSED',
          payload: { sessionId, tableId: session.table_id },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      return { sessionId, status: 'CLOSED' };
    };
    return transactionClient ? execute(transactionClient) : withTransaction(execute);
  }

  /**
   * Cancels an active session prior to service/billing commencement:
   * 1. Enforces status is ACTIVE (cannot cancel billed sessions).
   * 2. Confirms zero active un-voided bills exist.
   * 3. Sets CANCELLED, resets table to AVAILABLE, revokes tokens, cancels requests.
   */
  static async cancelDiningSession(
    sessionId: string,
    staffId: string,
    reason?: string,
    requestId?: string,
    ipAddress?: string | null
  ): Promise<{ sessionId: string; status: 'CANCELLED' }> {
    return await withTransaction(async (client) => {
      await client.query('SELECT rt.id FROM public.restaurant_tables rt JOIN public.dining_sessions ds ON ds.table_id=rt.id WHERE ds.id=$1 FOR UPDATE OF rt',[sessionId]);
      const sessionRes = await client.query(
        'SELECT * FROM public.dining_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundError(`Dining session '${sessionId}'`);
      }

      const session = sessionRes.rows[0];

      if (session.status === 'BILLED') {
        throw new ConflictError(
          'Cannot cancel a dining session that has already been billed. Please void the bill first.'
        );
      }
      if (session.status === 'CLOSED') {
        throw new ConflictError('Cannot cancel an already closed dining session');
      }
      if (session.status === 'CANCELLED') {
        throw new ConflictError('Dining session has already been cancelled');
      }

      // Check if un-voided bills exist
      const billsRes = await client.query(
        'SELECT id FROM public.bills WHERE dining_session_id = $1 AND status != \'VOIDED\' LIMIT 1',
        [sessionId]
      );
      if (billsRes.rows.length > 0) {
        throw new ConflictError('Cannot cancel session with existing invoices or bills');
      }

      // Update session
      await client.query(
        `UPDATE public.dining_sessions
         SET status = 'CANCELLED',
             closed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sessionId]
      );

      // Reset table to AVAILABLE
      await client.query(
        `UPDATE public.restaurant_tables
         SET active_dining_session_id = NULL,
             status = 'AVAILABLE',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [session.table_id]
      );

      // Revoke tokens
      await client.query(
        `UPDATE public.guest_session_tokens
         SET is_revoked = true
         WHERE dining_session_id = $1 AND is_revoked = false`,
        [sessionId]
      );

      // Cancel service requests
      await client.query(
        `UPDATE public.service_requests
         SET status = 'CANCELLED'
         WHERE dining_session_id = $1 AND status IN ('PENDING', 'ACKNOWLEDGED')`,
        [sessionId]
      );

      // Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'DINING_SESSION_CANCELLED',
          entityType: 'dining_sessions',
          entityId: sessionId,
          outletId: session.outlet_id,
          oldState: { status: session.status },
          newState: { status: 'CANCELLED', reason: reason || null },
          requestId: requestId || 'unknown',
          ipAddress
        },
        client
      );

      // Event log
      await publishOutletEvent(
        {
          outletId: session.outlet_id,
          channel: 'tables',
          eventType: 'DINING_SESSION_CANCELLED',
          entityId: sessionId,
          payload: { sessionId, tableId: session.table_id, status: 'CANCELLED' }
        },
        client
      );

      return { sessionId, status: 'CANCELLED' };
    });
  }

  // --------------------------------------------------------------------------
  // GUEST QR & OTP LIFECYCLE
  // --------------------------------------------------------------------------

  /**
   * Initiates guest onboarding by issuing a cryptographically secure 6-digit OTP.
   * Plaintext OTP is NEVER stored in database or returned in production responses.
   * Validates active table session presence before OTP generation.
   */
  static async requestGuestOtp(input: {
    qrPublicCode: string;
    phone: string;
    name?: string;
    qrSecretToken?: string;
  }): Promise<OtpRequestResponse> {
    return withTransaction(async pool => {
    const env = getEnv();
    const cleanPhone = input.phone.replace(/[\s-]/g, '');

    // Per-phone rate limit: at most 5 OTP requests per phone number per 15 minutes
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const history = (otpPhoneRequests.get(cleanPhone) || []).filter((ts) => now - ts < windowMs);
    if (history.length >= 5) {
      throw new RateLimitError(
        'Too many OTP requests for this phone number. Please try again in 15 minutes.'
      );
    }
    history.push(now);
    otpPhoneRequests.set(cleanPhone, history);

    // 1. Resolve table and verify active dining session exists
    const tableRes = await pool.query(
      `SELECT 
        rt.id AS table_id, rt.outlet_id, rt.table_number, rt.qr_secret_token_hash,
        rt.active_dining_session_id, rt.is_active,
        ds.id AS session_id, ds.status AS session_status, o.is_active AS outlet_active
       FROM public.restaurant_tables rt
       JOIN public.outlets o ON o.id=rt.outlet_id
       LEFT JOIN public.dining_sessions ds ON ds.id = rt.active_dining_session_id
       WHERE rt.qr_public_code = $1 FOR SHARE OF rt, o;`,
      [input.qrPublicCode.trim()]
    );

    if (tableRes.rows.length === 0 || !tableRes.rows[0].is_active) {
      throw new NotFoundError('Restaurant table QR code not found or inactive');
    }

    const table = tableRes.rows[0];
    if (!table.outlet_active) throw new ForbiddenError('Outlet is inactive');

    // Table secret token is strictly required
    if (!input.qrSecretToken || !input.qrSecretToken.trim()) {
      throw new UnauthorizedError('Table secret token is required');
    }
    const candidateHash = crypto
      .createHash('sha256')
      .update(input.qrSecretToken.trim())
      .digest('hex');
    const bufA = Buffer.from(candidateHash);
    const bufB = Buffer.from(table.qr_secret_token_hash);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      throw new UnauthorizedError('Invalid QR secret token proof');
    }

    // Require an ACTIVE dining session
    if (!table.session_id || table.session_status !== 'ACTIVE') {
      throw new ConflictError(
        `Table '${table.table_number}' does not have an active dining session. Please request floor staff to seat your table.`
      );
    }

    // 2. Resolve or upsert customer profile
    await pool.query(
      `INSERT INTO public.customers (phone, name)
       VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, customers.name),
         updated_at = CURRENT_TIMESTAMP`,
      [cleanPhone, input.name || null]
    );

    // 3. Cryptographically secure 6-digit OTP generation (or dummy OTP if enabled in config)
    let plainOtp: string;
    if (env.DUMMY_OTP_ENABLED && env.DUMMY_OTP_CODE) {
      plainOtp = env.DUMMY_OTP_CODE.trim();
    } else {
      const otpInt = crypto.randomInt(100000, 1000000);
      plainOtp = otpInt.toString();
    }
    const otpHash = crypto.createHash('sha256').update(plainOtp).digest('hex');

    // Canonical 5-minute expiration
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Initial placeholder token hash
    const initialTokenPlaceholder = 'temp_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(initialTokenPlaceholder).digest('hex');
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

    // 4. Insert into guest_session_tokens
    const tokenRes = await pool.query(
      `INSERT INTO public.guest_session_tokens (
        dining_session_id, token_hash, otp_hash, otp_expires_at, otp_attempts, is_revoked, expires_at
      ) VALUES ($1, $2, $3, $4, 0, false, $5)
      RETURNING id;`,
      [table.session_id, tokenHash, otpHash, otpExpiresAt, expiresAt]
    );

    const tokenId = tokenRes.rows[0].id;

    // 5. Send OTP via transport based on OTP_DELIVERY mode (skip when dummy OTP is enabled)
    if (!env.DUMMY_OTP_ENABLED) {
      if (env.OTP_DELIVERY === 'sms') {
        const delivered = await sendOtpSms(cleanPhone, plainOtp);
        if (!delivered) throw new BadRequestError('Unable to deliver verification code. Please retry later.');
      }
    }

    const response: OtpRequestResponse = {
      success: true,
      message: 'OTP sent to mobile number',
      sessionTokenId: tokenId,
      expiresInSeconds: 300
    };

    if (env.OTP_DELIVERY === 'screen') {
      response.devOtp = plainOtp;
    }

    return response;
    });
  }

  /**
   * Verifies guest OTP and returns a newly minted bearer token:
   * 1. Row locks token record.
   * 2. Rejects revoked, expired, or attempt-exhausted (>=3) records.
   * 3. Timing-safe SHA-256 comparison.
   * 4. Atomic attempt increment on failure.
   * 5. On success: clears OTP fields, updates token_hash to permanent bearer token.
   * 6. Returns plaintext bearer token once. Never persists or logs it.
   */
  static async verifyGuestOtp(
    sessionTokenId: string,
    otp: string
  ): Promise<OtpVerifyResponse> {
    const result = await withTransaction<OtpVerifyResponse | {failure: Error}>(async (client) => {
      const res = await client.query(
        'SELECT * FROM public.guest_session_tokens WHERE id = $1 FOR UPDATE',
        [sessionTokenId]
      );

      if (res.rows.length === 0) {
        throw new NotFoundError('Guest session token reference not found');
      }

      const row = res.rows[0];

      if (row.is_revoked) {
        throw new UnauthorizedError('Guest session token has been revoked');
      }

      const sitting = await client.query(`SELECT ds.status,rt.active_dining_session_id,rt.is_active,o.is_active AS outlet_active
        FROM public.dining_sessions ds JOIN public.restaurant_tables rt ON rt.id=ds.table_id
        JOIN public.outlets o ON o.id=ds.outlet_id WHERE ds.id=$1`,[row.dining_session_id]);
      const active=sitting.rows[0];
      if (!active || active.status!=='ACTIVE' || !active.is_active || !active.outlet_active || active.active_dining_session_id!==row.dining_session_id) {
        throw new ForbiddenError('This table sitting no longer accepts verification');
      }
      // Enforce 3-attempt rule
      if (row.otp_attempts >= 3) {
        throw new BadRequestError(
          'Maximum OTP verification attempts (3) exceeded. Please request a new OTP.'
        );
      }

      // Enforce 5-minute expiration
      if (!row.otp_expires_at || new Date(row.otp_expires_at) <= new Date()) {
        throw new BadRequestError('OTP has expired. Please request a new OTP.');
      }

      // Timing-safe comparison of SHA-256 hash
      const candidateHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
      const bufA = Buffer.from(candidateHash);
      const bufB = Buffer.from(row.otp_hash || '');

      const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

      if (!isMatch) {
        const newAttempts = row.otp_attempts + 1;
        await client.query(
          'UPDATE public.guest_session_tokens SET otp_attempts = $2 WHERE id = $1',
          [sessionTokenId, newAttempts]
        );

        if (newAttempts >= 3) {
          return {failure:new BadRequestError('Incorrect OTP. Maximum attempts reached. Please request a new OTP.')};
        }

        return {failure:new BadRequestError(`Incorrect OTP. ${3 - newAttempts} attempt(s) remaining.`)};
      }

      // Success: mint final cryptographically secure bearer token
      const rawBearerToken = 'gst_' + crypto.randomBytes(32).toString('hex');
      const permanentTokenHash = crypto
        .createHash('sha256')
        .update(rawBearerToken)
        .digest('hex');
      const tokenExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

      // Invalidate OTP fields and store permanent token hash
      await client.query(
        `UPDATE public.guest_session_tokens
         SET token_hash = $2,
             verified_at = CURRENT_TIMESTAMP,
             otp_hash = NULL,
             otp_expires_at = NULL,
             otp_attempts = 0,
             expires_at = $3
         WHERE id = $1`,
        [sessionTokenId, permanentTokenHash, tokenExpiresAt]
      );

      return {
        token: rawBearerToken,
        tokenType: 'Bearer',
        expiresInSeconds: 21600
      };
    });
    if ('failure' in result) throw result.failure;
    return result;
  }

  /**
   * Retrieves summary of the guest's authenticated session.
   */
  static async getGuestSessionSummary(
    guestContext: AuthenticatedGuestContext
  ): Promise<GuestSessionSummaryResponse> {
    const pool = getDbPool();
    const query = `
      SELECT 
        ds.id AS session_id, ds.outlet_id, ds.table_id, ds.guest_count,
        ds.status, ds.opened_at,
        rt.table_number,
        c.name AS customer_name
      FROM public.dining_sessions ds
      JOIN public.restaurant_tables rt ON rt.id = ds.table_id
      LEFT JOIN public.customers c ON c.id = ds.customer_id
      WHERE ds.id = $1;
    `;

    const res = await pool.query(query, [guestContext.diningSessionId]);
    if (res.rows.length === 0) {
      throw new NotFoundError('Dining session');
    }

    const row = res.rows[0];

    return {
      sessionId: row.session_id,
      outletId: row.outlet_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      guestCount: parseInt(row.guest_count, 10),
      status: row.status,
      customerName: row.customer_name,
      openedAt: row.opened_at.toISOString ? row.opened_at.toISOString() : String(row.opened_at)
    };
  }

  // --------------------------------------------------------------------------
  // SERVICE REQUEST CALL-BELL WORKFLOW
  // --------------------------------------------------------------------------

  /**
   * Creates a service request (call waiter, water, bill, cutlery, cleaning).
   * Cross-entity IDs are strictly derived from the validated guestSession context.
   */
  static async createServiceRequest(
    requestType: ServiceRequestType,
    guestContext: Pick<AuthenticatedGuestContext,'diningSessionId'|'tableId'|'outletId'|'tableNumber'>
  ): Promise<ServiceRequestResponse> {
    return await withTransaction(async (client) => {
      const sitting=await client.query('SELECT id,status,table_id,outlet_id FROM public.dining_sessions WHERE id=$1 FOR SHARE',[guestContext.diningSessionId]);
      const session=sitting.rows[0];
      if(!session || !['ACTIVE','BILLED'].includes(session.status) || session.table_id!==guestContext.tableId || session.outlet_id!==guestContext.outletId) throw new ForbiddenError('This table sitting no longer accepts service requests');
      const insertQuery = `
        INSERT INTO public.service_requests (
          outlet_id, dining_session_id, table_id, request_type, status
        ) VALUES ($1, $2, $3, $4, 'PENDING')
        RETURNING id, outlet_id, dining_session_id, table_id, request_type,
                  status, acknowledged_by_staff_id, acknowledged_at, resolved_at, created_at;
      `;

      const res = await client.query(insertQuery, [
        guestContext.outletId,
        guestContext.diningSessionId,
        guestContext.tableId,
        requestType
      ]);
      const row = res.rows[0];

      // Publish event in same transaction
      await publishOutletEvent(
        {
          outletId: guestContext.outletId,
          channel: 'service_requests',
          eventType: 'SERVICE_REQUEST_CREATED',
          entityId: row.id,
          payload: {
            requestId: row.id,
            tableNumber: guestContext.tableNumber,
            requestType,
            status: 'PENDING'
          }
        },
        client
      );

      // Realtime broadcast
      realtimeBroadcaster
        .publish({
          outletId: guestContext.outletId,
          channel: 'service_requests',
          sequenceNumber: 1,
          eventType: 'SERVICE_REQUEST_CREATED',
          payload: {
            requestId: row.id,
            tableNumber: guestContext.tableNumber,
            requestType
          },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      return {
        id: row.id,
        outletId: row.outlet_id,
        diningSessionId: row.dining_session_id,
        tableId: row.table_id,
        tableNumber: guestContext.tableNumber,
        requestType: row.request_type,
        status: row.status,
        acknowledgedByStaffId: null,
        acknowledgedByName: null,
        acknowledgedAt: null,
        resolvedAt: null,
        createdAt: row.created_at.toISOString ? row.created_at.toISOString() : String(row.created_at)
      };
    });
  }

  /**
   * Returns list of service requests for the guest's authenticated dining session.
   */
  static async listGuestServiceRequests(
    guestContext: AuthenticatedGuestContext
  ): Promise<ServiceRequestResponse[]> {
    const pool = getDbPool();
    const query = `
      SELECT 
        sr.id, sr.outlet_id, sr.dining_session_id, sr.table_id, sr.request_type,
        sr.status, sr.acknowledged_by_staff_id, sr.acknowledged_at, sr.resolved_at, sr.created_at,
        rt.table_number,
        CONCAT(st.first_name, ' ', st.last_name) AS acknowledged_by_name
      FROM public.service_requests sr
      JOIN public.restaurant_tables rt ON rt.id = sr.table_id
      LEFT JOIN public.staff st ON st.id = sr.acknowledged_by_staff_id
      WHERE sr.dining_session_id = $1
      ORDER BY sr.created_at DESC;
    `;
    const res = await pool.query(query, [guestContext.diningSessionId]);
    return res.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      diningSessionId: row.dining_session_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      requestType: row.request_type,
      status: row.status,
      acknowledgedByStaffId: row.acknowledged_by_staff_id,
      acknowledgedByName: row.acknowledged_by_name,
      acknowledgedAt: row.acknowledged_at ? (row.acknowledged_at.toISOString ? row.acknowledged_at.toISOString() : String(row.acknowledged_at)) : null,
      resolvedAt: row.resolved_at ? (row.resolved_at.toISOString ? row.resolved_at.toISOString() : String(row.resolved_at)) : null,
      createdAt: row.created_at ? (row.created_at.toISOString ? row.created_at.toISOString() : String(row.created_at)) : new Date().toISOString()
    }));
  }

  /**
   * Staff acknowledges a pending service request.
   */
  static async acknowledgeServiceRequest(
    requestId: string,
    staffId: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<ServiceRequestResponse> {
    return await withTransaction(async (client) => {
      const srRes = await client.query(
        `SELECT sr.*, rt.table_number
         FROM public.service_requests sr
         JOIN public.restaurant_tables rt ON rt.id = sr.table_id
         WHERE sr.id = $1 FOR UPDATE`,
        [requestId]
      );

      if (srRes.rows.length === 0) {
        throw new NotFoundError(`Service request '${requestId}'`);
      }

      const sr = srRes.rows[0];

      if (sr.status !== 'PENDING') {
        throw new ConflictError(
          `Cannot acknowledge service request in '${sr.status}' status`
        );
      }

      const updateRes = await client.query(
        `UPDATE public.service_requests
         SET status = 'ACKNOWLEDGED',
             acknowledged_by_staff_id = $2,
             acknowledged_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [requestId, staffId]
      );
      const updated = updateRes.rows[0];

      // Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'SERVICE_REQUEST_ACKNOWLEDGED',
          entityType: 'service_requests',
          entityId: requestId,
          outletId: sr.outlet_id,
          oldState: { status: sr.status },
          newState: { status: 'ACKNOWLEDGED' },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // Event log
      await publishOutletEvent(
        {
          outletId: sr.outlet_id,
          channel: 'service_requests',
          eventType: 'SERVICE_REQUEST_ACKNOWLEDGED',
          entityId: requestId,
          payload: {
            requestId,
            tableNumber: sr.table_number,
            status: 'ACKNOWLEDGED'
          }
        },
        client
      );

      // Realtime notification
      realtimeBroadcaster
        .publish({
          outletId: sr.outlet_id,
          channel: 'service_requests',
          sequenceNumber: 1,
          eventType: 'SERVICE_REQUEST_ACKNOWLEDGED',
          payload: { requestId, status: 'ACKNOWLEDGED' },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      return {
        id: updated.id,
        outletId: updated.outlet_id,
        diningSessionId: updated.dining_session_id,
        tableId: updated.table_id,
        tableNumber: sr.table_number,
        requestType: updated.request_type,
        status: updated.status,
        acknowledgedByStaffId: updated.acknowledged_by_staff_id,
        acknowledgedByName: null,
        acknowledgedAt: updated.acknowledged_at ? updated.acknowledged_at.toISOString() : null,
        resolvedAt: null,
        createdAt: updated.created_at.toISOString ? updated.created_at.toISOString() : String(updated.created_at)
      };
    });
  }

  /**
   * Staff resolves an acknowledged or pending service request.
   */
  static async resolveServiceRequest(
    requestId: string,
    staffId: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<ServiceRequestResponse> {
    return await withTransaction(async (client) => {
      const srRes = await client.query(
        `SELECT sr.*, rt.table_number
         FROM public.service_requests sr
         JOIN public.restaurant_tables rt ON rt.id = sr.table_id
         WHERE sr.id = $1 FOR UPDATE`,
        [requestId]
      );

      if (srRes.rows.length === 0) {
        throw new NotFoundError(`Service request '${requestId}'`);
      }

      const sr = srRes.rows[0];

      if (sr.status === 'RESOLVED' || sr.status === 'CANCELLED') {
        throw new ConflictError(
          `Service request is already in '${sr.status}' status`
        );
      }

      const updateRes = await client.query(
        `UPDATE public.service_requests
         SET status = 'RESOLVED',
             resolved_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [requestId]
      );
      const updated = updateRes.rows[0];

      // Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'SERVICE_REQUEST_RESOLVED',
          entityType: 'service_requests',
          entityId: requestId,
          outletId: sr.outlet_id,
          oldState: { status: sr.status },
          newState: { status: 'RESOLVED' },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // Event log
      await publishOutletEvent(
        {
          outletId: sr.outlet_id,
          channel: 'service_requests',
          eventType: 'SERVICE_REQUEST_RESOLVED',
          entityId: requestId,
          payload: {
            requestId,
            tableNumber: sr.table_number,
            status: 'RESOLVED'
          }
        },
        client
      );

      return {
        id: updated.id,
        outletId: updated.outlet_id,
        diningSessionId: updated.dining_session_id,
        tableId: updated.table_id,
        tableNumber: sr.table_number,
        requestType: updated.request_type,
        status: updated.status,
        acknowledgedByStaffId: updated.acknowledged_by_staff_id,
        acknowledgedByName: null,
        acknowledgedAt: updated.acknowledged_at ? updated.acknowledged_at.toISOString() : null,
        resolvedAt: updated.resolved_at ? updated.resolved_at.toISOString() : null,
        createdAt: updated.created_at.toISOString ? updated.created_at.toISOString() : String(updated.created_at)
      };
    });
  }

  static async listOutletServiceRequests(params: {
    outletId: string;
    status?: string[];
    limit?: number;
    cursor?: string;
  }): Promise<{ items: ServiceRequestResponse[]; total: number; nextCursor: string | null }> {
    const { outletId, status, limit = 50, cursor } = params;
    const pool = getDbPool();

    // Default status: PENDING and ACKNOWLEDGED if omitted or empty
    const statusesToQuery = status && status.length > 0 ? status : ['PENDING', 'ACKNOWLEDGED'];

    const conditions: string[] = ['sr.outlet_id = $1', 'sr.status = ANY($2::text[])'];
    const values: any[] = [outletId, statusesToQuery];
    let paramIndex = 3;

    if (cursor) {
      conditions.push(`sr.created_at < $${paramIndex++}`);
      values.push(cursor);
    }

    const whereClause = conditions.join(' AND ');

    // Total count for the filter
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM public.service_requests sr
       WHERE sr.outlet_id = $1 AND sr.status = ANY($2::text[]);`,
      [outletId, statusesToQuery]
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const listQuery = `
      SELECT
        sr.id,
        sr.outlet_id,
        sr.dining_session_id,
        sr.table_id,
        rt.table_number,
        sr.request_type,
        sr.status,
        sr.acknowledged_by_staff_id,
        TRIM(CONCAT(s.first_name, ' ', s.last_name)) AS acknowledged_by_name,
        c.phone AS guest_phone,
        sr.created_at,
        sr.acknowledged_at,
        sr.resolved_at
      FROM public.service_requests sr
      JOIN public.restaurant_tables rt ON sr.table_id = rt.id
      LEFT JOIN public.dining_sessions ds ON sr.dining_session_id = ds.id
      LEFT JOIN public.customers c ON ds.customer_id = c.id
      LEFT JOIN public.staff s ON sr.acknowledged_by_staff_id = s.id
      WHERE ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT $${paramIndex++};
    `;

    const listRes = await pool.query(listQuery, [...values, limit]);

    const items: ServiceRequestResponse[] = listRes.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      diningSessionId: row.dining_session_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      requestType: row.request_type,
      status: row.status,
      acknowledgedByStaffId: row.acknowledged_by_staff_id || null,
      acknowledgedByName: row.acknowledged_by_name ? row.acknowledged_by_name.trim() : null,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      guestPhone: row.guest_phone ? maskPhoneNumber(row.guest_phone) : null
    }));

    const nextCursor =
      items.length === limit && items.length > 0
        ? items[items.length - 1].createdAt
        : null;

    return {
      items,
      total,
      nextCursor
    };
  }
}

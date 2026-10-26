import pg from 'pg';
import crypto from 'node:crypto';
import { getDbPool, withTransaction } from '../../db/pool.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  UnprocessableEntityError
} from '../../utils/errors.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import { maskPhoneNumber } from '../../utils/sanitizer.js';
import {
  RoomStatus,
  IdProofType,
  ReservationStatus,
  StayStatus,
  FolioStatus,
  ChargeType,
  HotelRoomResponse,
  HotelGuestResponse,
  HotelReservationResponse,
  HotelStayResponse,
  RoomFolioResponse,
  FolioChargeResponse
} from './hotel.types.js';

function formatDate(val: any): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function formatDateOnly(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  const d = new Date(val);
  return d.toISOString().split('T')[0];
}

function mapRoomRow(row: any): HotelRoomResponse {
  return {
    id: row.id,
    propertyId: row.property_id,
    roomNumber: row.room_number,
    roomType: row.room_type,
    floor: row.floor,
    status: row.status as RoomStatus,
    baseTariffPaise: parseInt(row.base_tariff_paise, 10),
    isActive: row.is_active,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString()
  };
}

function mapGuestRow(row: any): HotelGuestResponse {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: maskPhoneNumber(row.phone),
    email: row.email || null,
    idProofType: row.id_proof_type as IdProofType,
    nationality: row.nationality,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString()
  };
}

function mapReservationRow(row: any): HotelReservationResponse {
  let guestInfo: HotelReservationResponse['guest'] | undefined;
  if (row.first_name || row.last_name) {
    guestInfo = {
      id: row.guest_id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: maskPhoneNumber(row.phone || ''),
      email: row.email || null
    };
  }

  return {
    id: row.id,
    propertyId: row.property_id,
    guestId: row.guest_id,
    bookingReference: row.booking_reference,
    checkInDate: formatDateOnly(row.check_in_date),
    checkOutDate: formatDateOnly(row.check_out_date),
    status: row.status as ReservationStatus,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    guest: guestInfo
  };
}

function mapStayRow(row: any): HotelStayResponse {
  let roomInfo: HotelStayResponse['room'] | undefined;
  if (row.room_number) {
    roomInfo = {
      id: row.room_id,
      roomNumber: row.room_number,
      roomType: row.room_type,
      floor: row.floor,
      baseTariffPaise: parseInt(row.base_tariff_paise || '0', 10)
    };
  }

  let guestInfo: HotelStayResponse['guest'] | undefined;
  if (row.first_name || row.last_name) {
    guestInfo = {
      id: row.guest_id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: maskPhoneNumber(row.phone || ''),
      email: row.email || null
    };
  }

  let folioInfo: HotelStayResponse['folio'] | undefined;
  if (row.folio_id) {
    folioInfo = {
      id: row.folio_id,
      status: row.folio_status as FolioStatus,
      totalChargesPaise: parseInt(row.total_charges_paise || '0', 10),
      totalPaymentsPaise: parseInt(row.total_payments_paise || '0', 10),
      outstandingBalancePaise: parseInt(row.outstanding_balance_paise || '0', 10)
    };
  }

  return {
    id: row.id,
    roomId: row.room_id,
    guestId: row.guest_id,
    reservationId: row.reservation_id || null,
    checkInAt: formatDate(row.check_in_at) || new Date().toISOString(),
    expectedCheckOutAt: formatDate(row.expected_check_out_at) || new Date().toISOString(),
    actualCheckOutAt: formatDate(row.actual_check_out_at),
    status: row.status as StayStatus,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString(),
    room: roomInfo,
    guest: guestInfo,
    folio: folioInfo
  };
}

function mapFolioRow(row: any, charges: FolioChargeResponse[] = []): RoomFolioResponse {
  return {
    id: row.id,
    stayId: row.stay_id,
    status: row.status as FolioStatus,
    totalChargesPaise: parseInt(row.total_charges_paise, 10),
    totalPaymentsPaise: parseInt(row.total_payments_paise, 10),
    outstandingBalancePaise: parseInt(row.outstanding_balance_paise, 10),
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString(),
    charges
  };
}

function mapChargeRow(row: any): FolioChargeResponse {
  return {
    id: row.id,
    folioId: row.folio_id,
    chargeType: row.charge_type as ChargeType,
    outletId: row.outlet_id || null,
    billId: row.bill_id || null,
    amountPaise: parseInt(row.amount_paise, 10),
    description: row.description,
    postedByStaffId: row.posted_by_staff_id,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    outletName: row.outlet_name || null,
    postedByStaffName: row.posted_by_staff_name || null
  };
}

export class HotelService {
  private static async getPropertyId(client?: pg.PoolClient): Promise<string> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query('SELECT id FROM public.properties LIMIT 1;');
    if (res.rows.length === 0) {
      throw new NotFoundError('Property');
    }
    return res.rows[0].id;
  }

  // ==========================================================================
  // 1. HOTEL ROOMS
  // ==========================================================================

  static async listRooms(params: {
    status?: RoomStatus;
    roomType?: string;
    floor?: number;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: HotelRoomResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`status = $${idx++}`);
      values.push(params.status);
    }
    if (params.roomType) {
      conditions.push(`room_type ILIKE $${idx++}`);
      values.push(`%${params.roomType}%`);
    }
    if (params.floor !== undefined) {
      conditions.push(`floor = $${idx++}`);
      values.push(params.floor);
    }
    if (params.isActive !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      values.push(params.isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.hotel_rooms ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const dataValues = [...values, limit, offset];

    const dataRes = await pool.query(
      `SELECT * FROM public.hotel_rooms
       ${whereClause}
       ORDER BY floor ASC, room_number ASC
       LIMIT $${idx++} OFFSET $${idx++};`,
      dataValues
    );

    return {
      items: dataRes.rows.map(mapRoomRow),
      total
    };
  }

  static async getRoomById(roomId: string, client?: pg.PoolClient): Promise<HotelRoomResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      'SELECT * FROM public.hotel_rooms WHERE id = $1;',
      [roomId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Hotel room '${roomId}'`);
    }
    return mapRoomRow(res.rows[0]);
  }

  static async updateRoomStatus(params: {
    roomId: string;
    status: RoomStatus;
    notes?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelRoomResponse> {
    const { roomId, status, notes, staffId, reqCorrelationId, ipAddress } = params;

    const updated = await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [roomId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Hotel room '${roomId}'`);
      }
      const cur = curRes.rows[0];

      if (cur.status === status) {
        return mapRoomRow(cur);
      }

      const updateRes = await client.query(
        `UPDATE public.hotel_rooms
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *;`,
        [status, roomId]
      );

      // Append room_status_history
      await client.query(
        `INSERT INTO public.room_status_history (
          room_id, from_status, to_status, changed_by_staff_id
        ) VALUES ($1, $2, $3, $4);`,
        [roomId, cur.status, status, staffId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'ROOM_STATUS_CHANGED',
          entityType: 'hotel_rooms',
          entityId: roomId,
          outletId: null,
          oldState: { status: cur.status },
          newState: { status, notes },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapRoomRow(updateRes.rows[0]);
    });

    realtimeBroadcaster
      .publish({
        outletId: 'hotel',
        channel: 'hotel_rooms',
        sequenceNumber: 1,
        eventType: 'ROOM_STATUS_CHANGED',
        payload: {
          roomId: updated.id,
          roomNumber: updated.roomNumber,
          status: updated.status
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return updated;
  }

  // ==========================================================================
  // 2. HOTEL GUESTS (PRIVACY-PRESERVING PII VAULT)
  // ==========================================================================

  static async createGuest(params: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    idProofType: IdProofType;
    idProofNumber: string;
    nationality?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelGuestResponse> {
    const {
      firstName,
      lastName,
      phone,
      email,
      idProofType,
      idProofNumber,
      nationality = 'Indian',
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    const normalizedPhone = phone.trim();
    // Deterministic SHA-256 HMAC / digest for ID proof verification
    const idProofNumberHash = crypto
      .createHash('sha256')
      .update(`${idProofType}:${idProofNumber.trim().toUpperCase()}`)
      .digest('hex');

    return await withTransaction(async (client) => {
      // Check phone uniqueness
      const existingRes = await client.query(
        'SELECT id FROM public.hotel_guests WHERE phone = $1;',
        [normalizedPhone]
      );
      if (existingRes.rows.length > 0) {
        throw new ConflictError(`Hotel guest with phone '${maskPhoneNumber(normalizedPhone)}' already exists`);
      }

      const insertQuery = `
        INSERT INTO public.hotel_guests (
          first_name, last_name, phone, email,
          id_proof_type, id_proof_number_hash, nationality
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const res = await client.query(insertQuery, [
        firstName.trim(),
        lastName.trim(),
        normalizedPhone,
        email ? email.trim() : null,
        idProofType,
        idProofNumberHash,
        nationality.trim()
      ]);

      const guest = res.rows[0];

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOTEL_GUEST_CREATED',
          entityType: 'hotel_guests',
          entityId: guest.id,
          outletId: null,
          oldState: null,
          newState: {
            guestId: guest.id,
            firstName: guest.first_name,
            lastName: guest.last_name,
            idProofType: guest.id_proof_type
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapGuestRow(guest);
    });
  }

  static async searchGuests(params: {
    search?: string;
    phone?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: HotelGuestResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.phone) {
      conditions.push(`phone = $${idx++}`);
      values.push(params.phone.trim());
    }
    if (params.search) {
      conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.hotel_guests ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const dataValues = [...values, limit, offset];

    const dataRes = await pool.query(
      `SELECT * FROM public.hotel_guests
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      dataValues
    );

    return {
      items: dataRes.rows.map(mapGuestRow),
      total
    };
  }

  static async getGuestById(guestId: string, client?: pg.PoolClient): Promise<HotelGuestResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      'SELECT * FROM public.hotel_guests WHERE id = $1;',
      [guestId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Hotel guest '${guestId}'`);
    }
    return mapGuestRow(res.rows[0]);
  }

  static async updateGuest(params: {
    guestId: string;
    firstName?: string;
    lastName?: string;
    email?: string | null;
    nationality?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelGuestResponse> {
    const { guestId, firstName, lastName, email, nationality, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.hotel_guests WHERE id = $1 FOR UPDATE;',
        [guestId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Hotel guest '${guestId}'`);
      }
      const cur = curRes.rows[0];

      const newFirst = firstName !== undefined ? firstName.trim() : cur.first_name;
      const newLast = lastName !== undefined ? lastName.trim() : cur.last_name;
      const newEmail = email !== undefined ? (email ? email.trim() : null) : cur.email;
      const newNat = nationality !== undefined ? nationality.trim() : cur.nationality;

      const updateRes = await client.query(
        `UPDATE public.hotel_guests
         SET first_name = $1, last_name = $2, email = $3, nationality = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *;`,
        [newFirst, newLast, newEmail, newNat, guestId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOTEL_GUEST_UPDATED',
          entityType: 'hotel_guests',
          entityId: guestId,
          outletId: null,
          oldState: { firstName: cur.first_name, lastName: cur.last_name, email: cur.email },
          newState: { firstName: newFirst, lastName: newLast, email: newEmail },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapGuestRow(updateRes.rows[0]);
    });
  }

  // ==========================================================================
  // 3. HOTEL RESERVATIONS
  // ==========================================================================

  static async createReservation(params: {
    guestId: string;
    checkInDate: string;
    checkOutDate: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelReservationResponse> {
    const { guestId, checkInDate, checkOutDate, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const propertyId = await HotelService.getPropertyId(client);

      // Verify guest exists
      const guestRes = await client.query(
        'SELECT id, first_name, last_name, phone, email FROM public.hotel_guests WHERE id = $1;',
        [guestId]
      );
      if (guestRes.rows.length === 0) {
        throw new NotFoundError(`Hotel guest '${guestId}'`);
      }
      const guest = guestRes.rows[0];

      // Generate unique booking reference
      const bookingRef = `RES-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const insertQuery = `
        INSERT INTO public.hotel_reservations (
          property_id, guest_id, booking_reference, check_in_date, check_out_date, status
        ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')
        RETURNING *;
      `;
      const res = await client.query(insertQuery, [
        propertyId,
        guestId,
        bookingRef,
        checkInDate,
        checkOutDate
      ]);

      const reservation = res.rows[0];

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOTEL_RESERVATION_CREATED',
          entityType: 'hotel_reservations',
          entityId: reservation.id,
          outletId: null,
          oldState: null,
          newState: {
            reservationId: reservation.id,
            bookingReference: bookingRef,
            guestId,
            checkInDate,
            checkOutDate
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapReservationRow({ ...guest, ...reservation, id: reservation.id, guest_id: guest.id });
    });
  }

  static async listReservations(params: {
    status?: ReservationStatus;
    guestId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: HotelReservationResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`r.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.guestId) {
      conditions.push(`r.guest_id = $${idx++}`);
      values.push(params.guestId);
    }
    if (params.startDate) {
      conditions.push(`r.check_in_date >= $${idx++}`);
      values.push(params.startDate);
    }
    if (params.endDate) {
      conditions.push(`r.check_out_date <= $${idx++}`);
      values.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.hotel_reservations r ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const dataValues = [...values, limit, offset];

    const dataRes = await pool.query(
      `SELECT 
        r.*,
        g.first_name,
        g.last_name,
        g.phone,
        g.email
       FROM public.hotel_reservations r
       JOIN public.hotel_guests g ON g.id = r.guest_id
       ${whereClause}
       ORDER BY r.check_in_date ASC, r.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      dataValues
    );

    return {
      items: dataRes.rows.map(mapReservationRow),
      total
    };
  }

  static async getReservationById(reservationId: string, client?: pg.PoolClient): Promise<HotelReservationResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      `SELECT 
        r.*,
        g.first_name,
        g.last_name,
        g.phone,
        g.email
       FROM public.hotel_reservations r
       JOIN public.hotel_guests g ON g.id = r.guest_id
       WHERE r.id = $1;`,
      [reservationId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Hotel reservation '${reservationId}'`);
    }
    return mapReservationRow(res.rows[0]);
  }

  static async cancelReservation(params: {
    reservationId: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelReservationResponse> {
    const { reservationId, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.hotel_reservations WHERE id = $1 FOR UPDATE;',
        [reservationId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Hotel reservation '${reservationId}'`);
      }
      const cur = curRes.rows[0];

      if (cur.status === 'CANCELLED') {
        return mapReservationRow(cur);
      }
      if (cur.status !== 'CONFIRMED') {
        throw new ConflictError(`Cannot cancel reservation in status '${cur.status}'`);
      }

      const updateRes = await client.query(
        `UPDATE public.hotel_reservations
         SET status = 'CANCELLED'
         WHERE id = $1
         RETURNING *;`,
        [reservationId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOTEL_RESERVATION_CANCELLED',
          entityType: 'hotel_reservations',
          entityId: reservationId,
          outletId: null,
          oldState: { status: cur.status },
          newState: { status: 'CANCELLED' },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapReservationRow(updateRes.rows[0]);
    });
  }

  // ==========================================================================
  // 4. CHECK-IN (TRANSACTIONAL ROOM OCCUPANCY & OPEN FOLIO)
  // ==========================================================================

  static async checkIn(params: {
    roomId: string;
    guestId: string;
    reservationId?: string | null;
    expectedCheckOutAt: string;
    initialTariffPaise?: number;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelStayResponse> {
    const {
      roomId,
      guestId,
      reservationId,
      expectedCheckOutAt,
      initialTariffPaise,
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    const stay = await withTransaction(async (client) => {
      // 1. Lock room FOR UPDATE
      const roomRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [roomId]
      );
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Hotel room '${roomId}'`);
      }
      const room = roomRes.rows[0];

      if (!room.is_active) {
        throw new UnprocessableEntityError(`Room '${room.room_number}' is inactive`);
      }

      // Check room readiness
      if (room.status !== 'AVAILABLE' && room.status !== 'RESERVED') {
        throw new ConflictError(
          `Room '${room.room_number}' is in status '${room.status}' and cannot be checked in. Room must be 'AVAILABLE' or 'RESERVED'.`
        );
      }

      // 2. Validate no active stay exists for room
      const activeStayRes = await client.query(
        "SELECT id FROM public.hotel_stays WHERE room_id = $1 AND status = 'CHECKED_IN';",
        [roomId]
      );
      if (activeStayRes.rows.length > 0) {
        throw new ConflictError(`Room '${room.room_number}' already has an active checked-in stay`);
      }

      // 3. Verify guest exists
      const guestRes = await client.query(
        'SELECT id, first_name, last_name, phone, email FROM public.hotel_guests WHERE id = $1;',
        [guestId]
      );
      if (guestRes.rows.length === 0) {
        throw new NotFoundError(`Hotel guest '${guestId}'`);
      }
      const guest = guestRes.rows[0];

      // 4. If reservationId provided, lock and validate reservation
      if (reservationId) {
        const resRes = await client.query(
          'SELECT * FROM public.hotel_reservations WHERE id = $1 FOR UPDATE;',
          [reservationId]
        );
        if (resRes.rows.length === 0) {
          throw new NotFoundError(`Reservation '${reservationId}'`);
        }
        const resObj = resRes.rows[0];
        if (resObj.status !== 'CONFIRMED') {
          throw new ConflictError(`Reservation '${resObj.booking_reference}' is '${resObj.status}', cannot check in`);
        }
        await client.query(
          "UPDATE public.hotel_reservations SET status = 'CHECKED_IN' WHERE id = $1;",
          [reservationId]
        );
      }

      // 5. Create hotel_stays record
      const stayInsertQuery = `
        INSERT INTO public.hotel_stays (
          room_id, guest_id, reservation_id, check_in_at, expected_check_out_at, status
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'CHECKED_IN')
        RETURNING *;
      `;
      const stayRes = await client.query(stayInsertQuery, [
        roomId,
        guestId,
        reservationId || null,
        expectedCheckOutAt
      ]);
      const createdStay = stayRes.rows[0];

      // 6. Create open room_folios record
      const folioInsertQuery = `
        INSERT INTO public.room_folios (
          stay_id, status, total_charges_paise, total_payments_paise, outstanding_balance_paise
        ) VALUES ($1, 'OPEN', 0, 0, 0)
        RETURNING *;
      `;
      const folioRes = await client.query(folioInsertQuery, [createdStay.id]);
      const createdFolio = folioRes.rows[0];

      // 7. Post initial tariff charge if specified or room base tariff
      const tariffToPost = initialTariffPaise !== undefined ? initialTariffPaise : parseInt(room.base_tariff_paise, 10);
      if (tariffToPost > 0) {
        await client.query(
          `INSERT INTO public.folio_charges (
            folio_id, charge_type, amount_paise, description, posted_by_staff_id
          ) VALUES ($1, 'ROOM_TARIFF', $2, $3, $4);`,
          [
            createdFolio.id,
            tariffToPost,
            `Room ${room.room_number} Base Tariff Check-In Charge`,
            staffId
          ]
        );

        await client.query(
          `UPDATE public.room_folios
           SET total_charges_paise = $1, outstanding_balance_paise = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2;`,
          [tariffToPost, createdFolio.id]
        );
      }

      // 8. Transition room to OCCUPIED
      await client.query(
        "UPDATE public.hotel_rooms SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
        [roomId]
      );

      // 9. Append room_status_history
      await client.query(
        `INSERT INTO public.room_status_history (
          room_id, from_status, to_status, changed_by_staff_id
        ) VALUES ($1, $2, 'OCCUPIED', $3);`,
        [roomId, room.status, staffId]
      );

      // 10. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOTEL_GUEST_CHECKED_IN',
          entityType: 'hotel_stays',
          entityId: createdStay.id,
          outletId: null,
          oldState: { roomStatus: room.status },
          newState: {
            stayId: createdStay.id,
            roomId,
            guestId,
            reservationId: reservationId || null,
            roomNumber: room.room_number,
            tariffChargedPaise: tariffToPost
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapStayRow({
        ...createdStay,
        room_number: room.room_number,
        room_type: room.room_type,
        floor: room.floor,
        base_tariff_paise: room.base_tariff_paise,
        first_name: guest.first_name,
        last_name: guest.last_name,
        phone: guest.phone,
        email: guest.email,
        folio_id: createdFolio.id,
        folio_status: 'OPEN',
        total_charges_paise: tariffToPost,
        total_payments_paise: 0,
        outstanding_balance_paise: tariffToPost
      });
    });

    realtimeBroadcaster
      .publish({
        outletId: 'hotel',
        channel: 'hotel_stays',
        sequenceNumber: 1,
        eventType: 'GUEST_CHECKED_IN',
        payload: {
          stayId: stay.id,
          roomId: stay.roomId,
          roomNumber: stay.room?.roomNumber,
          guestName: `${stay.guest?.firstName} ${stay.guest?.lastName}`
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return stay;
  }

  // ==========================================================================
  // 5. HOTEL STAYS MANAGEMENT
  // ==========================================================================

  static async listStays(params: {
    status?: StayStatus;
    roomId?: string;
    guestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: HotelStayResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`s.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.roomId) {
      conditions.push(`s.room_id = $${idx++}`);
      values.push(params.roomId);
    }
    if (params.guestId) {
      conditions.push(`s.guest_id = $${idx++}`);
      values.push(params.guestId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.hotel_stays s ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const dataValues = [...values, limit, offset];

    const dataRes = await pool.query(
      `SELECT 
        s.*,
        r.room_number,
        r.room_type,
        r.floor,
        r.base_tariff_paise,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        f.id AS folio_id,
        f.status AS folio_status,
        f.total_charges_paise,
        f.total_payments_paise,
        f.outstanding_balance_paise
       FROM public.hotel_stays s
       JOIN public.hotel_rooms r ON r.id = s.room_id
       JOIN public.hotel_guests g ON g.id = s.guest_id
       LEFT JOIN public.room_folios f ON f.stay_id = s.id AND f.status = 'OPEN'
       ${whereClause}
       ORDER BY s.check_in_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      dataValues
    );

    return {
      items: dataRes.rows.map(mapStayRow),
      total
    };
  }

  static async getStayById(stayId: string, client?: pg.PoolClient): Promise<HotelStayResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      `SELECT 
        s.*,
        r.room_number,
        r.room_type,
        r.floor,
        r.base_tariff_paise,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        f.id AS folio_id,
        f.status AS folio_status,
        f.total_charges_paise,
        f.total_payments_paise,
        f.outstanding_balance_paise
       FROM public.hotel_stays s
       JOIN public.hotel_rooms r ON r.id = s.room_id
       JOIN public.hotel_guests g ON g.id = s.guest_id
       LEFT JOIN public.room_folios f ON f.stay_id = s.id AND f.status = 'OPEN'
       WHERE s.id = $1;`,
      [stayId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Hotel stay '${stayId}'`);
    }
    return mapStayRow(res.rows[0]);
  }

  static async getActiveStayByRoomId(roomId: string, client?: pg.PoolClient): Promise<HotelStayResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      `SELECT 
        s.*,
        r.room_number,
        r.room_type,
        r.floor,
        r.base_tariff_paise,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        f.id AS folio_id,
        f.status AS folio_status,
        f.total_charges_paise,
        f.total_payments_paise,
        f.outstanding_balance_paise
       FROM public.hotel_stays s
       JOIN public.hotel_rooms r ON r.id = s.room_id
       JOIN public.hotel_guests g ON g.id = s.guest_id
       LEFT JOIN public.room_folios f ON f.stay_id = s.id AND f.status = 'OPEN'
       WHERE s.room_id = $1 AND s.status = 'CHECKED_IN';`,
      [roomId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Active checked-in stay for room '${roomId}'`);
    }
    return mapStayRow(res.rows[0]);
  }

  // ==========================================================================
  // 6. ROOM FOLIO & CHARGES
  // ==========================================================================

  static async getFolioByStayId(stayId: string, client?: pg.PoolClient): Promise<RoomFolioResponse> {
    const queryRunner = client || getDbPool();
    const folioRes = await queryRunner.query(
      'SELECT * FROM public.room_folios WHERE stay_id = $1 ORDER BY created_at DESC LIMIT 1;',
      [stayId]
    );
    if (folioRes.rows.length === 0) {
      throw new NotFoundError(`Room folio for stay '${stayId}'`);
    }
    const folio = folioRes.rows[0];

    const chargesRes = await queryRunner.query(
      `SELECT 
        fc.*,
        o.name AS outlet_name,
        st.first_name || ' ' || st.last_name AS posted_by_staff_name
       FROM public.folio_charges fc
       LEFT JOIN public.outlets o ON o.id = fc.outlet_id
       LEFT JOIN public.staff st ON st.id = fc.posted_by_staff_id
       WHERE fc.folio_id = $1
       ORDER BY fc.created_at ASC;`,
      [folio.id]
    );

    return mapFolioRow(folio, chargesRes.rows.map(mapChargeRow));
  }

  static async getFolioById(folioId: string, client?: pg.PoolClient): Promise<RoomFolioResponse> {
    const queryRunner = client || getDbPool();
    const folioRes = await queryRunner.query(
      'SELECT * FROM public.room_folios WHERE id = $1;',
      [folioId]
    );
    if (folioRes.rows.length === 0) {
      throw new NotFoundError(`Room folio '${folioId}'`);
    }
    const folio = folioRes.rows[0];

    const chargesRes = await queryRunner.query(
      `SELECT 
        fc.*,
        o.name AS outlet_name,
        st.first_name || ' ' || st.last_name AS posted_by_staff_name
       FROM public.folio_charges fc
       LEFT JOIN public.outlets o ON o.id = fc.outlet_id
       LEFT JOIN public.staff st ON st.id = fc.posted_by_staff_id
       WHERE fc.folio_id = $1
       ORDER BY fc.created_at ASC;`,
      [folioId]
    );

    return mapFolioRow(folio, chargesRes.rows.map(mapChargeRow));
  }

  static async postFolioCharge(params: {
    folioId: string;
    chargeType: ChargeType;
    amountPaise: number;
    description: string;
    outletId?: string | null;
    billId?: string | null;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<FolioChargeResponse> {
    const { folioId, chargeType, amountPaise, description, outletId, billId, staffId, reqCorrelationId, ipAddress } = params;

    if (amountPaise <= 0) {
      throw new BadRequestError('Charge amount must be positive integer paise');
    }

    return await withTransaction(async (client) => {
      // 1. Lock folio FOR UPDATE
      const folioRes = await client.query(
        'SELECT * FROM public.room_folios WHERE id = $1 FOR UPDATE;',
        [folioId]
      );
      if (folioRes.rows.length === 0) {
        throw new NotFoundError(`Room folio '${folioId}'`);
      }
      const folio = folioRes.rows[0];

      if (folio.status !== 'OPEN') {
        throw new ConflictError(`Cannot post charge to room folio in status '${folio.status}'`);
      }

      // 2. Validate outlet if provided
      if (outletId) {
        const outRes = await client.query('SELECT id FROM public.outlets WHERE id = $1;', [outletId]);
        if (outRes.rows.length === 0) {
          throw new NotFoundError(`Outlet '${outletId}'`);
        }
      }

      // 3. Validate bill if provided
      if (billId) {
        const billRes = await client.query('SELECT id FROM public.bills WHERE id = $1;', [billId]);
        if (billRes.rows.length === 0) {
          throw new NotFoundError(`Bill '${billId}'`);
        }
      }

      // 4. Insert charge
      const insertQuery = `
        INSERT INTO public.folio_charges (
          folio_id, charge_type, outlet_id, bill_id, amount_paise, description, posted_by_staff_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const chargeRes = await client.query(insertQuery, [
        folioId,
        chargeType,
        outletId || null,
        billId || null,
        amountPaise,
        description.trim(),
        staffId
      ]);
      const charge = chargeRes.rows[0];

      // 5. Update folio balances
      const currentCharges = parseInt(folio.total_charges_paise, 10);
      const currentOutstanding = parseInt(folio.outstanding_balance_paise, 10);

      const newCharges = currentCharges + amountPaise;
      const newOutstanding = currentOutstanding + amountPaise;

      await client.query(
        `UPDATE public.room_folios
         SET total_charges_paise = $1, outstanding_balance_paise = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3;`,
        [newCharges, newOutstanding, folioId]
      );

      // 6. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'FOLIO_CHARGE_POSTED',
          entityType: 'folio_charges',
          entityId: charge.id,
          outletId: outletId || null,
          oldState: {
            totalChargesPaise: currentCharges,
            outstandingBalancePaise: currentOutstanding
          },
          newState: {
            chargeId: charge.id,
            chargeType,
            amountPaise,
            description,
            totalChargesPaise: newCharges,
            outstandingBalancePaise: newOutstanding
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapChargeRow(charge);
    });
  }

  // ==========================================================================
  // 7. CHECKOUT (TRANSACTIONAL SETTLEMENT, STAY CLOSE, DIRTY ROOM & HOUSEKEEPING)
  // ==========================================================================

  static async checkout(params: {
    stayId: string;
    notes?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HotelStayResponse> {
    const { stayId, notes, staffId, reqCorrelationId, ipAddress } = params;

    const checkedOutStay = await withTransaction(async (client) => {
      // 1. Lock stay FOR UPDATE
      const stayRes = await client.query(
        'SELECT * FROM public.hotel_stays WHERE id = $1 FOR UPDATE;',
        [stayId]
      );
      if (stayRes.rows.length === 0) {
        throw new NotFoundError(`Hotel stay '${stayId}'`);
      }
      const stay = stayRes.rows[0];

      if (stay.status === 'CHECKED_OUT') {
        throw new ConflictError('Stay is already checked out');
      }

      // 2. Lock room FOR UPDATE
      const roomRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [stay.room_id]
      );
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Room '${stay.room_id}'`);
      }
      const room = roomRes.rows[0];

      // 3. Lock open folio FOR UPDATE
      const folioRes = await client.query(
        "SELECT * FROM public.room_folios WHERE stay_id = $1 AND status = 'OPEN' FOR UPDATE;",
        [stayId]
      );

      if (folioRes.rows.length > 0) {
        const folio = folioRes.rows[0];
        const outstanding = parseInt(folio.outstanding_balance_paise, 10);
        if (outstanding > 0) {
          throw new ConflictError(
            `Cannot checkout: Room folio has an outstanding balance of ${outstanding} paise (₹${(outstanding / 100).toFixed(2)}). All folio charges must be settled prior to checkout.`
          );
        }

        // Settle folio
        await client.query(
          "UPDATE public.room_folios SET status = 'SETTLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [folio.id]
        );
      }

      // 4. Close stay with actual check-out timestamp
      const updateStayRes = await client.query(
        `UPDATE public.hotel_stays
         SET status = 'CHECKED_OUT', actual_check_out_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *;`,
        [stayId]
      );
      const updatedStay = updateStayRes.rows[0];

      // 5. Transition room to DIRTY (never automatically AVAILABLE!)
      await client.query(
        "UPDATE public.hotel_rooms SET status = 'DIRTY', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
        [room.id]
      );

      // 6. Automatically insert CHECKOUT_CLEANING housekeeping task (Table 46)
      await client.query(
        `INSERT INTO public.housekeeping_tasks (
          room_id, task_type, status, notes
        ) VALUES ($1, 'CHECKOUT_CLEANING', 'PENDING', $2);`,
        [room.id, notes || 'Generated automatically upon guest checkout']
      );

      // 7. Append room_status_history (Table 47)
      await client.query(
        `INSERT INTO public.room_status_history (
          room_id, from_status, to_status, changed_by_staff_id
        ) VALUES ($1, 'OCCUPIED', 'DIRTY', $2);`,
        [room.id, staffId]
      );

      // 8. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOTEL_GUEST_CHECKED_OUT',
          entityType: 'hotel_stays',
          entityId: stayId,
          outletId: null,
          oldState: {
            stayStatus: 'CHECKED_IN',
            roomStatus: room.status
          },
          newState: {
            stayStatus: 'CHECKED_OUT',
            roomStatus: 'DIRTY',
            notes
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapStayRow({
        ...updatedStay,
        room_number: room.room_number,
        room_type: room.room_type,
        floor: room.floor,
        base_tariff_paise: room.base_tariff_paise
      });
    });

    realtimeBroadcaster
      .publish({
        outletId: 'hotel',
        channel: 'hotel_stays',
        sequenceNumber: 1,
        eventType: 'GUEST_CHECKED_OUT',
        payload: {
          stayId: checkedOutStay.id,
          roomId: checkedOutStay.roomId,
          roomNumber: checkedOutStay.room?.roomNumber
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return checkedOutStay;
  }
}

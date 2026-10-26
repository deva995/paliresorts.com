import { Request, Response, NextFunction } from 'express';
import { HotelService } from './hotel.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { RoomStatus, ReservationStatus, StayStatus, ChargeType, IdProofType } from './hotel.types.js';

// ============================================================================
// 1. HOTEL ROOMS CONTROLLERS
// ============================================================================

export async function listRooms(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, roomType, floor, isActive, limit, offset } = req.query as any;
    const result = await HotelService.listRooms({
      status: status as RoomStatus | undefined,
      roomType: roomType as string | undefined,
      floor: floor !== undefined ? parseInt(floor as string, 10) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === true : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;
    const room = await HotelService.getRoomById(roomId);
    res.status(200).json(room);
  } catch (err) {
    next(err);
  }
}

export async function updateRoomStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { roomId } = req.params;
    const { status, notes } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const room = await HotelService.updateRoomStatus({
      roomId,
      status: status as RoomStatus,
      notes,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(room);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 2. HOTEL GUESTS CONTROLLERS
// ============================================================================

export async function listGuests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, phone, limit, offset } = req.query as any;
    const result = await HotelService.searchGuests({
      search: search as string | undefined,
      phone: phone as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGuest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { guestId } = req.params;
    const guest = await HotelService.getGuestById(guestId);
    res.status(200).json(guest);
  } catch (err) {
    next(err);
  }
}

export async function createGuest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { firstName, lastName, phone, email, idProofType, idProofNumber, nationality } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const guest = await HotelService.createGuest({
      firstName,
      lastName,
      phone,
      email,
      idProofType: idProofType as IdProofType,
      idProofNumber,
      nationality,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(201).json(guest);
  } catch (err) {
    next(err);
  }
}

export async function updateGuest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { guestId } = req.params;
    const { firstName, lastName, email, nationality } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const guest = await HotelService.updateGuest({
      guestId,
      firstName,
      lastName,
      email,
      nationality,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(guest);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 3. HOTEL RESERVATIONS CONTROLLERS
// ============================================================================

export async function listReservations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, guestId, startDate, endDate, limit, offset } = req.query as any;
    const result = await HotelService.listReservations({
      status: status as ReservationStatus | undefined,
      guestId: guestId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { reservationId } = req.params;
    const reservation = await HotelService.getReservationById(reservationId);
    res.status(200).json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function createReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { guestId, checkInDate, checkOutDate } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `res_${req.staff.id}_${guestId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'RESERVATION_CREATE',
      outletId: null,
      actorStaffId: req.staff.id,
      payload: { guestId, checkInDate, checkOutDate }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const reservation = await HotelService.createReservation({
      guestId,
      checkInDate,
      checkOutDate,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, reservation);
    }

    res.status(201).json(reservation);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

export async function cancelReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { reservationId } = req.params;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const reservation = await HotelService.cancelReservation({
      reservationId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(reservation);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 4. CHECK-IN CONTROLLER
// ============================================================================

export async function checkInGuest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { roomId, guestId, reservationId, expectedCheckOutAt, initialTariffPaise } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `checkin_${req.staff.id}_${roomId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'GUEST_CHECK_IN',
      outletId: null,
      actorStaffId: req.staff.id,
      payload: { roomId, guestId, reservationId: reservationId || null, expectedCheckOutAt, initialTariffPaise }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const stay = await HotelService.checkIn({
      roomId,
      guestId,
      reservationId: reservationId || null,
      expectedCheckOutAt,
      initialTariffPaise,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, stay);
    }

    res.status(201).json(stay);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

// ============================================================================
// 5. HOTEL STAYS CONTROLLERS
// ============================================================================

export async function listStays(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, roomId, guestId, limit, offset } = req.query as any;
    const result = await HotelService.listStays({
      status: status as StayStatus | undefined,
      roomId: roomId as string | undefined,
      guestId: guestId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStay(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { stayId } = req.params;
    const stay = await HotelService.getStayById(stayId);
    res.status(200).json(stay);
  } catch (err) {
    next(err);
  }
}

export async function getStayByRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;
    const stay = await HotelService.getActiveStayByRoomId(roomId);
    res.status(200).json(stay);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 6. ROOM FOLIO CONTROLLERS
// ============================================================================

export async function getStayFolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { stayId } = req.params;
    const folio = await HotelService.getFolioByStayId(stayId);
    res.status(200).json(folio);
  } catch (err) {
    next(err);
  }
}

export async function getFolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { folioId } = req.params;
    const folio = await HotelService.getFolioById(folioId);
    res.status(200).json(folio);
  } catch (err) {
    next(err);
  }
}

export async function postFolioCharge(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { folioId } = req.params;
  const { chargeType, amountPaise, description, outletId, billId } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `charge_${req.staff.id}_${folioId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'FOLIO_CHARGE_POST',
      outletId: outletId || null,
      actorStaffId: req.staff.id,
      payload: { folioId, chargeType, amountPaise, description, outletId: outletId || null, billId: billId || null }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const charge = await HotelService.postFolioCharge({
      folioId,
      chargeType: chargeType as ChargeType,
      amountPaise,
      description,
      outletId,
      billId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, charge);
    }

    res.status(201).json(charge);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

// ============================================================================
// 7. CHECKOUT CONTROLLER
// ============================================================================

export async function checkOutStay(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { stayId } = req.params;
  const { notes } = req.body || {};
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `checkout_${req.staff.id}_${stayId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'GUEST_CHECK_OUT',
      outletId: null,
      actorStaffId: req.staff.id,
      payload: { stayId, notes: notes || null }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const stay = await HotelService.checkout({
      stayId,
      notes,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 200, stay);
    }

    res.status(200).json(stay);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

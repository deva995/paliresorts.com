import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateStaff,
  requireAuth,
  requirePermission,
  requireModuleAccess
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import {
  roomIdParamsSchema,
  guestIdParamsSchema,
  reservationIdParamsSchema,
  stayIdParamsSchema,
  folioIdParamsSchema,
  listRoomsQuerySchema,
  updateRoomStatusBodySchema,
  createGuestBodySchema,
  updateGuestBodySchema,
  listGuestsQuerySchema,
  createReservationBodySchema,
  listReservationsQuerySchema,
  checkInBodySchema,
  listStaysQuerySchema,
  postFolioChargeBodySchema,
  checkOutBodySchema
} from './hotel.validation.js';
import {
  listRooms,
  getRoom,
  updateRoomStatus,
  listGuests,
  getGuest,
  createGuest,
  updateGuest,
  listReservations,
  getReservation,
  createReservation,
  cancelReservation,
  checkInGuest,
  listStays,
  getStay,
  getStayByRoom,
  getStayFolio,
  getFolio,
  postFolioCharge,
  checkOutStay
} from './hotel.controller.js';

export const hotelRouter = Router();

function requireAnyHotelPermission(permissionCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    const hasAny = permissionCodes.some((code) => req.staff!.permissions.includes(code));
    if (!hasAny) {
      return next(
        new ForbiddenError(
          `Staff lacks required permissions: at least one of [${permissionCodes.map((c) => `'${c}'`).join(', ')}] is required`
        )
      );
    }

    next();
  };
}

// ============================================================================
// 1. HOTEL ROOMS
// ============================================================================

hotelRouter.get(
  '/hotel/rooms',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage', 'housekeeping:view']),
  requireModuleAccess('hotel', 'view'),
  validate({ query: listRoomsQuerySchema }),
  listRooms
);

hotelRouter.get(
  '/hotel/rooms/:roomId',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage', 'housekeeping:view']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: roomIdParamsSchema }),
  getRoom
);

hotelRouter.patch(
  '/hotel/rooms/:roomId/status',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:manage', 'housekeeping:update']),
  requireModuleAccess('hotel', 'edit'),
  validate({ params: roomIdParamsSchema, body: updateRoomStatusBodySchema }),
  updateRoomStatus
);

// ============================================================================
// 2. HOTEL GUESTS (PRIVACY-PRESERVING RESTRICTED ENDPOINTS)
// ============================================================================

hotelRouter.get(
  '/hotel/guests',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ query: listGuestsQuerySchema }),
  listGuests
);

hotelRouter.get(
  '/hotel/guests/:guestId',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: guestIdParamsSchema }),
  getGuest
);

hotelRouter.post(
  '/hotel/guests',
  authenticateStaff,
  requireAuth,
  requirePermission('hotel:manage'),
  requireModuleAccess('hotel', 'edit'),
  validate({ body: createGuestBodySchema }),
  createGuest
);

hotelRouter.patch(
  '/hotel/guests/:guestId',
  authenticateStaff,
  requireAuth,
  requirePermission('hotel:manage'),
  requireModuleAccess('hotel', 'edit'),
  validate({ params: guestIdParamsSchema, body: updateGuestBodySchema }),
  updateGuest
);

// ============================================================================
// 3. HOTEL RESERVATIONS
// ============================================================================

hotelRouter.get(
  '/hotel/reservations',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ query: listReservationsQuerySchema }),
  listReservations
);

hotelRouter.get(
  '/hotel/reservations/:reservationId',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: reservationIdParamsSchema }),
  getReservation
);

hotelRouter.post(
  '/hotel/reservations',
  authenticateStaff,
  requireAuth,
  requirePermission('hotel:manage'),
  requireModuleAccess('hotel', 'edit'),
  validate({ body: createReservationBodySchema }),
  createReservation
);

hotelRouter.post(
  '/hotel/reservations/:reservationId/cancel',
  authenticateStaff,
  requireAuth,
  requirePermission('hotel:manage'),
  requireModuleAccess('hotel', 'edit'),
  validate({ params: reservationIdParamsSchema }),
  cancelReservation
);

// ============================================================================
// 4. CHECK-IN
// ============================================================================

hotelRouter.post(
  '/hotel/check-in',
  authenticateStaff,
  requireAuth,
  requirePermission('hotel:manage'),
  requireModuleAccess('hotel', 'edit'),
  validate({ body: checkInBodySchema }),
  checkInGuest
);

// ============================================================================
// 5. HOTEL STAYS
// ============================================================================

hotelRouter.get(
  '/hotel/stays',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ query: listStaysQuerySchema }),
  listStays
);

hotelRouter.get(
  '/hotel/stays/:stayId',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: stayIdParamsSchema }),
  getStay
);

hotelRouter.get(
  '/hotel/rooms/:roomId/stay',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: roomIdParamsSchema }),
  getStayByRoom
);

// ============================================================================
// 6. ROOM FOLIO & CHARGES
// ============================================================================

hotelRouter.get(
  '/hotel/stays/:stayId/folio',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage', 'folio:charge']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: stayIdParamsSchema }),
  getStayFolio
);

hotelRouter.get(
  '/hotel/folios/:folioId',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:view', 'hotel:manage', 'folio:charge']),
  requireModuleAccess('hotel', 'view'),
  validate({ params: folioIdParamsSchema }),
  getFolio
);

hotelRouter.post(
  '/hotel/folios/:folioId/charges',
  authenticateStaff,
  requireAuth,
  requireAnyHotelPermission(['hotel:manage', 'folio:charge']),
  requireModuleAccess('hotel', 'edit'),
  validate({ params: folioIdParamsSchema, body: postFolioChargeBodySchema }),
  postFolioCharge
);

// ============================================================================
// 7. CHECKOUT
// ============================================================================

hotelRouter.post(
  '/hotel/stays/:stayId/checkout',
  authenticateStaff,
  requireAuth,
  requirePermission('hotel:manage'),
  requireModuleAccess('hotel', 'edit'),
  validate({ params: stayIdParamsSchema, body: checkOutBodySchema }),
  checkOutStay
);

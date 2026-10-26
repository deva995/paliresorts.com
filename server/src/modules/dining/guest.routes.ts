import { authenticateStaff, requireAnyPermission, requireModuleAccess } from '../../middleware/auth.js';
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticateGuestSession } from '../../middleware/guestAuth.js';
import {
  resolveQrBodySchema,
  selfSeatQrBodySchema,
  requestGuestOtpBodySchema,
  verifyGuestOtpBodySchema,
  createServiceRequestBodySchema
} from './dining.validation.js';
import {
  resolveTable,
  selfSeatGuest,
  openGuestTable,
  requestOtp,
  verifyOtp,
  getGuestSession,
  createGuestServiceRequest,
  listGuestServiceRequests,
  getGuestMenu,
  logoutGuest
} from './guest.controller.js';

export const guestRouter = Router();

// --------------------------------------------------------------------------
// 1. QR TABLE ONBOARDING
// --------------------------------------------------------------------------

// POST /api/v1/guest/table/resolve
guestRouter.post(
  '/guest/table/resolve',
  validate({ body: resolveQrBodySchema }),
  resolveTable
);

// New sitting only; never attaches a QR scanner to an existing occupied table.
guestRouter.post('/guest/table/self-seat', validate({ body: selfSeatQrBodySchema }), selfSeatGuest);

// POST /api/v1/guest/table/open (authenticated staff seating compatibility endpoint)
guestRouter.post(
  '/guest/table/open',
  authenticateStaff,
  requireAnyPermission(['table:assign','table:manage','order:create']),
  requireModuleAccess('floor','edit'),
  openGuestTable
);

// POST /api/v1/guest/otp/request
guestRouter.post(
  '/guest/otp/request',
  validate({ body: requestGuestOtpBodySchema }),
  requestOtp
);

// POST /api/v1/guest/otp/verify
guestRouter.post(
  '/guest/otp/verify',
  validate({ body: verifyGuestOtpBodySchema }),
  verifyOtp
);

// --------------------------------------------------------------------------
// 2. AUTHENTICATED GUEST SESSION & CALL-BELL & MENU
// --------------------------------------------------------------------------

// GET /api/v1/guest/session
guestRouter.get(
  '/guest/session',
  authenticateGuestSession,
  getGuestSession
);

// GET /api/v1/guest/menu (public read-only with QR context)
guestRouter.get(
  '/guest/menu',
  getGuestMenu
);

// POST /api/v1/guest/service-requests
guestRouter.post(
  '/guest/service-requests',
  authenticateGuestSession,
  validate({ body: createServiceRequestBodySchema }),
  createGuestServiceRequest
);

// GET /api/v1/guest/service-requests
guestRouter.get(
  '/guest/service-requests',
  authenticateGuestSession,
  listGuestServiceRequests
);

guestRouter.post('/guest/logout',authenticateGuestSession,logoutGuest);

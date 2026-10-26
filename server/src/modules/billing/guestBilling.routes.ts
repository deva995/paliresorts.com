import { Router } from 'express';
import { authenticateGuestSession, requireGuestBillingOtp } from '../../middleware/guestAuth.js';
import { getGuestBill, payGuestBill } from './billing.controller.js';

export const guestBillingRouter = Router();

// ----------------------------------------------------------------------------
// GUEST BILL ACCESS (SCOPED TO AUTHENTICATED GUEST DINING SESSION)
// ----------------------------------------------------------------------------
guestBillingRouter.get(
  '/guest/bill',
  authenticateGuestSession,
  requireGuestBillingOtp,
  getGuestBill
);

guestBillingRouter.post(
  '/guest/bill/pay',
  authenticateGuestSession,
  requireGuestBillingOtp,
  payGuestBill
);

import {validateBillingIdempotencyKey} from './idempotency.validation.js';
import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateStaff,
  requireModuleAccess,
  requireAuth,
  requirePermission,
  requireOutletAccess
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import {
  sessionIdParamsSchema,
  billIdParamsSchema,
  paymentIdParamsSchema,
  outletParamsSchema,
  listBillsQuerySchema,
  generateBillBodySchema,
  finalizeBillBodySchema,
  applyDiscountBodySchema,
  createPaymentBodySchema,
  createRefundBodySchema,
  listOutletPaymentsQuerySchema,
  settleSessionBodySchema,
  settlementRequestIdParamsSchema,
  createSettlementRequestBodySchema,
  listSettlementRequestsQuerySchema,
  updateSettlementRequestStatusBodySchema
} from './billing.validation.js';
import {
  previewSessionBill,
  createSessionBill,
  settleDiningSession,
  getBill,
  listSessionBills,
  listOutletBills,
  finalizeBill,
  applyDiscount,
  processBillPayment,
  listPaymentsForBill,
  getPayment,
  processPaymentRefund,
  listRefundsForPayment,
  listOutletPayments,
  createSettlementRequest,
  listSettlementRequests,
  updateSettlementRequestStatus
} from './billing.controller.js';

export const billingRouter = Router();

function requireAnyPermission(permissionCodes: string[]) {
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

function requireOutletPaymentAccess() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    // Kitchen and waiter roles must be denied
    const isDeniedRole = req.staff.roles.some((r) =>
      r.id === 'WAITER' || r.id === 'WAITER_MANAGER' || r.id.startsWith('KITCHEN')
    );
    if (isDeniedRole) {
      return next(new ForbiddenError('Waiter and kitchen staff are not permitted to access outlet payment registers'));
    }

    // Requires billing permission used for listing bills (bill:view or payment:process)
    const hasBillingPerm = req.staff.permissions.includes('bill:view') || req.staff.permissions.includes('payment:process');
    if (!hasBillingPerm) {
      return next(new ForbiddenError("Staff lacks required permission: 'bill:view'"));
    }

    next();
  };
}

// ----------------------------------------------------------------------------
// 1. BILL PREVIEW (EPHEMERAL CALCULATION)
// ----------------------------------------------------------------------------
billingRouter.get(
  '/dining-sessions/:sessionId/bill-preview',
  authenticateStaff,
  requireAuth,
  requirePermission('bill:view'),
  requireModuleAccess('billing','view'),
  validate({ params: sessionIdParamsSchema }),
  previewSessionBill
);

// ----------------------------------------------------------------------------
// 2. GENERATE BILL (FISCAL INVOICE CREATION)
// ----------------------------------------------------------------------------
billingRouter.post(
  '/dining-sessions/:sessionId/bills',
  authenticateStaff,
  validateBillingIdempotencyKey,
  requireAuth,
  requirePermission('bill:generate'),
  requireModuleAccess('billing','edit'),
  validate({ params: sessionIdParamsSchema, body: generateBillBodySchema }),
  createSessionBill
);

// ----------------------------------------------------------------------------
// 2b. SETTLE DINING SESSION
// ----------------------------------------------------------------------------
billingRouter.post(
  '/dining-sessions/:sessionId/settle',
  authenticateStaff,
  validateBillingIdempotencyKey,
  requireAuth,
  requireAnyPermission(['payment:process', 'bill:settle', 'folio:charge']),
  requireModuleAccess('billing','edit'),
  validate({ params: sessionIdParamsSchema, body: settleSessionBodySchema }),
  settleDiningSession
);

// ----------------------------------------------------------------------------
// 3. READ BILLS
// ----------------------------------------------------------------------------
billingRouter.get(
  '/bills/:billId',
  authenticateStaff,
  requireAuth,
  requirePermission('bill:view'),
  requireModuleAccess('billing','view'),
  validate({ params: billIdParamsSchema }),
  getBill
);

billingRouter.get(
  '/dining-sessions/:sessionId/bills',
  authenticateStaff,
  requireAuth,
  requirePermission('bill:view'),
  requireModuleAccess('billing','view'),
  validate({ params: sessionIdParamsSchema }),
  listSessionBills
);

billingRouter.get(
  '/outlets/:outletId/bills',
  authenticateStaff,
  requireAuth,
  requirePermission('bill:view'),
  requireModuleAccess('billing','view'),
  validate({ params: outletParamsSchema, query: listBillsQuerySchema }),
  requireOutletAccess('outletId'),
  listOutletBills
);

billingRouter.get(
  '/outlets/:outletId/payments',
  authenticateStaff,
  requireAuth,
  requireOutletPaymentAccess(),
  requireModuleAccess('billing','view'),
  validate({ params: outletParamsSchema, query: listOutletPaymentsQuerySchema }),
  requireOutletAccess('outletId'),
  listOutletPayments
);

// ----------------------------------------------------------------------------
// 4. FINALIZE BILL (FREEZE & APPROVE DRAFT INVOICE)
// ----------------------------------------------------------------------------
billingRouter.post(
  '/bills/:billId/finalize',
  authenticateStaff,
  validateBillingIdempotencyKey,
  requireAuth,
  requireAnyPermission(['bill:generate', 'bill:settle']),
  requireModuleAccess('billing','edit'),
  validate({ params: billIdParamsSchema, body: finalizeBillBodySchema }),
  finalizeBill
);

// ----------------------------------------------------------------------------
// 5. APPLY DISCOUNT (INTEGRATED WITH DOMAIN I APPROVALS)
// ----------------------------------------------------------------------------
billingRouter.post(
  '/bills/:billId/discount',
  authenticateStaff,
  validateBillingIdempotencyKey,
  requireAuth,
  requirePermission('bill:apply_discount'),
  requireModuleAccess('billing','edit'),
  validate({ params: billIdParamsSchema, body: applyDiscountBodySchema }),
  applyDiscount
);

// ----------------------------------------------------------------------------
// 6. PAYMENTS & TENDER SETTLEMENT
// ----------------------------------------------------------------------------
billingRouter.post(
  '/bills/:billId/payments',
  authenticateStaff,
  validateBillingIdempotencyKey,
  requireAuth,
  requireAnyPermission(['payment:process', 'bill:settle', 'folio:charge']),
  requireModuleAccess('billing','edit'),
  validate({ params: billIdParamsSchema, body: createPaymentBodySchema }),
  processBillPayment
);

billingRouter.get(
  '/bills/:billId/payments',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['bill:view', 'payment:process']),
  requireModuleAccess('billing','view'),
  validate({ params: billIdParamsSchema }),
  listPaymentsForBill
);

billingRouter.get(
  '/payments/:paymentId',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['bill:view', 'payment:process']),
  requireModuleAccess('billing','view'),
  validate({ params: paymentIdParamsSchema }),
  getPayment
);

// ----------------------------------------------------------------------------
// 7. REFUNDS & FINANCIAL AUDITING
// ----------------------------------------------------------------------------
billingRouter.post(
  '/payments/:paymentId/refunds',
  authenticateStaff,
  validateBillingIdempotencyKey,
  requireAuth,
  requirePermission('payment:refund'),
  requireModuleAccess('billing','edit'),
  validate({ params: paymentIdParamsSchema, body: createRefundBodySchema }),
  processPaymentRefund
);

billingRouter.get(
  '/payments/:paymentId/refunds',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['bill:view', 'payment:refund']),
  requireModuleAccess('billing','view'),
  validate({ params: paymentIdParamsSchema }),
  listRefundsForPayment
);

// ----------------------------------------------------------------------------
// 8. WAITER-TO-CASHIER SETTLEMENT REQUESTS
// ----------------------------------------------------------------------------
billingRouter.post(
  '/dining-sessions/:sessionId/settlement-request',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign']),
  validate({ params: sessionIdParamsSchema, body: createSettlementRequestBodySchema }),
  createSettlementRequest
);

billingRouter.get(
  '/outlets/:outletId/settlement-requests',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['bill:view', 'payment:process', 'bill:settle']),
  validate({ params: outletParamsSchema, query: listSettlementRequestsQuerySchema }),
  requireOutletAccess('outletId'),
  listSettlementRequests
);

billingRouter.post(
  '/settlement-requests/:requestId/status',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['payment:process', 'bill:settle']),
  validate({ params: settlementRequestIdParamsSchema, body: updateSettlementRequestStatusBodySchema }),
  updateSettlementRequestStatus
);

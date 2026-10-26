import { z } from 'zod';

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid dining session ID format')
});

export const billIdParamsSchema = z.object({
  billId: z.string().uuid('Invalid bill ID format')
});

export const paymentIdParamsSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format')
});

export const outletParamsSchema = z.object({
  outletId: z.string().min(1).max(32)
});

export const listBillsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SETTLED', 'VOIDED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const generateBillBodySchema = z.object({
  notes: z.string().max(500).optional(),
  discountApprovalRequestId: z.string().uuid('Invalid discount approval request ID').optional()
});

export const finalizeBillBodySchema = z.object({
  notes: z.string().max(500).optional()
});

export const applyDiscountBodySchema = z.object({
  approvalRequestId: z.string().uuid('Invalid approval request ID format'),
  notes: z.string().max(500).optional()
});

export const createPaymentBodySchema = z.object({
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'ROOM_FOLIO']),
  amountPaise: z.number().int().positive('Payment amount must be greater than zero'),
  transactionReference: z.string().max(150).optional(),
  razorpayOrderId: z.string().max(100).optional(),
  razorpayPaymentId: z.string().max(100).optional(),
  razorpaySignature: z.string().max(255).optional(),
  hotelStayId: z.string().uuid('Invalid hotel stay ID format').optional(),
  roomId: z.string().uuid('Invalid room ID format').optional(),
  notes: z.string().max(500).optional()
});

export const createRefundBodySchema = z.object({
  amountPaise: z.number().int().positive('Refund amount must be greater than zero'),
  reason: z.string().min(1, 'Reason is required').max(500),
  gatewayRefundId: z.string().max(100).optional()
});

export const listOutletPaymentsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  method: z.enum(['CASH', 'UPI', 'CARD', 'ROOM_FOLIO']).optional(),
  status: z.enum(['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED']).optional(),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(200, 'Limit cannot exceed 200').default(50),
  cursor: z.string().optional()
});

export const settleSessionBodySchema = z.object({
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'ROOM_FOLIO']),
  amountPaise: z.number().int().positive('Payment amount must be greater than zero').optional(),
  transactionReference: z.string().max(150).optional(),
  hotelStayId: z.string().uuid('Invalid hotel stay ID format').optional(),
  roomId: z.string().uuid('Invalid room ID format').optional(),
  notes: z.string().max(500).optional()
});

export const settlementRequestIdParamsSchema = z.object({
  requestId: z.string().uuid('Invalid settlement request ID format')
});

export const createSettlementRequestBodySchema = z.object({
  paymentMethodPreference: z.enum(['CASH', 'UPI', 'CARD', 'ROOM_FOLIO']).optional(),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional()
});

export const listSettlementRequestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'ALL']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const updateSettlementRequestStatusBodySchema = z.object({
  status: z.enum(['ACCEPTED', 'CANCELLED']),
  reason: z.string().trim().max(500).optional()
});



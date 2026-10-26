import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { BillingService } from './billing.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, UnprocessableEntityError } from '../../utils/errors.js';
import { AuthenticatedStaffContext } from '../../middleware/auth.js';
import { BillStatus, PaymentMethod } from './billing.types.js';
import { getDbPool,withTransaction } from '../../db/pool.js';


/**
 * GET /api/v1/dining-sessions/:sessionId/bill-preview
 */
export async function previewSessionBill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { sessionId } = req.params;

  try {
    const pool = getDbPool();
    const sessionRes = await pool.query(
      'SELECT outlet_id FROM public.dining_sessions WHERE id = $1;',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }
    checkStaffOutletAccess(req.staff, sessionRes.rows[0].outlet_id);

    const preview = await BillingService.previewBill(sessionId);
    res.status(200).json(preview);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/dining-sessions/:sessionId/bills
 */
export async function createSessionBill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { sessionId } = req.params;
  const { notes, discountApprovalRequestId } = req.body || {};
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `bill_gen_${crypto.randomUUID()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const outcome=await withTransaction(async client=>{
    const pool = client;
    const sessionRes = await pool.query(
      'SELECT outlet_id FROM public.dining_sessions WHERE id = $1;',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }
    const outletId = sessionRes.rows[0].outlet_id;
    checkStaffOutletAccess(req.staff!, outletId);

    const payload: Record<string, any> = { sessionId, staffId:req.staff!.id, notes: notes || null };
    if (discountApprovalRequestId) {
      payload.discountApprovalRequestId = discountApprovalRequestId;
    }

    // Acquire or check idempotency key
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'BILL_GENERATE',
      outletId,
      actorStaffId: req.staff!.id,
      payload
    },client);

    if (acquireResult.status === 'REPLAY') {
      return {status:acquireResult.statusCode,body:acquireResult.body};
    }

    acquiredKeyId = acquireResult.keyId;

    const result = await BillingService.generateBillForSession({
      sessionId,
      staffId: req.staff!.id,
      notes,
      discountApprovalRequestId,
      reqCorrelationId,
      ipAddress: req.ip
    },client);

    await IdempotencyService.complete(
      acquiredKeyId,
      201,
      result,
      'bills',
      result.id,client
    );

    return {status:201,body:result};
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/bills/:billId
 */
export async function getBill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { billId } = req.params;

  try {
    const bill = await BillingService.getBillById(billId);
    checkStaffOutletAccess(req.staff, bill.outletId);
    res.status(200).json(bill);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/dining-sessions/:sessionId/bills
 */
export async function listSessionBills(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { sessionId } = req.params;

  try {
    const pool = getDbPool();
    const sessionRes = await pool.query(
      'SELECT outlet_id FROM public.dining_sessions WHERE id = $1;',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }
    checkStaffOutletAccess(req.staff, sessionRes.rows[0].outlet_id);

    const bills = await BillingService.listSessionBills(sessionId);
    res.status(200).json(bills);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/outlets/:outletId/bills
 */
export async function listOutletBills(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { outletId } = req.params;
  const { status, limit, offset } = req.query as any;

  try {
    checkStaffOutletAccess(req.staff, outletId);
    const result = await BillingService.listOutletBills({
      outletId,
      status: status as BillStatus,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/bills/:billId/finalize
 */
export async function finalizeBill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { billId } = req.params;
  const { notes } = req.body || {};
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `bill_fin_${crypto.randomUUID()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const outcome=await withTransaction(async client=>{
    const pool = client;
    const billRes = await pool.query(
      'SELECT outlet_id FROM public.bills WHERE id = $1;',
      [billId]
    );
    if (billRes.rows.length === 0) {
      throw new NotFoundError(`Bill '${billId}'`);
    }
    const outletId = billRes.rows[0].outlet_id;
    checkStaffOutletAccess(req.staff!, outletId);

    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'BILL_FINALIZE',
      outletId,
      actorStaffId: req.staff!.id,
      payload: { billId, staffId:req.staff!.id, notes: notes || null }
    },client);

    if (acquireResult.status === 'REPLAY') {
      return {status:acquireResult.statusCode,body:acquireResult.body};
    }

    acquiredKeyId = acquireResult.keyId;

    const result = await BillingService.finalizeBill({
      billId,
      staffId: req.staff!.id,
      notes,
      reqCorrelationId,
      ipAddress: req.ip
    },client);

    await IdempotencyService.complete(
      acquiredKeyId,
      200,
      result,
      'bills',
      billId,client
    );

    return {status:200,body:result};
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/bills/:billId/discount
 */
export async function applyDiscount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { billId } = req.params;
  const { approvalRequestId, notes } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const pool = getDbPool();
    const billRes = await pool.query(
      'SELECT outlet_id FROM public.bills WHERE id = $1;',
      [billId]
    );
    if (billRes.rows.length === 0) {
      throw new NotFoundError(`Bill '${billId}'`);
    }
    checkStaffOutletAccess(req.staff, billRes.rows[0].outlet_id);

    const result = await BillingService.applyDiscountToBill({
      billId,
      approvalRequestId,
      staffId: req.staff.id,
      notes,
      reqCorrelationId,
      ipAddress: req.ip
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/bills/:billId/payments
 */
export async function processBillPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { billId } = req.params;
  const {
    paymentMethod,
    amountPaise,
    transactionReference,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    hotelStayId,
    roomId,
    notes
  } = req.body;

  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `pay_${crypto.randomUUID()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    if(!req.staff!.roles.some(r=>r.id==='SUPER_ADMIN')) {
      const allowed=paymentMethod==='ROOM_FOLIO' ? req.staff!.permissions.includes('folio:charge') : req.staff!.permissions.some(p=>['payment:process','bill:settle'].includes(p));
      if(!allowed) throw new ForbiddenError(paymentMethod==='ROOM_FOLIO'?'Room folio charge authority required.':'Cashier payment authority required.');
    }
    const outcome=await withTransaction(async client=>{
    const pool = client;
    const billRes = await pool.query(
      'SELECT outlet_id FROM public.bills WHERE id = $1;',
      [billId]
    );
    if (billRes.rows.length === 0) {
      throw new NotFoundError(`Bill '${billId}'`);
    }
    const outletId = billRes.rows[0].outlet_id;
    checkStaffOutletAccess(req.staff!, outletId);

    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'PAYMENT_CAPTURE',
      outletId,
      actorStaffId: req.staff!.id,
      payload: {
        billId,staffId:req.staff!.id,
        paymentMethod,
        amountPaise,
        transactionReference: transactionReference || null,
        razorpayOrderId: razorpayOrderId || null,
        razorpayPaymentId: razorpayPaymentId || null,
        hotelStayId: hotelStayId || null,
        roomId: roomId || null
      }
    },client);

    if (acquireResult.status === 'REPLAY') {
      return {status:acquireResult.statusCode,body:acquireResult.body};
    }

    acquiredKeyId = acquireResult.keyId;

    const result = await BillingService.processPayment({
      billId,
      paymentMethod: paymentMethod as PaymentMethod,
      amountPaise,
      staffId: req.staff!.id,
      idempotencyKey,
      transactionReference,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      hotelStayId,
      roomId,
      notes,
      reqCorrelationId,
      ipAddress: req.ip
    },client);

    await IdempotencyService.complete(
      acquiredKeyId,
      201,
      result,
      'payments',
      result.id,client
    );

    return {status:201,body:result};
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/dining-sessions/:sessionId/settle
 * Settles active dining session bill with specified tender type.
 * Generates bill if not yet generated, then processes payment in full.
 * Reuses idempotency-key so double tap cannot settle twice.
 */
export async function settleDiningSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const outcome=await withTransaction(async client=>{
    const { sessionId } = req.params;
    const { paymentMethod, amountPaise, transactionReference, hotelStayId, roomId, notes } = req.body;
    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) ||
      crypto.createHash('sha256').update(`settle_${req.staff!.id}_${sessionId}_${Date.now()}`).digest('hex');
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
    let acquiredKeyId: string | null = null;

    const pool = client;
    const sessionRes = await pool.query(
      'SELECT id, outlet_id, status FROM public.dining_sessions WHERE id = $1;',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }
    const session = sessionRes.rows[0];
    checkStaffOutletAccess(req.staff!, session.outlet_id);

    if(!req.staff!.roles.some(r=>r.id==='SUPER_ADMIN')) {
      const allowed=paymentMethod==='ROOM_FOLIO' ? req.staff!.permissions.includes('folio:charge') : req.staff!.permissions.some(p=>['payment:process','bill:settle'].includes(p));
      if(!allowed) throw new ForbiddenError(paymentMethod==='ROOM_FOLIO'?'Room folio charge authority required.':'Cashier payment authority required.');
    }
    if(['UPI','CARD'].includes(paymentMethod)) throw new UnprocessableEntityError('Online collection is blocked — CLIENT API REQUIRED.');
    await client.query('SELECT rt.id FROM public.restaurant_tables rt JOIN public.dining_sessions ds ON ds.table_id=rt.id WHERE ds.id=$1 FOR UPDATE OF rt',[sessionId]);
    await client.query('SELECT id FROM public.dining_sessions WHERE id=$1 FOR UPDATE',[sessionId]);
    // Acquire or check idempotency key
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'PAYMENT_CAPTURE',
      outletId: session.outlet_id,
      actorStaffId: req.staff!.id,
      payload: {
        sessionId,staffId:req.staff!.id,
        paymentMethod,
        amountPaise,
        transactionReference
      }
    },client);

    if (acquireResult.status === 'REPLAY') {
      return {status:acquireResult.statusCode,body:acquireResult.body};
    }

    acquiredKeyId = acquireResult.keyId;

    // Check if an active non-voided bill already exists for the session
    const billRes = await pool.query(
      `SELECT id, status, balance_paise FROM public.bills WHERE dining_session_id = $1 AND status != 'VOIDED' ORDER BY created_at DESC LIMIT 1;`,
      [sessionId]
    );

    let billId: string;
    let targetAmountPaise: number;

    if (billRes.rows.length > 0) {
      billId = billRes.rows[0].id;
      const outstandingBalance = parseInt(billRes.rows[0].balance_paise, 10);
      targetAmountPaise = amountPaise !== undefined ? amountPaise : outstandingBalance;
    } else {
      // Generate bill for session first
      const generatedBill = await BillingService.generateBillForSession({
        sessionId,
        staffId: req.staff!.id,
        notes,
        reqCorrelationId,
        ipAddress: req.ip
      },client);
      billId = generatedBill.id;
      targetAmountPaise = amountPaise !== undefined ? amountPaise : generatedBill.balancePaise;
    }

    const result = await BillingService.processPayment({
      billId,
      paymentMethod: paymentMethod as PaymentMethod,
      amountPaise: targetAmountPaise,
      staffId: req.staff!.id,
      idempotencyKey,
      transactionReference,
      hotelStayId,
      roomId,
      notes,
      reqCorrelationId,
      ipAddress: req.ip
    },client);

    await IdempotencyService.complete(
      acquiredKeyId,
      200,
      result,
      'payments',
      result.id,client
    );

    return {status:200,body:result};
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/bills/:billId/payments
 */
export async function listPaymentsForBill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { billId } = req.params;

  try {
    const pool = getDbPool();
    const billRes = await pool.query(
      'SELECT outlet_id FROM public.bills WHERE id = $1;',
      [billId]
    );
    if (billRes.rows.length === 0) {
      throw new NotFoundError(`Bill '${billId}'`);
    }
    checkStaffOutletAccess(req.staff, billRes.rows[0].outlet_id);

    const payments = await BillingService.listBillPayments(billId);
    res.status(200).json(payments);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payments/:paymentId
 */
export async function getPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { paymentId } = req.params;

  try {
    const payment = await BillingService.getPaymentById(paymentId);
    checkStaffOutletAccess(req.staff, payment.outletId);
    res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payments/:paymentId/refunds
 */
export async function processPaymentRefund(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { paymentId } = req.params;
  const { amountPaise, reason, gatewayRefundId } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `ref_${crypto.randomUUID()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const outcome=await withTransaction(async client=>{
    const pool = client;
    const payRes = await pool.query(
      'SELECT outlet_id FROM public.payments WHERE id = $1;',
      [paymentId]
    );
    if (payRes.rows.length === 0) {
      throw new NotFoundError(`Payment '${paymentId}'`);
    }
    const outletId = payRes.rows[0].outlet_id;
    checkStaffOutletAccess(req.staff!, outletId);

    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'REFUND_PROCESS',
      outletId,
      actorStaffId: req.staff!.id,
      payload: { paymentId, amountPaise, reason,staffId:req.staff!.id }
    },client);

    if (acquireResult.status === 'REPLAY') {
      return {status:acquireResult.statusCode,body:acquireResult.body};
    }

    acquiredKeyId = acquireResult.keyId;

    const result = await BillingService.processRefund({
      paymentId,
      amountPaise,
      reason,
      gatewayRefundId,
      staffId: req.staff!.id,
      idempotencyKey,
      reqCorrelationId,
      ipAddress: req.ip
    },client);

    await IdempotencyService.complete(
      acquiredKeyId,
      201,
      result,
      'refunds',
      result.id,client
    );

    return {status:201,body:result};
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payments/:paymentId/refunds
 */
export async function listRefundsForPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { paymentId } = req.params;

  try {
    const pool = getDbPool();
    const payRes = await pool.query(
      'SELECT outlet_id FROM public.payments WHERE id = $1;',
      [paymentId]
    );
    if (payRes.rows.length === 0) {
      throw new NotFoundError(`Payment '${paymentId}'`);
    }
    checkStaffOutletAccess(req.staff, payRes.rows[0].outlet_id);

    const refunds = await BillingService.listPaymentRefunds(paymentId);
    res.status(200).json(refunds);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/guest/bill
 */
export async function getGuestBill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.guestSession) {
    return next(new UnauthorizedError('Guest session authentication required'));
  }

  try {
    const bill = await BillingService.getGuestBill(req.guestSession.diningSessionId);
    res.status(200).json(bill);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/guest/bill/pay
 */
export async function payGuestBill(req:Request,_res:Response,next:NextFunction):Promise<void> {
  if(!req.guestSession) {next(new UnauthorizedError('Guest session authentication required'));return;}
  next(new UnprocessableEntityError('Online payment collection is blocked — CLIENT API REQUIRED. Ask an authorized cashier to record cash received.'));
}

/**
 * GET /api/v1/outlets/:outletId/payments
 */
export async function listOutletPayments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { outletId } = req.params;
  const { from, to, method, status, limit, cursor } = req.query as {
    from?: string;
    to?: string;
    method?: any;
    status?: any;
    limit?: number;
    cursor?: string;
  };

  try {
    const result = await BillingService.listOutletPayments({
      outletId,
      from,
      to,
      method,
      status,
      limit,
      cursor
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/dining-sessions/:sessionId/settlement-request
 */
export async function createSettlementRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { sessionId } = req.params;
  const { paymentMethodPreference, notes } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const sessionRes = await getDbPool().query(
      'SELECT outlet_id FROM public.dining_sessions WHERE id = $1;',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }
    checkStaffOutletAccess(req.staff, sessionRes.rows[0].outlet_id);

    const result = await BillingService.createSettlementRequest({
      sessionId,
      staffId: req.staff.id,
      paymentMethodPreference,
      notes,
      reqCorrelationId,
      ipAddress: req.ip
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/outlets/:outletId/settlement-requests
 */
export async function listSettlementRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { outletId } = req.params;
  const { status, limit } = req.query as { status?: string; limit?: any };

  try {
    checkStaffOutletAccess(req.staff, outletId);
    const result = await BillingService.listSettlementRequests(
      outletId,
      status,
      limit ? parseInt(String(limit), 10) : 50
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/settlement-requests/:requestId/status
 */
export async function updateSettlementRequestStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { requestId } = req.params;
  const { status, reason } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const result = await BillingService.updateSettlementRequestStatus({
      requestId,
      status,
      staffId: req.staff.id,
      reason,
      reqCorrelationId,
      ipAddress: req.ip
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}


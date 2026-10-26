import pg from 'pg';
import {calculateBill} from './calculations.js';
import { getDbPool, withTransaction } from '../../db/pool.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  BadRequestError
} from '../../utils/errors.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { publishOutletEvent } from '../../services/outletEvent.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import { verifyRazorpaySignature } from '../../utils/razorpay.js';
import {
  BillResponse,
  BillItemResponse,
  BillPreviewResponse,
  BillPreviewItem,
  BillStatus,
  PaymentResponse,
  PaymentAllocationResponse,
  RefundResponse,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  OutletPaymentItem,
  OutletPaymentsResponse,
  SettlementRequestResponse,
  CreateSettlementRequestInput
} from './billing.types.js';

function formatDate(val: any): string | null {
  if (!val) return null;
  return val.toISOString ? val.toISOString() : String(val);
}

/**
 * Calculates Indian Financial Year partition and code (April 1 to March 31).
 * Example:
 * 31 March 2027 -> partitionKey: 'FY26-27', fyCode: '2627'
 * 1 April 2027  -> partitionKey: 'FY27-28', fyCode: '2728'
 */
export function getIndianFinancialYearPartition(date: Date = new Date()): {
  partitionKey: string;
  fyCode: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed (1 to 12)
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  const yy = String(startYear).slice(-2);
  const yyNext = String(endYear).slice(-2);
  return {
    partitionKey: `FY${yy}-${yyNext}`,
    fyCode: `${yy}${yyNext}`
  };
}

function mapBillRow(row: any, items?: BillItemResponse[]): BillResponse {
  return {
    id: row.id,
    outletId: row.outlet_id,
    diningSessionId: row.dining_session_id,
    invoiceNumber: row.invoice_number,
    subtotalPaise: parseInt(row.subtotal_paise, 10),
    discountPaise: parseInt(row.discount_paise || '0', 10),
    discountReasonId: row.discount_reason_id || null,
    discountNotes: row.discount_notes || null,
    discountApprovedByStaffId: row.discount_approved_by_staff_id || null,
    cgstPaise: parseInt(row.cgst_paise || '0', 10),
    sgstPaise: parseInt(row.sgst_paise || '0', 10),
    serviceChargePaise: parseInt(row.service_charge_paise || '0', 10),
    tipPaise: parseInt(row.tip_paise || '0', 10),
    roundingPaise: parseInt(row.rounding_paise || '0', 10),
    grandTotalPaise: parseInt(row.grand_total_paise, 10),
    paidPaise: parseInt(row.paid_paise || '0', 10),
    balancePaise: parseInt(row.balance_paise, 10),
    status: row.status as BillStatus,
    generatedByStaffId: row.generated_by_staff_id,
    settledAt: formatDate(row.settled_at),
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString(),
    items
  };
}

function mapPaymentRow(
  row: any,
  allocations?: PaymentAllocationResponse[],
  billSummary?: any,
  changeReturnedPaise?: number
): PaymentResponse {
  return {
    id: row.id,
    billId: row.bill_id,
    outletId: row.outlet_id,
    paymentMethod: row.payment_method as PaymentMethod,
    amountPaise: parseInt(row.amount_paise, 10),
    status: row.status as PaymentStatus,
    transactionReference: row.transaction_reference || null,
    razorpayOrderId: row.razorpay_order_id || null,
    razorpayPaymentId: row.razorpay_payment_id || null,
    razorpaySignature: row.razorpay_signature || null,
    processedByStaffId: row.processed_by_staff_id,
    idempotencyKey: row.idempotency_key,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString(),
    changeReturnedPaise,
    allocations,
    billSummary
  };
}

function mapRefundRow(row: any, paymentSummary?: any, billSummary?: any): RefundResponse {
  return {
    id: row.id,
    paymentId: row.payment_id,
    amountPaise: parseInt(row.amount_paise, 10),
    reason: row.reason,
    gatewayRefundId: row.gateway_refund_id || null,
    status: row.status as RefundStatus,
    approvedByStaffId: row.approved_by_staff_id,
    idempotencyKey: row.idempotency_key,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    paymentSummary,
    billSummary
  };
}

export class BillingService {
  /**
   * Generates an ephemeral bill preview for a dining session without persisting to database.
   */
  static async previewBill(sessionId: string): Promise<BillPreviewResponse> {
    const pool = getDbPool();

    // 1. Verify dining session
    const sessionRes = await pool.query(
      'SELECT id, outlet_id, status FROM public.dining_sessions WHERE id = $1;',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      throw new NotFoundError(`Dining session '${sessionId}'`);
    }
    const session = sessionRes.rows[0];

    // 2. Fetch outlet details
    const outletRes = await pool.query(
      'SELECT id, invoice_series_prefix FROM public.outlets WHERE id = $1;',
      [session.outlet_id]
    );
    const outletPrefix = outletRes.rows[0]?.invoice_series_prefix || 'INV-';

    // 3. Fetch active uncancelled orders and items that are not already billed in a non-voided bill
    const itemsRes = await pool.query(
      `SELECT 
        oi.id AS order_item_id,
        oi.item_name_snapshot,
        oi.quantity,
        oi.unit_price_paise,
        oi.gst_rate_snapshot
       FROM public.order_items oi
       JOIN public.orders o ON o.id = oi.order_id
       WHERE o.dining_session_id = $1 
         AND o.status != 'CANCELLED' 
         AND oi.status != 'CANCELLED'
         AND oi.id NOT IN (
           SELECT bi.order_item_id 
           FROM public.bill_items bi 
           JOIN public.bills b ON b.id = bi.bill_id 
           WHERE b.status != 'VOIDED'
         )
       ORDER BY oi.created_at ASC;`,
      [sessionId]
    );

    if (itemsRes.rows.length === 0) {
      throw new UnprocessableEntityError('No billable orders found for dining session');
    }

    let subtotalPaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;

    const previewItems: BillPreviewItem[] = itemsRes.rows.map((row) => {
      const quantity = parseInt(row.quantity, 10);
      const unitPricePaise = parseInt(row.unit_price_paise, 10);
      const totalPricePaise = quantity * unitPricePaise;
      const gstRatePercent = parseFloat(row.gst_rate_snapshot);
      const halfRate = gstRatePercent / 2;
      const cgstPaise = Math.round((totalPricePaise * halfRate) / 100);
      const sgstPaise = Math.round((totalPricePaise * halfRate) / 100);

      subtotalPaise += totalPricePaise;
      totalCgstPaise += cgstPaise;
      totalSgstPaise += sgstPaise;

      return {
        orderItemId: row.order_item_id,
        itemName: row.item_name_snapshot,
        quantity,
        unitPricePaise,
        totalPricePaise,
        gstRatePercent,
        cgstPaise,
        sgstPaise
      };
    });

    const settings=(await pool.query('SELECT * FROM public.outlet_settings WHERE outlet_id=$1',[session.outlet_id])).rows[0] || {};
    const computed=calculateBill(previewItems,settings);
    subtotalPaise=computed.subtotalPaise;totalCgstPaise=computed.cgstPaise;totalSgstPaise=computed.sgstPaise;
    const {discountPaise,serviceChargePaise,tipPaise,roundingPaise,grandTotalPaise}=computed;
    return {
      outletId: session.outlet_id,
      diningSessionId: sessionId,
      subtotalPaise,
      discountPaise,
      cgstPaise: totalCgstPaise,
      sgstPaise: totalSgstPaise,
      serviceChargePaise,
      tipPaise,
      roundingPaise,
      grandTotalPaise,
      estimatedInvoicePrefix: outletPrefix,
      items: computed.items
    };
  }

  /**
   * Generates and commits an authoritative fiscal invoice/bill for a dining session.
   * Transactional, allocates atomic invoice counter, records bill_items, and advances session to BILLED.
   */
  static async generateBillForSession(params: {
    sessionId?: string;
    counterOrderId?:string;
    staffId: string;
    notes?: string;
    discountApprovalRequestId?: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  },transactionClient?:pg.PoolClient): Promise<BillResponse> {
    const { sessionId, counterOrderId,staffId, notes, discountApprovalRequestId, reqCorrelationId, ipAddress } = params;

    const execute=async (client:pg.PoolClient):Promise<BillResponse> => {
      // 1. Lock dining session FOR UPDATE
      const sessionRes = await client.query(
        counterOrderId ? "SELECT * FROM public.orders WHERE id=$1 AND order_source='COUNTER_POS' FOR UPDATE" : 'SELECT * FROM public.dining_sessions WHERE id = $1 FOR UPDATE;',
        [counterOrderId || sessionId]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundError(`Dining session '${sessionId}'`);
      }

      const session = sessionRes.rows[0];
      if(counterOrderId && session.status!=='SERVED') throw new ConflictError('Counter order must be served before billing.');
      // Serialize invoice eligibility with cancellations and item mutations.
      if(!counterOrderId) await client.query('SELECT id FROM public.orders WHERE dining_session_id=$1 ORDER BY id FOR UPDATE',[sessionId]);

      // Validate session status
      if (session.status === 'CANCELLED') {
        throw new ConflictError('Cannot generate bill for a cancelled dining session');
      }
      if (session.status === 'CLOSED') {
        throw new ConflictError('Cannot generate bill for an already closed dining session');
      }

      // 2. Prevent accidental duplicate active billing for the same session
      const existingBillRes = await client.query(
        counterOrderId ? `SELECT b.id,b.invoice_number,b.status FROM bills b JOIN bill_items bi ON bi.bill_id=b.id JOIN order_items oi ON oi.id=bi.order_item_id WHERE oi.order_id=$1 AND b.status!='VOIDED' LIMIT 1` : `SELECT id, invoice_number, status FROM public.bills WHERE dining_session_id = $1 AND status != 'VOIDED';`,
        [counterOrderId || sessionId]
      );

      if (existingBillRes.rows.length > 0) {
        const existing = existingBillRes.rows[0];
        throw new ConflictError(
          `An active bill ('${existing.invoice_number}', status: ${existing.status}) already exists for this dining session`
        );
      }

      // 3. Resolve outlet prefix
      const outletRes = await client.query(
        'SELECT id, invoice_series_prefix FROM public.outlets WHERE id = $1;',
        [session.outlet_id]
      );
      if (outletRes.rows.length === 0) {
        throw new NotFoundError(`Outlet '${session.outlet_id}'`);
      }
      const outlet = outletRes.rows[0];

      // 4. Fetch all active uncancelled orders and items that are not already billed
      const itemsRes = await client.query(
        `SELECT 
          oi.id AS order_item_id,
          oi.order_id,
          oi.item_name_snapshot,
          oi.quantity,
          oi.unit_price_paise,
          oi.gst_rate_snapshot,
          oi.status AS item_status,
          o.status AS order_status
         FROM public.order_items oi
         JOIN public.orders o ON o.id = oi.order_id
         WHERE ${counterOrderId ? 'o.id' : 'o.dining_session_id'} = $1
           AND o.status != 'CANCELLED' 
           AND oi.status != 'CANCELLED'
           AND oi.id NOT IN (
             SELECT bi.order_item_id 
             FROM public.bill_items bi 
             JOIN public.bills b ON b.id = bi.bill_id 
             WHERE b.status != 'VOIDED'
           )
         ORDER BY oi.created_at ASC;`,
        [counterOrderId || sessionId]
      );

      if (itemsRes.rows.length === 0) {
        throw new UnprocessableEntityError('No billable orders found for dining session');
      }

      // 5. Calculate integer paise line items and aggregate totals
      let subtotalPaise = 0;
      let totalCgstPaise = 0;
      let totalSgstPaise = 0;

      const billItemRows = itemsRes.rows.map((row) => {
        const quantity = parseInt(row.quantity, 10);
        const unitPricePaise = parseInt(row.unit_price_paise, 10);
        const totalPricePaise = quantity * unitPricePaise;
        const gstRatePercent = parseFloat(row.gst_rate_snapshot);
        const halfRate = gstRatePercent / 2;
        const cgstPaise = Math.round((totalPricePaise * halfRate) / 100);
        const sgstPaise = Math.round((totalPricePaise * halfRate) / 100);

        subtotalPaise += totalPricePaise;
        totalCgstPaise += cgstPaise;
        totalSgstPaise += sgstPaise;

        return {
          orderItemId: row.order_item_id,
          itemName: row.item_name_snapshot,
          quantity,
          unitPricePaise,
          totalPricePaise,
          gstRatePercent,
          cgstPaise,
          sgstPaise
        };
      });

      // 6. Discount & Approval Integration
      let discountPaise = 0;
      let discountReasonId: string | null = null;
      let discountNotes: string | null = notes || null;
      let discountApprovedByStaffId: string | null = null;

      if (discountApprovalRequestId) {
        const appRes = await client.query(
          `SELECT * FROM public.approval_requests WHERE id = $1 FOR UPDATE;`,
          [discountApprovalRequestId]
        );
        if (appRes.rows.length === 0) {
          throw new NotFoundError(`Approval request '${discountApprovalRequestId}'`);
        }
        const appReq = appRes.rows[0];
        if(appReq.bill_id) throw new ConflictError('Discount approval is already bound to a bill.');

        if (appReq.outlet_id !== session.outlet_id) {
          throw new BadRequestError('Approval request belongs to another outlet');
        }
        if (!['DISCOUNT', 'COMP'].includes(appReq.request_type)) {
          throw new UnprocessableEntityError(
            `Approval request type is '${appReq.request_type}'. Only DISCOUNT or COMP requests can be applied to bills.`
          );
        }
        if (appReq.status !== 'APPROVED') {
          throw new UnprocessableEntityError(
            `Approval request status is '${appReq.status}'. Only APPROVED requests may be applied.`
          );
        }

        // Maker-checker rule: requested_by cannot be the approver
        const actionRes = await client.query(
          `SELECT actor_staff_id FROM public.approval_actions WHERE request_id = $1 AND action = 'APPROVED' ORDER BY action_at DESC LIMIT 1;`,
          [discountApprovalRequestId]
        );
        if(!actionRes.rows.length) throw new ForbiddenError('Discount approval requires a different authorized checker.');
        if (actionRes.rows.length > 0) {
          const approverStaffId = actionRes.rows[0].actor_staff_id;
          if (approverStaffId === appReq.requested_by_staff_id) {
            throw new ForbiddenError(
              'Maker-checker violation: Requester cannot approve their own discount'
            );
          }
          discountApprovedByStaffId = approverStaffId;
        }

        const approvedAmount = parseInt(appReq.amount_paise, 10);
        if (approvedAmount > subtotalPaise) {
          throw new BadRequestError(
            `Approved discount of ₹${(approvedAmount / 100).toFixed(2)} exceeds bill subtotal of ₹${(subtotalPaise / 100).toFixed(2)}`
          );
        }

        discountPaise = approvedAmount;
        discountReasonId = appReq.reason_code_id;
        discountNotes = appReq.notes || notes || null;
      }

      const settings=(await client.query('SELECT * FROM public.outlet_settings WHERE outlet_id=$1',[session.outlet_id])).rows[0] || {};
      const computed=calculateBill(billItemRows,settings,discountPaise);
      totalCgstPaise=computed.cgstPaise;totalSgstPaise=computed.sgstPaise;
      billItemRows.splice(0,billItemRows.length,...computed.items);
      const {serviceChargePaise,tipPaise,roundingPaise,grandTotalPaise}=computed;
      const paidPaise = 0;
      const balancePaise = grandTotalPaise;

      // 7. Allocate sequential invoice number from outlet_counters
      const { partitionKey, fyCode } = getIndianFinancialYearPartition();
      const counterQuery = `
        INSERT INTO public.outlet_counters (
          outlet_id, counter_type, partition_key, current_val, updated_at
        ) VALUES ($1, 'INVOICE', $2, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (outlet_id, counter_type, partition_key)
        DO UPDATE SET 
          current_val = outlet_counters.current_val + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING current_val;
      `;
      const counterRes = await client.query(counterQuery, [session.outlet_id, partitionKey]);
      const sequence = parseInt(counterRes.rows[0].current_val, 10);
      const cleanPrefix = (outlet.invoice_series_prefix || 'INV').replace(/-+$/, '');
      const paddedSeq = String(sequence).padStart(6, '0');
      const invoiceNumber = `${cleanPrefix}-${fyCode}-${paddedSeq}`;

      // 8. Insert bill header
      const insertBillQuery = `
        INSERT INTO public.bills (
          outlet_id,
          dining_session_id,
          invoice_number,
          subtotal_paise,
          discount_paise,
          discount_reason_id,
          discount_notes,
          discount_approved_by_staff_id,
          cgst_paise,
          sgst_paise,
          service_charge_paise,
          tip_paise,
          rounding_paise,
          grand_total_paise,
          paid_paise,
          balance_paise,
          status,
          generated_by_staff_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'DRAFT', $17
        ) RETURNING *;
      `;

      const billRes = await client.query(insertBillQuery, [
        session.outlet_id,
        sessionId,
        invoiceNumber,
        subtotalPaise,
        discountPaise,
        discountReasonId,
        discountNotes,
        discountApprovedByStaffId,
        totalCgstPaise,
        totalSgstPaise,
        serviceChargePaise,
        tipPaise,
        roundingPaise,
        grandTotalPaise,
        paidPaise,
        balancePaise,
        staffId
      ]);
      const billRow = billRes.rows[0];
      await client.query('UPDATE public.bills SET calculation_settings=$2 WHERE id=$1',[billRow.id,JSON.stringify(settings)]);

      // If approval request was used, link bill_id to approval_requests
      if (discountApprovalRequestId) {
        await client.query(
          `UPDATE public.approval_requests SET bill_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
          [billRow.id, discountApprovalRequestId]
        );
      }

      // 9. Insert bill items
      const insertedItems: BillItemResponse[] = [];
      for (const item of billItemRows) {
        const insertItemQuery = `
          INSERT INTO public.bill_items (
            bill_id,
            order_item_id,
            item_name,
            unit_price_paise,
            quantity,
            total_price_paise,
            gst_rate_percent,
            cgst_paise,
            sgst_paise
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *;
        `;
        const itemRes = await client.query(insertItemQuery, [
          billRow.id,
          item.orderItemId,
          item.itemName,
          item.unitPricePaise,
          item.quantity,
          item.totalPricePaise,
          item.gstRatePercent,
          item.cgstPaise,
          item.sgstPaise
        ]);
        const r = itemRes.rows[0];
        await client.query('UPDATE public.bill_items SET line_discount_paise=$2 WHERE id=$1',[r.id,(item as any).lineDiscountPaise || 0]);
        insertedItems.push({
          id: r.id,
          billId: r.bill_id,
          orderItemId: r.order_item_id,
          itemName: r.item_name,
          unitPricePaise: parseInt(r.unit_price_paise, 10),
          quantity: parseInt(r.quantity, 10),
          totalPricePaise: parseInt(r.total_price_paise, 10),
          gstRatePercent: parseFloat(r.gst_rate_percent),
          cgstPaise: parseInt(r.cgst_paise, 10),
          sgstPaise: parseInt(r.sgst_paise, 10),
          createdAt: formatDate(r.created_at) || new Date().toISOString()
        });
      }

      // 10. Advance dining session lifecycle to BILLED
      await client.query(
        `UPDATE public.dining_sessions
         SET status = 'BILLED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [sessionId]
      );

      // 11. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'BILL_GENERATED',
          entityType: 'bills',
          entityId: billRow.id,
          outletId: session.outlet_id,
          oldState: null,
          newState: {
            invoiceNumber,
            grandTotalPaise,
            subtotalPaise,
            discountPaise,
            itemCount: insertedItems.length
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 12. Outlet event log
      await publishOutletEvent(
        {
          outletId: session.outlet_id,
          channel: 'billing',
          eventType: 'BILL_GENERATED',
          entityId: billRow.id,
          payload: {
            billId: billRow.id,
            diningSessionId: sessionId,
            invoiceNumber,
            grandTotalPaise,
            status: 'DRAFT'
          }
        },
        client
      );

      return mapBillRow(billRow, insertedItems);
    };
    const createdBill=transactionClient ? await execute(transactionClient) : await withTransaction(execute);

    // Parent transactions publish only their committed event journal; never emit a pre-commit financial success.
    if(!transactionClient) realtimeBroadcaster
      .publish({
        outletId: createdBill.outletId,
        channel: 'billing',
        sequenceNumber: 1,
        eventType: 'BILL_GENERATED',
        payload: {
          billId: createdBill.id,
          diningSessionId: createdBill.diningSessionId,
          invoiceNumber: createdBill.invoiceNumber,
          grandTotalPaise: createdBill.grandTotalPaise,
          status: createdBill.status
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return createdBill;
  }

  /**
   * Retrieves a single bill and all its line items by ID.
   */
  static async getBillById(billId: string, client?: pg.PoolClient): Promise<BillResponse> {
    const queryRunner = client || getDbPool();

    const billRes = await queryRunner.query(
      'SELECT * FROM public.bills WHERE id = $1;',
      [billId]
    );

    if (billRes.rows.length === 0) {
      throw new NotFoundError(`Bill '${billId}'`);
    }

    const billRow = billRes.rows[0];

    const itemsRes = await queryRunner.query(
      'SELECT * FROM public.bill_items WHERE bill_id = $1 ORDER BY created_at ASC;',
      [billId]
    );

    const items: BillItemResponse[] = itemsRes.rows.map((r) => ({
      id: r.id,
      billId: r.bill_id,
      orderItemId: r.order_item_id,
      itemName: r.item_name,
      unitPricePaise: parseInt(r.unit_price_paise, 10),
      quantity: parseInt(r.quantity, 10),
      totalPricePaise: parseInt(r.total_price_paise, 10),
      gstRatePercent: parseFloat(r.gst_rate_percent),
      cgstPaise: parseInt(r.cgst_paise, 10),
      sgstPaise: parseInt(r.sgst_paise, 10),
      createdAt: formatDate(r.created_at) || new Date().toISOString()
    }));

    return mapBillRow(billRow, items);
  }

  /**
   * Lists all bills generated for a specific dining session.
   */
  static async listSessionBills(sessionId: string): Promise<BillResponse[]> {
    const pool = getDbPool();
    const res = await pool.query(
      `SELECT * FROM public.bills 
       WHERE dining_session_id = $1 
       ORDER BY created_at DESC;`,
      [sessionId]
    );

    if (res.rows.length === 0) {
      return [];
    }

    const billIds = res.rows.map((r) => r.id);
    const itemsRes = await pool.query(
      `SELECT * FROM public.bill_items 
       WHERE bill_id = ANY($1::uuid[]) 
       ORDER BY created_at ASC;`,
      [billIds]
    );

    const itemsByBill = new Map<string, BillItemResponse[]>();
    for (const r of itemsRes.rows) {
      const list = itemsByBill.get(r.bill_id) || [];
      list.push({
        id: r.id,
        billId: r.bill_id,
        orderItemId: r.order_item_id,
        itemName: r.item_name,
        unitPricePaise: parseInt(r.unit_price_paise, 10),
        quantity: parseInt(r.quantity, 10),
        totalPricePaise: parseInt(r.total_price_paise, 10),
        gstRatePercent: parseFloat(r.gst_rate_percent),
        cgstPaise: parseInt(r.cgst_paise, 10),
        sgstPaise: parseInt(r.sgst_paise, 10),
        createdAt: formatDate(r.created_at) || new Date().toISOString()
      });
      itemsByBill.set(r.bill_id, list);
    }

    return res.rows.map((row) => mapBillRow(row, itemsByBill.get(row.id) || []));
  }

  /**
   * Lists bills for an outlet with optional status filtering and pagination.
   */
  static async listOutletBills(params: {
    outletId: string;
    status?: BillStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ bills: BillResponse[]; total: number }> {
    const { outletId, status, limit = 50, offset = 0 } = params;
    const pool = getDbPool();

    const conditions: string[] = ['outlet_id = $1'];
    const values: any[] = [outletId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM public.bills WHERE ${whereClause};`,
      values
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const listQuery = `
      SELECT * FROM public.bills 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const listRes = await pool.query(listQuery, [...values, limit, offset]);

    if (listRes.rows.length === 0) {
      return { bills: [], total };
    }

    const billIds = listRes.rows.map((r) => r.id);
    const itemsRes = await pool.query(
      `SELECT * FROM public.bill_items 
       WHERE bill_id = ANY($1::uuid[]) 
       ORDER BY created_at ASC;`,
      [billIds]
    );

    const itemsByBill = new Map<string, BillItemResponse[]>();
    for (const r of itemsRes.rows) {
      const list = itemsByBill.get(r.bill_id) || [];
      list.push({
        id: r.id,
        billId: r.bill_id,
        orderItemId: r.order_item_id,
        itemName: r.item_name,
        unitPricePaise: parseInt(r.unit_price_paise, 10),
        quantity: parseInt(r.quantity, 10),
        totalPricePaise: parseInt(r.total_price_paise, 10),
        gstRatePercent: parseFloat(r.gst_rate_percent),
        cgstPaise: parseInt(r.cgst_paise, 10),
        sgstPaise: parseInt(r.sgst_paise, 10),
        createdAt: formatDate(r.created_at) || new Date().toISOString()
      });
      itemsByBill.set(r.bill_id, list);
    }

    return {
      bills: listRes.rows.map((row) => mapBillRow(row, itemsByBill.get(row.id) || [])),
      total
    };
  }

  /**
   * Finalizes a DRAFT bill, moving it to APPROVED status and freezing it financially.
   */
  static async finalizeBill(params: {
    billId: string;
    staffId: string;
    notes?: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  },transactionClient?:pg.PoolClient): Promise<BillResponse> {
    const { billId, staffId, notes, reqCorrelationId, ipAddress } = params;

    const execute=async (client:pg.PoolClient):Promise<BillResponse> => {
      // 1. Lock bill FOR UPDATE
      const billRes = await client.query(
        'SELECT * FROM public.bills WHERE id = $1 FOR UPDATE;',
        [billId]
      );

      if (billRes.rows.length === 0) {
        throw new NotFoundError(`Bill '${billId}'`);
      }

      const bill = billRes.rows[0];

      if (bill.status !== 'DRAFT') {
        throw new ConflictError(
          `Cannot finalize bill with status '${bill.status}'. Only DRAFT bills may be finalized.`
        );
      }

      // 2. Update status to APPROVED
      await client.query(
        `UPDATE public.bills
         SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [billId]
      );

      // 3. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'BILL_FINALIZED',
          entityType: 'bills',
          entityId: billId,
          outletId: bill.outlet_id,
          oldState: { status: bill.status },
          newState: { status: 'APPROVED', notes },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 4. Outlet event log
      await publishOutletEvent(
        {
          outletId: bill.outlet_id,
          channel: 'billing',
          eventType: 'BILL_FINALIZED',
          entityId: billId,
          payload: {
            billId,
            invoiceNumber: bill.invoice_number,
            status: 'APPROVED'
          }
        },
        client
      );

      return await BillingService.getBillById(billId, client);
    };
    const updatedBill=transactionClient ? await execute(transactionClient) : await withTransaction(execute);

    // Standalone operations notify after commit; parent transactions retain the durable event journal.
    if(!transactionClient) realtimeBroadcaster
      .publish({
        outletId: updatedBill.outletId,
        channel: 'billing',
        sequenceNumber: 1,
        eventType: 'BILL_FINALIZED',
        payload: {
          billId: updatedBill.id,
          invoiceNumber: updatedBill.invoiceNumber,
          status: updatedBill.status
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return updatedBill;
  }

  /**
   * Applies an approved discount from Domain I (approval_requests) to an existing bill.
   */
  static async applyDiscountToBill(params: {
    billId: string;
    approvalRequestId: string;
    staffId: string;
    notes?: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<BillResponse> {
    const { billId, approvalRequestId, staffId, notes, reqCorrelationId, ipAddress } = params;

    const updatedBill = await withTransaction(async (client) => {
      // 1. Lock bill FOR UPDATE
      const billRes = await client.query(
        'SELECT * FROM public.bills WHERE id = $1 FOR UPDATE;',
        [billId]
      );
      if (billRes.rows.length === 0) {
        throw new NotFoundError(`Bill '${billId}'`);
      }
      const bill = billRes.rows[0];

      if (['SETTLED', 'VOIDED'].includes(bill.status)) {
        throw new ConflictError(`Cannot apply discount to a bill with status '${bill.status}'`);
      }

      // 2. Lock approval request FOR UPDATE
      const appRes = await client.query(
        'SELECT * FROM public.approval_requests WHERE id = $1 FOR UPDATE;',
        [approvalRequestId]
      );
      if (appRes.rows.length === 0) {
        throw new NotFoundError(`Approval request '${approvalRequestId}'`);
      }
      const appReq = appRes.rows[0];

      if (appReq.outlet_id !== bill.outlet_id) {
        throw new BadRequestError('Approval request belongs to another outlet');
      }
      if (!['DISCOUNT', 'COMP'].includes(appReq.request_type)) {
        throw new UnprocessableEntityError(
          `Approval request type '${appReq.request_type}' is invalid. Only DISCOUNT or COMP allowed.`
        );
      }
      if (appReq.status !== 'APPROVED') {
        throw new UnprocessableEntityError(
          `Approval request status is '${appReq.status}'. Only APPROVED requests may be applied.`
        );
      }
      if (appReq.bill_id && appReq.bill_id !== bill.id) {
        throw new BadRequestError('Approval request was created for a different bill');
      }

      // 3. Maker-checker verification
      const actionRes = await client.query(
        `SELECT actor_staff_id FROM public.approval_actions WHERE request_id = $1 AND action = 'APPROVED' ORDER BY action_at DESC LIMIT 1;`,
        [approvalRequestId]
      );
      if(!actionRes.rows.length) throw new ForbiddenError('Discount approval requires a different authorized checker.');
      let approverStaffId = staffId;
      if (actionRes.rows.length > 0) {
        approverStaffId = actionRes.rows[0].actor_staff_id;
        if (approverStaffId === appReq.requested_by_staff_id) {
          throw new ForbiddenError(
            'Maker-checker violation: Requester cannot approve their own discount'
          );
        }
      }

      const discountPaise = parseInt(appReq.amount_paise, 10);
      const subtotalPaise = parseInt(bill.subtotal_paise, 10);
      if (discountPaise > subtotalPaise) {
        throw new BadRequestError(
          `Approved discount of ₹${(discountPaise / 100).toFixed(2)} exceeds bill subtotal of ₹${(subtotalPaise / 100).toFixed(2)}`
        );
      }

      const paidPaise = parseInt(bill.paid_paise || '0',10);
      if(paidPaise>0) throw new ConflictError('Cannot change discounts after payment; refund and review first.');
      const lines=(await client.query('SELECT * FROM public.bill_items WHERE bill_id=$1 ORDER BY id',[billId])).rows;
      const settings=bill.calculation_settings && Object.keys(bill.calculation_settings).length ? bill.calculation_settings : (await client.query('SELECT * FROM public.outlet_settings WHERE outlet_id=$1',[bill.outlet_id])).rows[0] || {};
      const computed=calculateBill(lines,settings,discountPaise);
      const {cgstPaise,sgstPaise,serviceChargePaise,tipPaise,roundingPaise,grandTotalPaise}=computed;
      const balancePaise=grandTotalPaise-paidPaise;
      if (balancePaise < 0) {
        throw new ConflictError(
          'Applying discount would reduce grand total below already paid amount. Refund excess before applying.'
        );
      }

      const newStatus = balancePaise === 0 && paidPaise > 0 ? 'SETTLED' : bill.status;

      // Update bill
      await client.query(
        `UPDATE public.bills
         SET discount_paise = $1,
             discount_reason_id = $2,
             discount_notes = $3,
             discount_approved_by_staff_id = $4,
             rounding_paise = $5,
             grand_total_paise = $6,
             balance_paise = $7,
             status = $8::text,
             settled_at = CASE WHEN $8::text = 'SETTLED' THEN CURRENT_TIMESTAMP ELSE settled_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9;`,
        [
          discountPaise,
          appReq.reason_code_id,
          appReq.notes || notes || null,
          approverStaffId,
          roundingPaise,
          grandTotalPaise,
          balancePaise,
          newStatus,
          billId
        ]
      );

      await client.query('UPDATE public.bills SET cgst_paise=$2,sgst_paise=$3,calculation_settings=$4 WHERE id=$1',[billId,cgstPaise,sgstPaise,JSON.stringify(settings)]);
      for(const item of computed.items) await client.query('UPDATE public.bill_items SET cgst_paise=$2,sgst_paise=$3,line_discount_paise=$4 WHERE id=$1',[item.id,item.cgstPaise,item.sgstPaise,item.lineDiscountPaise]);
      // Link bill_id on approval request
      await client.query(
        `UPDATE public.approval_requests SET bill_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [billId, approvalRequestId]
      );

      // Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'BILL_DISCOUNT_APPLIED',
          entityType: 'bills',
          entityId: billId,
          outletId: bill.outlet_id,
          oldState: {
            discountPaise: bill.discount_paise,
            grandTotalPaise: bill.grand_total_paise,
            balancePaise: bill.balance_paise
          },
          newState: {
            discountPaise,
            grandTotalPaise,
            balancePaise,
            approvalRequestId
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // Outlet event log
      await publishOutletEvent(
        {
          outletId: bill.outlet_id,
          channel: 'billing',
          eventType: 'BILL_UPDATED',
          entityId: billId,
          payload: {
            billId,
            invoiceNumber: bill.invoice_number,
            grandTotalPaise,
            discountPaise,
            balancePaise,
            status: newStatus
          }
        },
        client
      );

      return await BillingService.getBillById(billId, client);
    });

    return updatedBill;
  }

  /**
   * Processes a payment against an open bill (supports CASH, UPI, CARD, ROOM_FOLIO).
   * Transactional, handles split tenders, partial payments, and full bill settlement.
   */
  static async processPayment(params: {
    billId: string;
    paymentMethod: PaymentMethod;
    amountPaise: number;
    staffId: string;
    idempotencyKey: string;
    transactionReference?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    hotelStayId?: string;
    roomId?: string;
    notes?: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  },transactionClient?:pg.PoolClient): Promise<PaymentResponse> {
    const {
      billId,
      paymentMethod,
      amountPaise,
      staffId,
      idempotencyKey,
      transactionReference,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      hotelStayId,
      roomId,
      notes,
      reqCorrelationId,
      ipAddress
    } = params;

    const execute=async (client:pg.PoolClient):Promise<PaymentResponse> => {
      const ref=(await client.query('SELECT dining_session_id FROM public.bills WHERE id=$1',[billId])).rows[0];
      if(ref?.dining_session_id) {
        await client.query('SELECT rt.id FROM public.restaurant_tables rt JOIN public.dining_sessions ds ON ds.table_id=rt.id WHERE ds.id=$1 FOR UPDATE OF rt',[ref.dining_session_id]);
        await client.query('SELECT id FROM public.dining_sessions WHERE id=$1 FOR UPDATE',[ref.dining_session_id]);
        const unfinished=await client.query("SELECT id FROM public.orders WHERE dining_session_id=$1 AND status NOT IN ('SERVED','CANCELLED') LIMIT 1",[ref.dining_session_id]);
        if(unfinished.rows.length) throw new ConflictError('Orders must be served or cancelled before payment settlement.');
      }
      // 1. Lock bill FOR UPDATE
      const billRes = await client.query(
        'SELECT * FROM public.bills WHERE id = $1 FOR UPDATE;',
        [billId]
      );
      if (billRes.rows.length === 0) {
        throw new NotFoundError(`Bill '${billId}'`);
      }
      const bill = billRes.rows[0];

      if (bill.status === 'VOIDED') {
        throw new ConflictError('Cannot process payment on a voided bill');
      }
      if(bill.status==='PENDING_APPROVAL') throw new ConflictError('Bill approval is required before payment.');
      if(!Number.isSafeInteger(amountPaise) || amountPaise<=0) throw new BadRequestError('Invalid payment amount.');

      const balancePaise = parseInt(bill.balance_paise, 10);
      if (balancePaise <= 0 || bill.status === 'SETTLED') {
        throw new ConflictError(
          `Bill '${bill.invoice_number}' is already fully settled (balance: ₹0.00)`
        );
      }

      // 2. Overpayment and cash change handling
      let allocatedAmountPaise = amountPaise;
      let changeReturnedPaise = 0;

      if (amountPaise > balancePaise) {
        if (paymentMethod !== 'CASH') {
          throw new BadRequestError(
            `Payment amount of ₹${(amountPaise / 100).toFixed(2)} exceeds outstanding balance of ₹${(balancePaise / 100).toFixed(2)}`
          );
        }
        // For cash, accept higher tender, allocate exact outstanding balance, and return change
        allocatedAmountPaise = balancePaise;
        changeReturnedPaise = amountPaise - balancePaise;
      }

      // 3. Method-specific verifications
      let resolvedTxRef = transactionReference || null;

      if (paymentMethod === 'ROOM_FOLIO') {
        // Resolve active hotel stay
        let stayRow: any = null;
        if (hotelStayId) {
          const stayRes = await client.query(
            "SELECT * FROM public.hotel_stays WHERE id = $1 AND status = 'CHECKED_IN' FOR UPDATE;",
            [hotelStayId]
          );
          if (stayRes.rows.length > 0) stayRow = stayRes.rows[0];
        } else if (roomId) {
          const stayRes = await client.query(
            "SELECT * FROM public.hotel_stays WHERE room_id = $1 AND status = 'CHECKED_IN' FOR UPDATE;",
            [roomId]
          );
          if (stayRes.rows.length > 0) stayRow = stayRes.rows[0];
        } else if (bill.dining_session_id) {
          const sessRes = await client.query(
            'SELECT hotel_stay_id FROM public.dining_sessions WHERE id = $1;',
            [bill.dining_session_id]
          );
          if (sessRes.rows[0]?.hotel_stay_id) {
            const stayRes = await client.query(
              "SELECT * FROM public.hotel_stays WHERE id = $1 AND status = 'CHECKED_IN' FOR UPDATE;",
              [sessRes.rows[0].hotel_stay_id]
            );
            if (stayRes.rows.length > 0) stayRow = stayRes.rows[0];
          }
        }

        if (!stayRow) {
          throw new BadRequestError(
            'No active checked-in hotel stay found for room folio payment'
          );
        }

        // Resolve open folio
        const folioRes = await client.query(
          "SELECT * FROM public.room_folios WHERE stay_id = $1 AND status = 'OPEN' FOR UPDATE;",
          [stayRow.id]
        );
        if (folioRes.rows.length === 0) {
          throw new UnprocessableEntityError('No open room folio found for active hotel stay');
        }
        const folio = folioRes.rows[0];

        // Insert folio_charges
        const chargeDesc = `Dining bill ${bill.invoice_number}${notes ? ` - ${notes}` : ''}`;
        const chargeRes = await client.query(
          `INSERT INTO public.folio_charges (
            folio_id, charge_type, outlet_id, bill_id, amount_paise, description, posted_by_staff_id
          ) VALUES ($1, 'RESTAURANT_DINING', $2, $3, $4, $5, $6)
          RETURNING id;`,
          [folio.id, bill.outlet_id, bill.id, allocatedAmountPaise, chargeDesc, staffId]
        );

        // Update room folio balances
        await client.query(
          `UPDATE public.room_folios
           SET total_charges_paise = total_charges_paise + $1,
               outstanding_balance_paise = outstanding_balance_paise + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2;`,
          [allocatedAmountPaise, folio.id]
        );

        resolvedTxRef = `FOLIO:${folio.id}:${chargeRes.rows[0].id}`;
      }

      if (razorpayOrderId || razorpayPaymentId || razorpaySignature) {
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
          throw new BadRequestError(
            'All of razorpayOrderId, razorpayPaymentId, and razorpaySignature are required for gateway-verified payments'
          );
        }

        // Replay prevention: ensure razorpay_payment_id has not already been captured
        const existingGatewayPaymentRes = await client.query(
          "SELECT id FROM public.payments WHERE razorpay_payment_id = $1 AND status != 'FAILED';",
          [razorpayPaymentId.trim()]
        );
        if (existingGatewayPaymentRes.rows.length > 0) {
          throw new ConflictError(
            `Razorpay payment ID '${razorpayPaymentId}' has already been processed and captured`
          );
        }

        // Fail-closed HMAC-SHA256 signature verification
        const isValid = verifyRazorpaySignature({
          orderId: razorpayOrderId.trim(),
          paymentId: razorpayPaymentId.trim(),
          signature: razorpaySignature.trim()
        });
        if (!isValid) {
          throw new BadRequestError('Invalid Razorpay payment signature verification');
        }
      }

      if(['UPI','CARD'].includes(paymentMethod)) throw new UnprocessableEntityError('Online payment collection is blocked — CLIENT API REQUIRED. Provider capture verification is unavailable.');

      // 4. Insert payment
      const paymentAmountToRecord = paymentMethod === 'CASH' ? allocatedAmountPaise : amountPaise;
      const insertPaymentQuery = `
        INSERT INTO public.payments (
          bill_id,
          outlet_id,
          payment_method,
          amount_paise,
          status,
          transaction_reference,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          processed_by_staff_id,
          idempotency_key
        ) VALUES ($1, $2, $3, $4, 'CAPTURED', $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;

      const paymentRes = await client.query(insertPaymentQuery, [
        bill.id,
        bill.outlet_id,
        paymentMethod,
        paymentAmountToRecord,
        resolvedTxRef,
        razorpayOrderId || null,
        razorpayPaymentId || null,
        razorpaySignature || null,
        staffId,
        idempotencyKey
      ]);
      const paymentRow = paymentRes.rows[0];

      // 5. Insert payment allocation
      const insertAllocQuery = `
        INSERT INTO public.payment_allocations (
          payment_id, bill_id, allocated_amount_paise
        ) VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const allocRes = await client.query(insertAllocQuery, [
        paymentRow.id,
        bill.id,
        allocatedAmountPaise
      ]);
      const allocRow = allocRes.rows[0];

      // 6. Recalculate bill paid and balance amounts
      const newPaidPaise = parseInt(bill.paid_paise || '0', 10) + allocatedAmountPaise;
      const newBalancePaise = parseInt(bill.grand_total_paise, 10) - newPaidPaise;
      const isFullySettled = newBalancePaise === 0;
      const newBillStatus: BillStatus = isFullySettled
        ? 'SETTLED'
        : bill.status === 'DRAFT'
          ? 'APPROVED'
          : bill.status;

      await client.query(
        `UPDATE public.bills
         SET paid_paise = $1,
             balance_paise = $2,
             status = $3::text,
             settled_at = CASE WHEN $3::text = 'SETTLED' THEN CURRENT_TIMESTAMP ELSE settled_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4;`,
        [newPaidPaise, newBalancePaise, newBillStatus, bill.id]
      );

      // 7. Audit log for payment
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'PAYMENT_CAPTURED',
          entityType: 'payments',
          entityId: paymentRow.id,
          outletId: bill.outlet_id,
          oldState: null,
          newState: {
            billId: bill.id,
            paymentMethod,
            amountPaise: paymentAmountToRecord,
            allocatedAmountPaise,
            changeReturnedPaise,
            newBillBalancePaise: newBalancePaise
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 8. Outlet event log for payment
      await publishOutletEvent(
        {
          outletId: bill.outlet_id,
          channel: 'billing',
          eventType: 'PAYMENT_CAPTURED',
          entityId: paymentRow.id,
          payload: {
            paymentId: paymentRow.id,
            billId: bill.id,
            invoiceNumber: bill.invoice_number,
            paymentMethod,
            amountPaise: paymentAmountToRecord,
            balancePaise: newBalancePaise,
            isFullySettled
          }
        },
        client
      );

      // 9. If bill is fully settled, write additional settlement events and free table
      if (isFullySettled) {
        if (bill.dining_session_id) {
          const sessRes = await client.query(
            `UPDATE public.dining_sessions
             SET status = 'CLOSED',
                 closed_at = COALESCE(closed_at,CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING table_id;`,
            [bill.dining_session_id]
          );

          const tableId = sessRes.rows[0]?.table_id;
          if (tableId) {
            await client.query(
              `UPDATE public.restaurant_tables
               SET active_dining_session_id = NULL,
                   status = 'AVAILABLE',
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1 AND active_dining_session_id=$2;`,
              [tableId,bill.dining_session_id]
            );
          }

          await client.query(
            `UPDATE public.guest_session_tokens
             SET is_revoked = true
             WHERE dining_session_id = $1 AND is_revoked = false;`,
            [bill.dining_session_id]
          );

          const tableCheck = await client.query(
            "SELECT to_regclass('public.settlement_requests') AS tbl;"
          );
          if (tableCheck.rows[0]?.tbl) {
            await client.query(
              `UPDATE public.settlement_requests
               SET status = 'COMPLETED',
                   resolved_by_staff_id = $1,
                   resolved_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE dining_session_id = $2 AND status IN ('PENDING', 'ACCEPTED');`,
              [staffId, bill.dining_session_id]
            );
          }
        }

        await writeAuditLog(
          {
            actorType: 'STAFF',
            actorId: staffId,
            action: 'BILL_SETTLED',
            entityType: 'bills',
            entityId: bill.id,
            outletId: bill.outlet_id,
            oldState: { status: bill.status, balancePaise: bill.balance_paise },
            newState: { status: 'SETTLED', balancePaise: 0 },
            requestId: reqCorrelationId || 'unknown',
            ipAddress
          },
          client
        );

        await publishOutletEvent(
          {
            outletId: bill.outlet_id,
            channel: 'billing',
            eventType: 'BILL_SETTLED',
            entityId: bill.id,
            payload: {
              billId: bill.id,
              invoiceNumber: bill.invoice_number,
              grandTotalPaise: bill.grand_total_paise,
              paidPaise: newPaidPaise,
              status: 'SETTLED'
            }
          },
          client
        );
      }

      const allocationResponse: PaymentAllocationResponse = {
        id: allocRow.id,
        paymentId: allocRow.payment_id,
        billId: allocRow.bill_id,
        allocatedAmountPaise: parseInt(allocRow.allocated_amount_paise, 10),
        createdAt: formatDate(allocRow.created_at) || new Date().toISOString()
      };

      const billSummary = {
        id: bill.id,
        invoiceNumber: bill.invoice_number,
        diningSessionId: bill.dining_session_id,
        subtotalPaise: parseInt(bill.subtotal_paise, 10),
        cgstPaise: parseInt(bill.cgst_paise || '0', 10),
        sgstPaise: parseInt(bill.sgst_paise || '0', 10),
        grandTotalPaise: parseInt(bill.grand_total_paise, 10),
        paidPaise: newPaidPaise,
        balancePaise: newBalancePaise,
        status: newBillStatus,
        settledAt: isFullySettled ? new Date().toISOString() : null
      };

      return mapPaymentRow(
        paymentRow,
        [allocationResponse],
        billSummary,
        changeReturnedPaise > 0 ? changeReturnedPaise : undefined
      );
    };
    const result=transactionClient ? await execute(transactionClient) : await withTransaction(execute);

    // Standalone operations notify after commit; parent transactions retain the durable event journal.
    if(!transactionClient) realtimeBroadcaster
      .publish({
        outletId: result.outletId,
        channel: 'billing',
        sequenceNumber: 1,
        eventType: 'PAYMENT_CAPTURED',
        payload: {
          paymentId: result.id,
          billId: result.billId,
          amountPaise: result.amountPaise,
          status: result.status
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return result;
  }

  /**
   * Retrieves a single payment record by ID with its allocations.
   */
  static async getPaymentById(paymentId: string): Promise<PaymentResponse> {
    const pool = getDbPool();
    const payRes = await pool.query(
      'SELECT * FROM public.payments WHERE id = $1;',
      [paymentId]
    );
    if (payRes.rows.length === 0) {
      throw new NotFoundError(`Payment '${paymentId}'`);
    }
    const payRow = payRes.rows[0];

    const allocRes = await pool.query(
      'SELECT * FROM public.payment_allocations WHERE payment_id = $1;',
      [paymentId]
    );
    const allocations: PaymentAllocationResponse[] = allocRes.rows.map((r) => ({
      id: r.id,
      paymentId: r.payment_id,
      billId: r.bill_id,
      allocatedAmountPaise: parseInt(r.allocated_amount_paise, 10),
      createdAt: formatDate(r.created_at) || new Date().toISOString()
    }));

    const billRes = await pool.query(
      'SELECT invoice_number, grand_total_paise, paid_paise, balance_paise, status FROM public.bills WHERE id = $1;',
      [payRow.bill_id]
    );
    const b = billRes.rows[0];
    const billSummary = b
      ? {
          invoiceNumber: b.invoice_number,
          grandTotalPaise: parseInt(b.grand_total_paise, 10),
          paidPaise: parseInt(b.paid_paise, 10),
          balancePaise: parseInt(b.balance_paise, 10),
          status: b.status as BillStatus
        }
      : undefined;

    return mapPaymentRow(payRow, allocations, billSummary);
  }

  /**
   * Lists all payments and their allocations recorded against a bill.
   */
  static async listBillPayments(billId: string): Promise<PaymentResponse[]> {
    const pool = getDbPool();
    const payRes = await pool.query(
      'SELECT * FROM public.payments WHERE bill_id = $1 ORDER BY created_at ASC;',
      [billId]
    );
    if (payRes.rows.length === 0) {
      return [];
    }

    const payIds = payRes.rows.map((r) => r.id);
    const allocRes = await pool.query(
      'SELECT * FROM public.payment_allocations WHERE payment_id = ANY($1::uuid[]);',
      [payIds]
    );

    const allocMap = new Map<string, PaymentAllocationResponse[]>();
    for (const r of allocRes.rows) {
      const list = allocMap.get(r.payment_id) || [];
      list.push({
        id: r.id,
        paymentId: r.payment_id,
        billId: r.bill_id,
        allocatedAmountPaise: parseInt(r.allocated_amount_paise, 10),
        createdAt: formatDate(r.created_at) || new Date().toISOString()
      });
      allocMap.set(r.payment_id, list);
    }

    return payRes.rows.map((r) => mapPaymentRow(r, allocMap.get(r.id) || []));
  }

  /**
   * Processes a financial refund against a captured or partially refunded payment.
   * Transactional, respects cumulative limits, and adjusts bill paid and balance amounts.
   */
  static async processRefund(params: {
    paymentId: string;
    amountPaise: number;
    reason: string;
    gatewayRefundId?: string;
    staffId: string;
    idempotencyKey: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  },transactionClient?:pg.PoolClient): Promise<RefundResponse> {
    const {
      paymentId,
      amountPaise,
      reason,
      gatewayRefundId,
      staffId,
      idempotencyKey,
      reqCorrelationId,
      ipAddress
    } = params;

    const execute=async (client:pg.PoolClient):Promise<RefundResponse> => {
      // 1. Lock payment FOR UPDATE
      const payRes = await client.query(
        'SELECT * FROM public.payments WHERE id = $1 FOR UPDATE;',
        [paymentId]
      );
      if (payRes.rows.length === 0) {
        throw new NotFoundError(`Payment '${paymentId}'`);
      }
      const payment = payRes.rows[0];

      if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
        throw new ConflictError(
          `Cannot refund payment with status '${payment.status}'. Only CAPTURED or PARTIALLY_REFUNDED payments may be refunded.`
        );
      }

      // 2. Cumulative refund and allocation validation
      const allocRes = await client.query(
        'SELECT COALESCE(SUM(allocated_amount_paise), 0) AS total_allocated FROM public.payment_allocations WHERE payment_id = $1 AND bill_id = $2;',
        [payment.id, payment.bill_id]
      );
      const totalAllocatedToBill = parseInt(allocRes.rows[0]?.total_allocated || '0', 10);
      if (totalAllocatedToBill === 0) {
        throw new ConflictError('Payment has no active allocations recorded for parent bill');
      }

      const refCountRes = await client.query(
        "SELECT COALESCE(SUM(amount_paise), 0) AS total_refunded FROM public.refunds WHERE payment_id = $1 AND status = 'PROCESSED';",
        [paymentId]
      );
      const priorRefunded = parseInt(refCountRes.rows[0].total_refunded, 10);
      const paymentAmount = parseInt(payment.amount_paise, 10);

      if (priorRefunded + amountPaise > paymentAmount) {
        throw new BadRequestError(
          `Cumulative refund of ₹${((priorRefunded + amountPaise) / 100).toFixed(2)} exceeds captured payment amount of ₹${(paymentAmount / 100).toFixed(2)}`
        );
      }

      if (priorRefunded + amountPaise > totalAllocatedToBill) {
        throw new BadRequestError(
          `Refund of ₹${(amountPaise / 100).toFixed(2)} exceeds allocated amount of ₹${(totalAllocatedToBill / 100).toFixed(2)} for this bill`
        );
      }

      // 3. Lock parent bill FOR UPDATE
      const billRes = await client.query(
        'SELECT * FROM public.bills WHERE id = $1 FOR UPDATE;',
        [payment.bill_id]
      );
      if (billRes.rows.length === 0) {
        throw new NotFoundError(`Parent bill '${payment.bill_id}'`);
      }
      const bill = billRes.rows[0];

      if(['UPI','CARD'].includes(payment.payment_method)) throw new UnprocessableEntityError('Online refunds are blocked — CLIENT API REQUIRED.');
      // 4. Insert refund record
      const insertRefundQuery = `
        INSERT INTO public.refunds (
          payment_id,
          amount_paise,
          reason,
          gateway_refund_id,
          status,
          approved_by_staff_id,
          idempotency_key
        ) VALUES ($1, $2, $3, $4, 'PROCESSED', $5, $6)
        RETURNING *;
      `;
      const refRes = await client.query(insertRefundQuery, [
        payment.id,
        amountPaise,
        reason,
        gatewayRefundId || null,
        staffId,
        idempotencyKey
      ]);
      const refundRow = refRes.rows[0];

      // 5. Update payment status
      const totalRefundedNow = priorRefunded + amountPaise;
      const newPaymentStatus: PaymentStatus =
        totalRefundedNow === paymentAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      await client.query(
        `UPDATE public.payments
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [newPaymentStatus, payment.id]
      );

      // 6. Recalculate bill paid and balance amounts
      const currentPaid = parseInt(bill.paid_paise || '0', 10);
      const grandTotal = parseInt(bill.grand_total_paise, 10);
      const newPaid = Math.max(0, currentPaid - amountPaise);
      const newBalance = grandTotal - newPaid;

      // If bill was previously SETTLED, revert to APPROVED because balance is now positive
      const newBillStatus: BillStatus = newBalance > 0 && bill.status === 'SETTLED' ? 'APPROVED' : bill.status;

      await client.query(
        `UPDATE public.bills
         SET paid_paise = $1,
             balance_paise = $2,
             status = $3::text,
             settled_at = CASE WHEN $3::text = 'SETTLED' THEN settled_at ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4;`,
        [newPaid, newBalance, newBillStatus, bill.id]
      );

      // 7. If ROOM_FOLIO, adjust folio balances
      if (payment.payment_method === 'ROOM_FOLIO') {
        const folioChargeRes = await client.query(
          'SELECT folio_id FROM public.folio_charges WHERE bill_id = $1 LIMIT 1;',
          [bill.id]
        );
        if (folioChargeRes.rows.length > 0) {
          const folioId = folioChargeRes.rows[0].folio_id;
          await client.query(
            `UPDATE public.room_folios
             SET total_charges_paise = GREATEST(0, total_charges_paise - $1),
                 outstanding_balance_paise = GREATEST(0, outstanding_balance_paise - $1),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2;`,
            [amountPaise, folioId]
          );
        }
      }

      // 8. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'REFUND_PROCESSED',
          entityType: 'refunds',
          entityId: refundRow.id,
          outletId: payment.outlet_id,
          oldState: {
            paymentStatus: payment.status,
            billPaidPaise: currentPaid,
            billBalancePaise: bill.balance_paise
          },
          newState: {
            refundAmountPaise: amountPaise,
            paymentStatus: newPaymentStatus,
            billPaidPaise: newPaid,
            billBalancePaise: newBalance
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 9. Outlet event log
      await publishOutletEvent(
        {
          outletId: payment.outlet_id,
          channel: 'billing',
          eventType: 'REFUND_PROCESSED',
          entityId: refundRow.id,
          payload: {
            refundId: refundRow.id,
            paymentId: payment.id,
            billId: bill.id,
            amountPaise,
            newPaymentStatus,
            newBillBalancePaise: newBalance
          }
        },
        client
      );

      const paymentSummary = {
        paymentId: payment.id,
        amountPaise: paymentAmount,
        status: newPaymentStatus
      };

      const billSummary = {
        billId: bill.id,
        invoiceNumber: bill.invoice_number,
        paidPaise: newPaid,
        balancePaise: newBalance,
        status: newBillStatus
      };

      return mapRefundRow(refundRow, paymentSummary, billSummary);
    };
    const refund=transactionClient ? await execute(transactionClient) : await withTransaction(execute);

    // Standalone operations notify after commit; parent transactions retain the durable event journal.
    if(!transactionClient) realtimeBroadcaster
      .publish({
        outletId: refund.billSummary?.billId || '',
        channel: 'billing',
        sequenceNumber: 1,
        eventType: 'REFUND_PROCESSED',
        payload: {
          refundId: refund.id,
          paymentId: refund.paymentId,
          amountPaise: refund.amountPaise
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return refund;
  }

  /**
   * Lists all refunds processed against a specific payment.
   */
  static async listPaymentRefunds(paymentId: string): Promise<RefundResponse[]> {
    const pool = getDbPool();
    const res = await pool.query(
      'SELECT * FROM public.refunds WHERE payment_id = $1 ORDER BY created_at ASC;',
      [paymentId]
    );
    return res.rows.map((r) => mapRefundRow(r));
  }

  /**
   * Retrieves the active non-voided bill for an authenticated guest's session.
   */
  static async getGuestBill(sessionId: string): Promise<BillResponse> {
    const pool = getDbPool();
    const res = await pool.query(
      `SELECT id FROM public.bills WHERE dining_session_id = $1 AND status != 'VOIDED' ORDER BY created_at DESC LIMIT 1;`,
      [sessionId]
    );

    if (res.rows.length > 0) {
      return await BillingService.getBillById(res.rows[0].id);
    }

    // If no bill has been generated yet, calculate ephemeral bill preview from active order items
    try {
      const preview = await BillingService.previewBill(sessionId);
      return {
        id: `preview-${sessionId}`,
        outletId: preview.outletId,
        diningSessionId: sessionId,
        invoiceNumber: 'PROFORMA',
        subtotalPaise: preview.subtotalPaise,
        discountPaise: preview.discountPaise,
        discountReasonId: null,
        discountNotes: null,
        discountApprovedByStaffId: null,
        cgstPaise: preview.cgstPaise,
        sgstPaise: preview.sgstPaise,
        serviceChargePaise: preview.serviceChargePaise,
        tipPaise: preview.tipPaise,
        roundingPaise: preview.roundingPaise,
        grandTotalPaise: preview.grandTotalPaise,
        paidPaise: 0,
        balancePaise: preview.grandTotalPaise,
        status: 'DRAFT',
        generatedByStaffId: 'SYSTEM',
        settledAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: preview.items.map((it) => ({
          id: it.orderItemId,
          billId: `preview-${sessionId}`,
          orderItemId: it.orderItemId,
          itemName: it.itemName,
          unitPricePaise: it.unitPricePaise,
          quantity: it.quantity,
          totalPricePaise: it.totalPricePaise,
          gstRatePercent: it.gstRatePercent,
          cgstPaise: it.cgstPaise,
          sgstPaise: it.sgstPaise,
          createdAt: new Date().toISOString()
        }))
      };
    } catch (err: any) {
      if (err instanceof UnprocessableEntityError && err.message==='No billable orders found for dining session') {
        const sessRes = await pool.query('SELECT outlet_id FROM public.dining_sessions WHERE id = $1;', [sessionId]);
        const outletId = sessRes.rows[0]?.outlet_id || '';
        return {
          id: `preview-${sessionId}`,
          outletId,
          diningSessionId: sessionId,
          invoiceNumber: 'PROFORMA',
          subtotalPaise: 0,
          discountPaise: 0,
          discountReasonId: null,
          discountNotes: null,
          discountApprovedByStaffId: null,
          cgstPaise: 0,
          sgstPaise: 0,
          serviceChargePaise: 0,
          tipPaise: 0,
          roundingPaise: 0,
          grandTotalPaise: 0,
          paidPaise: 0,
          balancePaise: 0,
          status: 'DRAFT',
          generatedByStaffId: 'SYSTEM',
          settledAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: []
        };
      }
      throw err;
    }
  }

  static async previewSessionBill(sessionId: string): Promise<BillPreviewResponse> {
    return this.previewBill(sessionId);
  }

  /**
   * Lists payment transactions for an outlet within a date range with summary totals per method.
   * All monetary figures are in integer paise.
   */
  static async listOutletPayments(params: {
    outletId: string;
    from?: string;
    to?: string;
    method?: PaymentMethod;
    status?: PaymentStatus;
    limit?: number;
    cursor?: string;
  }): Promise<OutletPaymentsResponse> {
    const { outletId, method, status, limit = 50, cursor } = params;
    const pool = getDbPool();

    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString();
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const fromDate = params.from
      ? (/^\d{4}-\d{2}-\d{2}$/.test(params.from) ? `${params.from}T00:00:00.000Z` : new Date(params.from).toISOString())
      : defaultStart;
    const toDate = params.to
      ? (/^\d{4}-\d{2}-\d{2}$/.test(params.to) ? `${params.to}T23:59:59.999Z` : new Date(params.to).toISOString())
      : defaultEnd;

    const conditions: string[] = [
      'p.outlet_id = $1',
      'p.created_at >= $2',
      'p.created_at <= $3'
    ];
    const values: any[] = [outletId, fromDate, toDate];
    let paramIndex = 4;

    if (method) {
      conditions.push(`p.payment_method = $${paramIndex++}`);
      values.push(method);
    }

    if (status) {
      conditions.push(`p.status = $${paramIndex++}`);
      values.push(status);
    }

    if (cursor) {
      conditions.push(`p.created_at < $${paramIndex++}`);
      values.push(cursor);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Calculate totals per payment method within the date range for the outlet
    const totalsCondition = ['p.outlet_id = $1', 'p.created_at >= $2', 'p.created_at <= $3', "p.status IN ('CAPTURED','PARTIALLY_REFUNDED')"];
    const totalsValues: any[] = [outletId, fromDate, toDate];
    if (method) {totalsValues.push(method);totalsCondition.push(`p.payment_method=$${totalsValues.length}`);}
    if (status) {totalsValues.push(status);totalsCondition.push(`p.status=$${totalsValues.length}`);}
    const totalsQuery = `
      SELECT p.payment_method,
        COALESCE(SUM(p.amount_paise - COALESCE((SELECT SUM(r.amount_paise) FROM public.refunds r WHERE r.payment_id=p.id AND r.status='PROCESSED'),0)),0) AS total_paise
      FROM public.payments p WHERE ${totalsCondition.join(' AND ')} GROUP BY p.payment_method;
    `;
    const totalsRes = await pool.query(totalsQuery, totalsValues);

    const totalsByMethod: Record<PaymentMethod, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      ROOM_FOLIO: 0
    };
    let totalAmountPaise = 0;

    for (const r of totalsRes.rows) {
      const amt = parseInt(r.total_paise, 10) || 0;
      if (r.payment_method in totalsByMethod) {
        totalsByMethod[r.payment_method as PaymentMethod] = amt;
      }
      totalAmountPaise += amt;
    }

    // 2. Count total rows matching criteria
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM public.payments p
      WHERE ${whereClause};
    `;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // 3. Query payment rows with joined bill, table, and staff
    const listQuery = `
      SELECT
        p.id,
        p.bill_id,
        p.outlet_id,
        p.payment_method,
        p.amount_paise,
        p.status,
        p.transaction_reference,
        p.created_at,
        p.processed_by_staff_id,
        b.invoice_number AS bill_number,
        rt.table_number,
        TRIM(CONCAT(s.first_name, ' ', s.last_name)) AS processed_by_name
      FROM public.payments p
      JOIN public.bills b ON p.bill_id = b.id
      LEFT JOIN public.dining_sessions ds ON b.dining_session_id = ds.id
      LEFT JOIN public.restaurant_tables rt ON ds.table_id = rt.id
      JOIN public.staff s ON p.processed_by_staff_id = s.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++};
    `;

    const listRes = await pool.query(listQuery, [...values, limit]);

    const items: OutletPaymentItem[] = listRes.rows.map((r) => ({
      id: r.id,
      billId: r.bill_id,
      outletId: r.outlet_id,
      billNumber: r.bill_number,
      tableNumber: r.table_number || null,
      tenderMethod: r.payment_method as PaymentMethod,
      amountPaise: parseInt(r.amount_paise, 10),
      status: r.status as PaymentStatus,
      processedByStaffId: r.processed_by_staff_id,
      processedByName: r.processed_by_name ? r.processed_by_name.trim() : 'Staff Member',
      transactionReference: r.transaction_reference || null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));

    const nextCursor =
      items.length === limit && items.length > 0
        ? items[items.length - 1].createdAt
        : null;

    return {
      items,
      totalsByMethod,
      totalAmountPaise,
      total,
      nextCursor
    };
  }

  /**
   * Creates a settlement request for a dining session (waiter requesting cashier settlement).
   * Validates that dining session is ACTIVE or BILLED, ensures table exists,
   * generates or links bill, prevents duplicate open requests, and emits audit & event log.
   */
  static async createSettlementRequest(
    input: CreateSettlementRequestInput,
    transactionClient?: pg.PoolClient
  ): Promise<SettlementRequestResponse> {
    const { sessionId, staffId, paymentMethodPreference = 'CASH', notes, reqCorrelationId, ipAddress } = input;

    const execute = async (client: pg.PoolClient): Promise<SettlementRequestResponse> => {
      // 1. Lock dining session and table
      const sessionRes = await client.query(
        `SELECT ds.id, ds.outlet_id, ds.table_id, ds.status, rt.table_number
         FROM public.dining_sessions ds
         JOIN public.restaurant_tables rt ON rt.id = ds.table_id
         WHERE ds.id = $1 FOR UPDATE OF ds, rt;`,
        [sessionId]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundError(`Dining session '${sessionId}'`);
      }

      const session = sessionRes.rows[0];

      if (!['ACTIVE', 'BILLED'].includes(session.status)) {
        throw new ConflictError(
          `Cannot request settlement for dining session in status '${session.status}'`
        );
      }

      // Check for unfinished orders
      const unfinishedOrders = await client.query(
        `SELECT id, order_number, status
         FROM public.orders
         WHERE dining_session_id = $1 AND status NOT IN ('SERVED', 'CANCELLED')
         LIMIT 1;`,
        [sessionId]
      );
      if (unfinishedOrders.rows.length > 0) {
        throw new ConflictError(
          `Order #${unfinishedOrders.rows[0].order_number} is still '${unfinishedOrders.rows[0].status}'. All orders must be marked Served before requesting settlement.`
        );
      }

      // 2. Prevent duplicate open settlement requests
      const existingReqRes = await client.query(
        `SELECT id, status, created_at FROM public.settlement_requests
         WHERE dining_session_id = $1 AND status IN ('PENDING', 'ACCEPTED');`,
        [sessionId]
      );
      if (existingReqRes.rows.length > 0) {
        throw new ConflictError(
          'A settlement request is already pending or accepted for this table sitting.'
        );
      }

      // 3. Resolve or generate bill for session
      let billId: string | null = null;
      let billRow: any = null;

      const existingBillRes = await client.query(
        `SELECT id, invoice_number, subtotal_paise, grand_total_paise, balance_paise, status
         FROM public.bills
         WHERE dining_session_id = $1 AND status != 'VOIDED'
         ORDER BY created_at DESC LIMIT 1;`,
        [sessionId]
      );

      if (existingBillRes.rows.length > 0) {
        billRow = existingBillRes.rows[0];
        billId = billRow.id;
      } else {
        // The waiter requests settlement; authorized billing staff generate the bill.
        // A pending settlement request may exist without an invoice.
        billId = null;
      }

      // 4. Insert settlement request
      const insertQuery = `
        INSERT INTO public.settlement_requests (
          outlet_id, dining_session_id, table_id, bill_id,
          requested_by_staff_id, payment_method_preference, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        RETURNING *;
      `;
      const insertRes = await client.query(insertQuery, [
        session.outlet_id,
        sessionId,
        session.table_id,
        billId,
        staffId,
        paymentMethodPreference,
        notes || null
      ]);
      const reqRow = insertRes.rows[0];

      // Mark table status as 'BILLED' if not already
      await client.query(
        `UPDATE public.restaurant_tables SET status = 'BILLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status != 'BILLED';`,
        [session.table_id]
      );
      await client.query(
        `UPDATE public.dining_sessions SET status = 'BILLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'ACTIVE';`,
        [sessionId]
      );

      // Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'SETTLEMENT_REQUEST_CREATED',
          entityType: 'settlement_requests',
          entityId: reqRow.id,
          outletId: session.outlet_id,
          oldState: null,
          newState: {
            requestId: reqRow.id,
            diningSessionId: sessionId,
            tableNumber: session.table_number,
            billId,
            invoiceNumber: billRow?.invoice_number,
            paymentMethodPreference
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // Publish event
      await publishOutletEvent(
        {
          outletId: session.outlet_id,
          channel: 'billing',
          eventType: 'SETTLEMENT_REQUEST_CREATED',
          entityId: reqRow.id,
          payload: {
            requestId: reqRow.id,
            diningSessionId: sessionId,
            tableId: session.table_id,
            tableNumber: session.table_number,
            billId,
            invoiceNumber: billRow?.invoice_number,
            grandTotalPaise: billRow ? parseInt(billRow.grand_total_paise, 10) : 0,
            paymentMethodPreference,
            status: 'PENDING'
          }
        },
        client
      );

      // Fetch staff name
      const staffRes = await client.query(
        `SELECT TRIM(CONCAT(first_name, ' ', last_name)) AS staff_name FROM public.staff WHERE id = $1;`,
        [staffId]
      );

      return {
        id: reqRow.id,
        outletId: reqRow.outlet_id,
        diningSessionId: reqRow.dining_session_id,
        tableId: reqRow.table_id,
        tableNumber: session.table_number,
        billId: reqRow.bill_id,
        invoiceNumber: billRow?.invoice_number || null,
        subtotalPaise: billRow ? parseInt(billRow.subtotal_paise, 10) : 0,
        grandTotalPaise: billRow ? parseInt(billRow.grand_total_paise, 10) : 0,
        balancePaise: billRow ? parseInt(billRow.balance_paise, 10) : 0,
        requestedByStaffId: reqRow.requested_by_staff_id,
        requestedByStaffName: staffRes.rows[0]?.staff_name || 'Staff Server',
        paymentMethodPreference: reqRow.payment_method_preference,
        notes: reqRow.notes,
        status: reqRow.status,
        resolvedByStaffId: null,
        resolvedByStaffName: null,
        resolvedAt: null,
        createdAt: formatDate(reqRow.created_at) || new Date().toISOString(),
        updatedAt: formatDate(reqRow.updated_at) || new Date().toISOString()
      };
    };

    if (transactionClient) {
      return await execute(transactionClient);
    }
    return await withTransaction(execute);
  }

  /**
   * Retrieves a settlement request by its UUID.
   */
  static async getSettlementRequestById(
    requestId: string,
    client?: pg.PoolClient
  ): Promise<SettlementRequestResponse> {
    const runner = client || getDbPool();
    const query = `
      SELECT 
        sr.id, sr.outlet_id, sr.dining_session_id, sr.table_id, sr.bill_id,
        sr.requested_by_staff_id, sr.payment_method_preference, sr.notes, sr.status,
        sr.resolved_by_staff_id, sr.resolved_at, sr.created_at, sr.updated_at,
        rt.table_number,
        TRIM(CONCAT(req_s.first_name, ' ', req_s.last_name)) AS requested_by_staff_name,
        TRIM(CONCAT(res_s.first_name, ' ', res_s.last_name)) AS resolved_by_staff_name,
        b.invoice_number,
        COALESCE(b.subtotal_paise, 0) AS subtotal_paise,
        COALESCE(b.grand_total_paise, 0) AS grand_total_paise,
        COALESCE(b.balance_paise, 0) AS balance_paise
      FROM public.settlement_requests sr
      JOIN public.restaurant_tables rt ON rt.id = sr.table_id
      LEFT JOIN public.staff req_s ON req_s.id = sr.requested_by_staff_id
      LEFT JOIN public.staff res_s ON res_s.id = sr.resolved_by_staff_id
      LEFT JOIN public.bills b ON b.id = sr.bill_id
      WHERE sr.id = $1;
    `;
    const res = await runner.query(query, [requestId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Settlement request '${requestId}'`);
    }
    const row = res.rows[0];
    return {
      id: row.id,
      outletId: row.outlet_id,
      diningSessionId: row.dining_session_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      billId: row.bill_id,
      invoiceNumber: row.invoice_number || null,
      subtotalPaise: parseInt(row.subtotal_paise, 10),
      grandTotalPaise: parseInt(row.grand_total_paise, 10),
      balancePaise: parseInt(row.balance_paise, 10),
      requestedByStaffId: row.requested_by_staff_id,
      requestedByStaffName: row.requested_by_staff_name || 'Staff Server',
      paymentMethodPreference: row.payment_method_preference,
      notes: row.notes,
      status: row.status,
      resolvedByStaffId: row.resolved_by_staff_id,
      resolvedByStaffName: row.resolved_by_staff_name || null,
      resolvedAt: formatDate(row.resolved_at),
      createdAt: formatDate(row.created_at) || new Date().toISOString(),
      updatedAt: formatDate(row.updated_at) || new Date().toISOString()
    };
  }

  /**
   * Lists settlement requests for an outlet, ordered by pending first, then newest.
   */
  static async listSettlementRequests(
    outletId: string,
    statusFilter?: string,
    limit: number = 50
  ): Promise<{ items: SettlementRequestResponse[]; total: number }> {
    const pool = getDbPool();

    let statusCondition = "sr.status IN ('PENDING', 'ACCEPTED')";
    const values: any[] = [outletId];

    if (statusFilter && statusFilter !== 'ALL') {
      statusCondition = "sr.status = $2";
      values.push(statusFilter);
    }

    const query = `
      SELECT 
        sr.id, sr.outlet_id, sr.dining_session_id, sr.table_id, sr.bill_id,
        sr.requested_by_staff_id, sr.payment_method_preference, sr.notes, sr.status,
        sr.resolved_by_staff_id, sr.resolved_at, sr.created_at, sr.updated_at,
        rt.table_number,
        TRIM(CONCAT(req_s.first_name, ' ', req_s.last_name)) AS requested_by_staff_name,
        TRIM(CONCAT(res_s.first_name, ' ', res_s.last_name)) AS resolved_by_staff_name,
        b.invoice_number,
        COALESCE(b.subtotal_paise, 0) AS subtotal_paise,
        COALESCE(b.grand_total_paise, 0) AS grand_total_paise,
        COALESCE(b.balance_paise, 0) AS balance_paise
      FROM public.settlement_requests sr
      JOIN public.restaurant_tables rt ON rt.id = sr.table_id
      LEFT JOIN public.staff req_s ON req_s.id = sr.requested_by_staff_id
      LEFT JOIN public.staff res_s ON res_s.id = sr.resolved_by_staff_id
      LEFT JOIN public.bills b ON b.id = sr.bill_id
      WHERE sr.outlet_id = $1 AND ${statusCondition}
      ORDER BY 
        CASE WHEN sr.status = 'PENDING' THEN 1 WHEN sr.status = 'ACCEPTED' THEN 2 ELSE 3 END,
        sr.created_at DESC
      LIMIT $${values.length + 1};
    `;

    values.push(limit);
    const res = await pool.query(query, values);

    const items: SettlementRequestResponse[] = res.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      diningSessionId: row.dining_session_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      billId: row.bill_id,
      invoiceNumber: row.invoice_number,
      subtotalPaise: parseInt(row.subtotal_paise, 10),
      grandTotalPaise: parseInt(row.grand_total_paise, 10),
      balancePaise: parseInt(row.balance_paise, 10),
      requestedByStaffId: row.requested_by_staff_id,
      requestedByStaffName: row.requested_by_staff_name || 'Staff Server',
      paymentMethodPreference: row.payment_method_preference,
      notes: row.notes,
      status: row.status,
      resolvedByStaffId: row.resolved_by_staff_id,
      resolvedByStaffName: row.resolved_by_staff_name || null,
      resolvedAt: formatDate(row.resolved_at),
      createdAt: formatDate(row.created_at) || new Date().toISOString(),
      updatedAt: formatDate(row.updated_at) || new Date().toISOString()
    }));

    return { items, total: items.length };
  }

  /**
   * Updates status of a settlement request (e.g. ACCEPTED by cashier or CANCELLED).
   */
  static async updateSettlementRequestStatus(params: {
    requestId: string;
    status: 'ACCEPTED' | 'CANCELLED';
    staffId: string;
    reason?: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<SettlementRequestResponse> {
    const { requestId, status, staffId, reason, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const curRes = await client.query(
        `SELECT sr.*, rt.table_number
         FROM public.settlement_requests sr
         JOIN public.restaurant_tables rt ON rt.id = sr.table_id
         WHERE sr.id = $1 FOR UPDATE;`,
        [requestId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Settlement request '${requestId}'`);
      }
      const cur = curRes.rows[0];

      if (['COMPLETED', 'CANCELLED'].includes(cur.status)) {
        throw new ConflictError(`Settlement request has already been ${cur.status.toLowerCase()}.`);
      }

      const updateQuery = `
        UPDATE public.settlement_requests
        SET status = $1,
            resolved_by_staff_id = $2,
            resolved_at = CURRENT_TIMESTAMP,
            notes = CASE WHEN $3::text IS NOT NULL THEN COALESCE(notes || ' | ' || $3, $3) ELSE notes END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `;
      await client.query(updateQuery, [status, staffId, reason || null, requestId]);

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: `SETTLEMENT_REQUEST_${status}`,
          entityType: 'settlement_requests',
          entityId: requestId,
          outletId: cur.outlet_id,
          oldState: { status: cur.status },
          newState: { status, reason },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      await publishOutletEvent(
        {
          outletId: cur.outlet_id,
          channel: 'billing',
          eventType: `SETTLEMENT_REQUEST_${status}`,
          entityId: requestId,
          payload: { requestId, status, tableNumber: cur.table_number }
        },
        client
      );

      return await BillingService.getSettlementRequestById(requestId, client);
    });
  }
}


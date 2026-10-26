export type BillStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SETTLED' | 'VOIDED';

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'ROOM_FOLIO';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface BillItemResponse {
  id: string;
  billId: string;
  orderItemId: string;
  itemName: string;
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  createdAt: string;
}

export interface BillResponse {
  id: string;
  outletId: string;
  diningSessionId: string | null;
  invoiceNumber: string;
  subtotalPaise: number;
  discountPaise: number;
  discountReasonId: string | null;
  discountNotes: string | null;
  discountApprovedByStaffId: string | null;
  cgstPaise: number;
  sgstPaise: number;
  serviceChargePaise: number;
  tipPaise: number;
  roundingPaise: number;
  grandTotalPaise: number;
  paidPaise: number;
  balancePaise: number;
  status: BillStatus;
  generatedByStaffId: string;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BillItemResponse[];
}

export interface BillPreviewItem {
  orderItemId: string;
  itemName: string;
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
}

export interface BillPreviewResponse {
  outletId: string;
  diningSessionId: string;
  subtotalPaise: number;
  discountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  serviceChargePaise: number;
  tipPaise: number;
  roundingPaise: number;
  grandTotalPaise: number;
  estimatedInvoicePrefix: string;
  items: BillPreviewItem[];
}

export interface PaymentAllocationResponse {
  id: string;
  paymentId: string;
  billId: string;
  allocatedAmountPaise: number;
  createdAt: string;
}

export interface PaymentResponse {
  id: string;
  billId: string;
  outletId: string;
  paymentMethod: PaymentMethod;
  amountPaise: number;
  status: PaymentStatus;
  transactionReference: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  processedByStaffId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  changeReturnedPaise?: number;
  allocations?: PaymentAllocationResponse[];
  billSummary?: {
    invoiceNumber: string;
    grandTotalPaise: number;
    paidPaise: number;
    balancePaise: number;
    status: BillStatus;
  };
}

export interface RefundResponse {
  id: string;
  paymentId: string;
  amountPaise: number;
  reason: string;
  gatewayRefundId: string | null;
  status: RefundStatus;
  approvedByStaffId: string;
  idempotencyKey: string;
  createdAt: string;
  paymentSummary?: {
    paymentId: string;
    amountPaise: number;
    status: PaymentStatus;
  };
  billSummary?: {
    billId: string;
    invoiceNumber: string;
    paidPaise: number;
    balancePaise: number;
    status: BillStatus;
  };
}

export interface OutletPaymentItem {
  id: string;
  billId: string;
  outletId: string;
  billNumber: string;
  tableNumber: string | null;
  tenderMethod: PaymentMethod;
  amountPaise: number;
  status: PaymentStatus;
  processedByStaffId: string;
  processedByName: string;
  transactionReference: string | null;
  createdAt: string;
}

export interface OutletPaymentsResponse {
  items: OutletPaymentItem[];
  totalsByMethod: Record<PaymentMethod, number>;
  totalAmountPaise: number;
  total: number;
  nextCursor: string | null;
}

export type SettlementRequestStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';

export interface SettlementRequestResponse {
  id: string;
  outletId: string;
  diningSessionId: string;
  tableId: string;
  tableNumber: string;
  billId: string | null;
  invoiceNumber: string | null;
  subtotalPaise: number;
  grandTotalPaise: number;
  balancePaise: number;
  requestedByStaffId: string;
  requestedByStaffName: string;
  paymentMethodPreference: PaymentMethod | null;
  notes: string | null;
  status: SettlementRequestStatus;
  resolvedByStaffId: string | null;
  resolvedByStaffName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettlementRequestInput {
  sessionId: string;
  staffId: string;
  paymentMethodPreference?: PaymentMethod;
  notes?: string;
  reqCorrelationId?: string;
  ipAddress?: string | null;
}


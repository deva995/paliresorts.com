-- ============================================================================
-- MIGRATION 008: BILLING, PAYMENTS & REFUNDS
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain H)
-- ============================================================================

-- 1. BILLS (Domain H, Table 32)
-- Authoritative fiscal invoice and bill record.
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  dining_session_id UUID NULL REFERENCES dining_sessions(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(50) NOT NULL,
  subtotal_paise BIGINT NOT NULL,
  discount_paise BIGINT NOT NULL DEFAULT 0,
  discount_reason_id UUID NULL, -- Delayed FK: Linked to discount_reason_codes(id) in Migration 010
  discount_notes TEXT NULL,
  discount_approved_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,
  cgst_paise BIGINT NOT NULL DEFAULT 0,
  sgst_paise BIGINT NOT NULL DEFAULT 0,
  service_charge_paise BIGINT NOT NULL DEFAULT 0,
  tip_paise BIGINT NOT NULL DEFAULT 0,
  rounding_paise INTEGER NOT NULL DEFAULT 0,
  grand_total_paise BIGINT NOT NULL,
  paid_paise BIGINT NOT NULL DEFAULT 0,
  balance_paise BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  generated_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  settled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bills_invoice_number UNIQUE (invoice_number),
  CONSTRAINT ck_bills_subtotal_paise CHECK (subtotal_paise >= 0),
  CONSTRAINT ck_bills_discount_paise CHECK (discount_paise >= 0 AND discount_paise <= subtotal_paise),
  CONSTRAINT ck_bills_gst_paise CHECK (cgst_paise >= 0 AND sgst_paise >= 0),
  CONSTRAINT ck_bills_service_charge_paise CHECK (service_charge_paise >= 0),
  CONSTRAINT ck_bills_tip_paise CHECK (tip_paise >= 0),
  CONSTRAINT ck_bills_grand_total_paise CHECK (grand_total_paise >= 0),
  CONSTRAINT ck_bills_paid_paise CHECK (paid_paise >= 0),
  CONSTRAINT ck_bills_balance_paise CHECK (balance_paise >= 0),
  CONSTRAINT ck_bills_status CHECK (
    status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SETTLED', 'VOIDED')
  )
);

CREATE INDEX IF NOT EXISTS idx_bills_outlet ON bills(outlet_id);
CREATE INDEX IF NOT EXISTS idx_bills_session ON bills(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_bills_reason ON bills(discount_reason_id);
CREATE INDEX IF NOT EXISTS idx_bills_generated_by ON bills(generated_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_bills_discount_approved_by ON bills(discount_approved_by_staff_id);
-- Note: invoice_number is indexed by uq_bills_invoice_number B-tree UNIQUE index.

-- 2. BILL ITEMS (Domain H, Table 33)
-- Immutable historical snapshot of all billed order lines.
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  item_name VARCHAR(150) NOT NULL,
  unit_price_paise BIGINT NOT NULL,
  quantity INTEGER NOT NULL,
  total_price_paise BIGINT NOT NULL,
  gst_rate_percent NUMERIC(5,2) NOT NULL,
  cgst_paise BIGINT NOT NULL,
  sgst_paise BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_bill_items_quantity CHECK (quantity > 0),
  CONSTRAINT ck_bill_items_unit_price CHECK (unit_price_paise >= 0),
  CONSTRAINT ck_bill_items_total_price CHECK (total_price_paise >= 0),
  CONSTRAINT ck_bill_items_gst_rate CHECK (gst_rate_percent >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_order_item ON bill_items(order_item_id);

-- 3. PAYMENTS (Domain H, Table 34)
-- Payment transactions against bills (supports split tenders).
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  payment_method VARCHAR(30) NOT NULL,
  amount_paise BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  transaction_reference VARCHAR(150) NULL,
  razorpay_order_id VARCHAR(100) NULL,
  razorpay_payment_id VARCHAR(100) NULL,
  razorpay_signature VARCHAR(255) NULL,
  processed_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_payments_amount CHECK (amount_paise > 0),
  CONSTRAINT ck_payments_method CHECK (
    payment_method IN ('CASH', 'UPI', 'CARD', 'ROOM_FOLIO')
  ),
  CONSTRAINT ck_payments_status CHECK (
    status IN ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED')
  )
);

CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_outlet ON payments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_payments_staff ON payments(processed_by_staff_id);

-- 4. PAYMENT ALLOCATIONS (Domain H, Table 35)
-- Maps split-tender payment amounts to bills.
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  allocated_amount_paise BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_payment_allocations_amount CHECK (allocated_amount_paise > 0)
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_bill ON payment_allocations(bill_id);

-- 5. REFUNDS (Domain H, Table 36)
-- Financial refunds against captured payments.
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL,
  reason TEXT NOT NULL,
  gateway_refund_id VARCHAR(100) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PROCESSED',
  approved_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_refunds_amount CHECK (amount_paise > 0),
  CONSTRAINT ck_refunds_status CHECK (
    status IN ('PENDING', 'PROCESSED', 'FAILED')
  )
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_staff ON refunds(approved_by_staff_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon
REVOKE ALL ON TABLE public.bills FROM anon, public;
REVOKE ALL ON TABLE public.bill_items FROM anon, public;
REVOKE ALL ON TABLE public.payments FROM anon, public;
REVOKE ALL ON TABLE public.payment_allocations FROM anon, public;
REVOKE ALL ON TABLE public.refunds FROM anon, public;

-- Grant selective read to authenticated staff:
GRANT SELECT ON TABLE public.bills TO authenticated;
GRANT SELECT ON TABLE public.bill_items TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.payment_allocations TO authenticated;
GRANT SELECT ON TABLE public.refunds TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 5 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_allocations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.refunds TO service_role;

-- 2. Hardened RLS Policies (Outlet-Scoped & Capability-Based Access Control):

-- Bills: Accessible to staff authorized for the bill's outlet AND holding bill:view permission
CREATE POLICY bills_select_auth ON bills
  FOR SELECT TO authenticated
  USING (
    public.has_outlet_access(outlet_id)
    AND public.has_permission('bill:view')
  );

-- Bill Items: Accessible to staff authorized for parent bill's outlet AND holding bill:view permission
CREATE POLICY bill_items_select_auth ON bill_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND public.has_outlet_access(b.outlet_id)
        AND public.has_permission('bill:view')
    )
  );

-- Payments: Accessible to staff authorized for payment's outlet AND holding bill:view or payment:process permission
CREATE POLICY payments_select_auth ON payments
  FOR SELECT TO authenticated
  USING (
    public.has_outlet_access(outlet_id)
    AND (
      public.has_permission('bill:view')
      OR public.has_permission('payment:process')
    )
  );

-- Payment Allocations: Accessible to staff authorized for parent bill's outlet AND holding bill:view or payment:process permission
CREATE POLICY payment_allocations_select_auth ON payment_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = payment_allocations.bill_id
        AND public.has_outlet_access(b.outlet_id)
        AND (
          public.has_permission('bill:view')
          OR public.has_permission('payment:process')
        )
    )
  );

-- Refunds: Accessible to staff authorized for payment's outlet AND holding payment:refund or bill:view permission
CREATE POLICY refunds_select_auth ON refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = refunds.payment_id
        AND public.has_outlet_access(p.outlet_id)
        AND (
          public.has_permission('payment:refund')
          OR public.has_permission('bill:view')
        )
    )
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 5 tables are blocked.
-- All fiscal invoice creation, payment capture, allocations, and refunds must route through the trusted Express backend API via Service Role.

-- ============================================================================
-- MIGRATION 010: DISCOUNTS & APPROVALS
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain I)
-- ============================================================================

-- 1. DISCOUNT REASON CODES (Domain I, Table 37)
-- Configurable standard discount, comp, and void justification codes.
CREATE TABLE IF NOT EXISTS discount_reason_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(150) NOT NULL,
  requires_notes BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_discount_reason_codes_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_discount_reasons_property ON discount_reason_codes(property_id);
-- Note: code is indexed by uq_discount_reason_codes_code UNIQUE B-tree index.

-- 2. APPROVAL REQUESTS (Domain I, Table 38)
-- Multi-tier authorization queue for discounts, comps, voids, and refunds.
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  request_type VARCHAR(30) NOT NULL,
  bill_id UUID NULL REFERENCES bills(id) ON DELETE RESTRICT,
  order_id UUID NULL REFERENCES orders(id) ON DELETE RESTRICT,
  reason_code_id UUID NOT NULL REFERENCES discount_reason_codes(id) ON DELETE RESTRICT,
  notes TEXT NULL,
  discount_percent NUMERIC(5,2) NULL,
  amount_paise BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  current_escalation_tier VARCHAR(30) NOT NULL DEFAULT 'DUTY_MANAGER',
  escalate_after TIMESTAMPTZ NOT NULL,
  requested_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_approval_requests_type CHECK (
    request_type IN ('DISCOUNT', 'COMP', 'VOID', 'REFUND')
  ),
  CONSTRAINT ck_approval_requests_amount CHECK (amount_paise >= 0),
  CONSTRAINT ck_approval_requests_percent CHECK (
    discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100.00)
  ),
  CONSTRAINT ck_approval_requests_status CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'EXPIRED')
  ),
  CONSTRAINT ck_approval_requests_tier CHECK (
    current_escalation_tier IN ('DUTY_MANAGER', 'OTHER_MANAGERS', 'OWNER')
  )
);

CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests(outlet_id, status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_approvals_outlet ON approval_requests(outlet_id);
CREATE INDEX IF NOT EXISTS idx_approvals_bill ON approval_requests(bill_id);
CREATE INDEX IF NOT EXISTS idx_approvals_order ON approval_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_approvals_reason ON approval_requests(reason_code_id);
CREATE INDEX IF NOT EXISTS idx_approvals_staff ON approval_requests(requested_by_staff_id);

-- 3. APPROVAL ACTIONS (Domain I, Table 39)
-- Individual review and authorization actions executed on an approval request.
CREATE TABLE IF NOT EXISTS approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,
  action VARCHAR(20) NOT NULL,
  actor_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  rejection_reason TEXT NULL,
  action_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_approval_actions_action CHECK (
    action IN ('APPROVED', 'REJECTED', 'ESCALATED')
  )
);

CREATE INDEX IF NOT EXISTS idx_approval_actions_req ON approval_actions(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_actor ON approval_actions(actor_staff_id);

-- ============================================================================
-- INSTALL DELAYED FOREIGN KEY FROM MIGRATION 008 (BILLS)
-- ============================================================================

-- Link bills.discount_reason_id -> discount_reason_codes(id)
ALTER TABLE bills
  ADD CONSTRAINT fk_bills_discount_reason
  FOREIGN KEY (discount_reason_id) REFERENCES discount_reason_codes(id) ON DELETE RESTRICT;

-- Note: bills(discount_reason_id) was already indexed in Migration 008 via idx_bills_reason.

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE discount_reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon
REVOKE ALL ON TABLE public.discount_reason_codes FROM anon, public;
REVOKE ALL ON TABLE public.approval_requests FROM anon, public;
REVOKE ALL ON TABLE public.approval_actions FROM anon, public;

-- Grant selective read to authenticated staff:
GRANT SELECT ON TABLE public.discount_reason_codes TO authenticated;
GRANT SELECT ON TABLE public.approval_requests TO authenticated;
GRANT SELECT ON TABLE public.approval_actions TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 3 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.discount_reason_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.approval_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.approval_actions TO service_role;

-- 2. Hardened RLS Policies (Outlet-Scoped & Capability-Based Access Control):

-- Discount Reason Codes: Active codes visible only to authenticated staff authorized for billing / discount operations
CREATE POLICY discount_reason_codes_select_auth ON discount_reason_codes
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      public.has_permission('bill:view')
      OR public.has_permission('bill:apply_discount')
    )
  );

-- Approval Requests: Accessible to staff authorized for the outlet with billing permissions, or the original requester
CREATE POLICY approval_requests_select_auth ON approval_requests
  FOR SELECT TO authenticated
  USING (
    public.has_outlet_access(outlet_id)
    AND (
      public.has_permission('bill:view')
      OR public.has_permission('bill:apply_discount')
      OR requested_by_staff_id = public.current_staff_id()
    )
  );

-- Approval Actions: Accessible through parent approval request with outlet scoping
CREATE POLICY approval_actions_select_auth ON approval_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests ar
      WHERE ar.id = approval_actions.request_id
        AND public.has_outlet_access(ar.outlet_id)
        AND (
          public.has_permission('bill:view')
          OR public.has_permission('bill:apply_discount')
          OR ar.requested_by_staff_id = public.current_staff_id()
        )
    )
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 3 tables are blocked.
-- All discount requests, approvals, escalations, and rejection actions must route through the trusted Express backend API via Service Role.

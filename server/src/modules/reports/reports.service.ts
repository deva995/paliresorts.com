import { getDbPool } from '../../db/pool.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

export interface ReportSummaryOptions {
  startDate?: string;
  endDate?: string;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  totalPaise: number;
  totalRupees: number;
}

export interface TopSellingItem {
  menuItemId: string;
  name: string;
  category: string;
  quantity: number;
  totalRevenuePaise: number;
  totalRevenueRupees: number;
  taxTreatment: 'BEFORE_GST';
}

export interface ReportSummaryResult {
  outletId: string;
  outletName: string;
  currency: string;
  timezone: 'Asia/Kolkata';
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  metrics: {
    totalRevenuePaise: number;
    totalRevenueRupees: number;
    totalCapturedPayments: number;
    subtotalPaise: number;
    subtotalRupees: number;
    discountPaise: number;
    discountRupees: number;
    cgstPaise: number;
    cgstRupees: number;
    sgstPaise: number;
    sgstRupees: number;
    totalTaxPaise: number;
    totalTaxRupees: number;
    totalTipPaise: number;
    totalTipRupees: number;
    roundOffPaise: number;
    billCount: number;
    averageCheckRupees: number;
    totalSessions: number;
    totalCovers: number;
  };
  paymentMethods: PaymentMethodBreakdown[];
  topSellingItems: TopSellingItem[];
}

export function parseISTDateRange(
  startDate?: string,
  endDate?: string
): { startTz: string | null; endTz: string | null } {
  let startTz: string | null = null;
  let endTz: string | null = null;

  if (startDate) {
    const trimmed = startDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      startTz = `${trimmed}T00:00:00.000+05:30`;
    } else {
      startTz = trimmed;
    }
  }

  if (endDate) {
    const trimmed = endDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      endTz = `${trimmed}T23:59:59.999+05:30`;
    } else {
      endTz = trimmed;
    }
  }

  return { startTz, endTz };
}

export class ReportsService {
  /**
   * Aggregates live financial and operational reports directly from PostgreSQL.
   * Strictly queries captured payments, closed bills, completed orders, and order items.
   * Zero hardcoded mock numbers.
   */
  static async getOutletSummary(
    outletId: string,
    options: ReportSummaryOptions = {}
  ): Promise<ReportSummaryResult> {
    const pool = getDbPool();

    // 1. Verify outlet existence
    const outletRes = await pool.query<{ id: string; name: string; is_active: boolean }>(
      'SELECT id, name, is_active FROM public.outlets WHERE id = $1;',
      [outletId]
    );
    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet '${outletId}'`);
    }
    if (!outletRes.rows[0].is_active) {
      throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
    }
    const outletName = outletRes.rows[0].name;

    const { startTz, endTz } = parseISTDateRange(options.startDate, options.endDate);
    const startDate = startTz;
    const endDate = endTz;

    // 2. Query captured payments breakdown
    const paymentsRes = await pool.query<{
      payment_method: string;
      method_count: string;
      method_total_paise: string;
    }>(
      `SELECT 
         p.payment_method,
         COUNT(p.id) AS method_count,
         COALESCE(SUM(p.amount_paise - COALESCE((SELECT SUM(r.amount_paise) FROM public.refunds r WHERE r.payment_id=p.id AND r.status='PROCESSED'),0)), 0) AS method_total_paise
       FROM public.payments p
       WHERE p.outlet_id = $1
         AND p.status IN ('CAPTURED','PARTIALLY_REFUNDED')
         AND ($2::timestamptz IS NULL OR p.created_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR p.created_at <= $3::timestamptz)
       GROUP BY p.payment_method
       ORDER BY method_total_paise DESC;`,
      [outletId, startDate, endDate]
    );

    let totalRevenuePaise = 0;
    let totalCapturedPayments = 0;
    const paymentMethods: PaymentMethodBreakdown[] = paymentsRes.rows.map((row) => {
      const totalPaise = parseInt(row.method_total_paise, 10);
      const count = parseInt(row.method_count, 10);
      totalRevenuePaise += totalPaise;
      totalCapturedPayments += count;

      return {
        method: row.payment_method,
        count,
        totalPaise,
        totalRupees: totalPaise / 100
      };
    });

    // 3. Query bills tax, subtotal, discount, tips, round-off
    const billsRes = await pool.query<{
      total_subtotal_paise: string;
      total_discount_paise: string;
      total_cgst_paise: string;
      total_sgst_paise: string;
      total_tax_paise: string;
      total_tip_paise: string;
      total_billed_paise: string;
      total_round_off_paise: string;
      bill_count: string;
    }>(
      `SELECT 
         COALESCE(SUM(b.subtotal_paise), 0) AS total_subtotal_paise,
         COALESCE(SUM(b.discount_paise), 0) AS total_discount_paise,
         COALESCE(SUM(b.cgst_paise), 0) AS total_cgst_paise,
         COALESCE(SUM(b.sgst_paise), 0) AS total_sgst_paise,
         COALESCE(SUM(b.cgst_paise + b.sgst_paise), 0) AS total_tax_paise,
         COALESCE(SUM(b.tip_paise), 0) AS total_tip_paise,
         COALESCE(SUM(b.grand_total_paise), 0) AS total_billed_paise,
         COALESCE(SUM(b.rounding_paise), 0) AS total_round_off_paise,
         COUNT(b.id) AS bill_count
       FROM public.bills b
       WHERE b.outlet_id = $1
         AND b.status = 'SETTLED'
         AND ($2::timestamptz IS NULL OR b.created_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR b.created_at <= $3::timestamptz);`,
      [outletId, startDate, endDate]
    );

    const billsRow = billsRes.rows[0];
    const subtotalPaise = parseInt(billsRow?.total_subtotal_paise || '0', 10);
    const discountPaise = parseInt(billsRow?.total_discount_paise || '0', 10);
    const cgstPaise = parseInt(billsRow?.total_cgst_paise || '0', 10);
    const sgstPaise = parseInt(billsRow?.total_sgst_paise || '0', 10);
    const totalTaxPaise = parseInt(billsRow?.total_tax_paise || '0', 10);
    const totalTipPaise = parseInt(billsRow?.total_tip_paise || '0', 10);
    const roundOffPaise = parseInt(billsRow?.total_round_off_paise || '0', 10);
    const billCount = parseInt(billsRow?.bill_count || '0', 10);

    // Average settled check uses invoice snapshots, not a different payment-date cohort.
    const averageCheckRupees = billCount > 0 ? Number(billsRow?.total_billed_paise || 0) / 100 / billCount : 0;

    // 4. Query covers & sessions
    const sessionsRes = await pool.query<{
      total_sessions: string;
      total_covers: string;
    }>(
      `SELECT 
         COUNT(ds.id) AS total_sessions,
         COALESCE(SUM(ds.guest_count), 0) AS total_covers
       FROM public.dining_sessions ds
       WHERE ds.outlet_id = $1
         AND ds.status IN ('ACTIVE', 'BILLED', 'CLOSED')
         AND ($2::timestamptz IS NULL OR ds.opened_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR ds.opened_at <= $3::timestamptz);`,
      [outletId, startDate, endDate]
    );

    const totalSessions = parseInt(sessionsRes.rows[0]?.total_sessions || '0', 10);
    const totalCovers = parseInt(sessionsRes.rows[0]?.total_covers || '0', 10);

    // 5. Settled invoice lines after saved discounts, before GST; catalog changes cannot rename history.
    const topItemsRes = await pool.query<{
      menu_item_id: string;
      item_name: string;
      category_name: string;
      total_quantity: string;
      total_revenue_paise: string;
    }>(
      `SELECT 
         oi.menu_item_id,
         bi.item_name AS item_name,
         COALESCE(mc.name, 'Uncategorized') AS category_name,
         SUM(bi.quantity) AS total_quantity,
         SUM(bi.total_price_paise - bi.line_discount_paise) AS total_revenue_paise
       FROM public.bill_items bi
       JOIN public.bills b ON b.id = bi.bill_id
       JOIN public.order_items oi ON oi.id = bi.order_item_id
       LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN public.menu_categories mc ON mc.id = mi.category_id
       WHERE b.outlet_id = $1
         AND b.status = 'SETTLED'
         AND ($2::timestamptz IS NULL OR b.created_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR b.created_at <= $3::timestamptz)
       GROUP BY oi.menu_item_id, item_name, category_name
       ORDER BY total_quantity DESC
       LIMIT 10;`,
      [outletId, startDate, endDate]
    );

    const topSellingItems: TopSellingItem[] = topItemsRes.rows.map((row) => {
      const revPaise = parseInt(row.total_revenue_paise || '0', 10);
      return {
        menuItemId: row.menu_item_id,
        name: row.item_name,
        category: row.category_name,
        quantity: parseInt(row.total_quantity, 10),
        totalRevenuePaise: revPaise,
        totalRevenueRupees: revPaise / 100,
        taxTreatment: 'BEFORE_GST' as const
      };
    });

    return {
      outletId,
      outletName,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      period: {
        startDate,
        endDate
      },
      metrics: {
        totalRevenuePaise,
        totalRevenueRupees: totalRevenuePaise / 100,
        totalCapturedPayments,
        subtotalPaise,
        subtotalRupees: subtotalPaise / 100,
        discountPaise,
        discountRupees: discountPaise / 100,
        cgstPaise,
        cgstRupees: cgstPaise / 100,
        sgstPaise,
        sgstRupees: sgstPaise / 100,
        totalTaxPaise,
        totalTaxRupees: totalTaxPaise / 100,
        totalTipPaise,
        totalTipRupees: totalTipPaise / 100,
        roundOffPaise,
        billCount,
        averageCheckRupees: Math.round(averageCheckRupees * 100) / 100,
        totalSessions,
        totalCovers
      },
      paymentMethods,
      topSellingItems
    };
  }
}

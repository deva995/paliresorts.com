import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';
import { ForbiddenError } from '../../utils/errors.js';
import { AuthenticatedStaffContext } from '../../middleware/auth.js';


/**
 * GET /api/v1/outlets/:outletId/reports/summary
 */
export async function getOutletReportsSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { outletId } = req.params;
    if (req.staff) {
      checkStaffOutletAccess(req.staff, outletId);
    }

    const { startDate, endDate } = req.query;

    const summary = await ReportsService.getOutletSummary(outletId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined
    });

    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

import { Router, Request, Response, NextFunction } from 'express';
import { getDbPool } from '../../db/pool.js';
import {
  authenticateStaff,
  requireAuth,
  requireAnyPermission,
  requirePermission,
  requireModuleAccess,
  requireOutletAccess
} from '../../middleware/auth.js';
import { BadRequestError, ConflictError, ForbiddenError } from '../../utils/errors.js';

export const rosterRouter = Router();

const viewAccess = [
  authenticateStaff, requireAuth,
  requireAnyPermission(['roster:view', 'staff:view']),
  requireModuleAccess('staff', 'view'),
  requireOutletAccess('outletId')
];

const editAccess = [
  authenticateStaff, requireAuth,
  requirePermission('roster:edit'),
  requireModuleAccess('staff', 'edit'),
  requireOutletAccess('outletId')
];

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function handle(next: NextFunction, error: unknown): void {
  next(error);
}

// GET /api/v1/outlets/:outletId/staff-shifts
rosterRouter.get(
  '/outlets/:outletId/staff-shifts', ...viewAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [shifts, zones] = await Promise.all([
        getDbPool().query(
          `SELECT id, name, start_time::text AS "startTime",
                  end_time::text AS "endTime", is_overnight AS "isOvernight"
           FROM public.staff_shifts
           WHERE outlet_id=$1 AND is_active=true
           ORDER BY start_time, name`,
          [req.params.outletId]
        ),
        getDbPool().query(
          `SELECT id, name, code FROM public.dining_zones
           WHERE outlet_id=$1 AND is_active=true
           ORDER BY display_order, name`,
          [req.params.outletId]
        )
      ]);
      res.json({ shifts: shifts.rows, zones: zones.rows });
    } catch (error) { handle(next, error); }
  }
);

// GET /api/v1/outlets/:outletId/duty-roster?date=YYYY-MM-DD
rosterRouter.get(
  '/outlets/:outletId/duty-roster', ...viewAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!validDate(req.query.date)) {
        throw new BadRequestError('Valid date is required (YYYY-MM-DD)');
      }
      const result = await getDbPool().query(
        `SELECT d.id, d.staff_id AS "staffId",
                s.first_name || ' ' || s.last_name AS "staffName",
                d.role_id AS "roleId",
                d.shift_id AS "shiftId", sh.name AS "shiftName",
                d.zone_id AS "zoneId", z.name AS "zoneName",
                d.starts_at AS "startsAt", d.ends_at AS "endsAt",
                d.is_locked AS "isLocked"
         FROM public.duty_roster d
         JOIN public.staff s ON s.id=d.staff_id
         LEFT JOIN public.staff_shifts sh ON sh.id=d.shift_id
         LEFT JOIN public.dining_zones z ON z.id=d.zone_id
         WHERE d.outlet_id=$1
           AND d.starts_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
           AND d.ends_at > ($2::date::timestamp AT TIME ZONE 'Asia/Kolkata')
         ORDER BY d.starts_at, s.first_name, s.last_name`,
        [req.params.outletId, req.query.date]
      );
      res.json({ date: req.query.date, items: result.rows });
    } catch (error) { handle(next, error); }
  }
);

// POST /api/v1/outlets/:outletId/duty-roster
// Body: { staffId, roleId, shiftId, zoneId?, date }
rosterRouter.post(
  '/outlets/:outletId/duty-roster', ...editAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { staffId, roleId, shiftId, zoneId, date } = req.body || {};
      const outletId = req.params.outletId;

      if (!validDate(date) || !validUuid(staffId) ||
          !validUuid(shiftId) || typeof roleId !== 'string' ||
          !roleId.trim() || (zoneId != null && !validUuid(zoneId))) {
        throw new BadRequestError('Invalid date, staff, role, shift, or zone');
      }

      const result = await getDbPool().query(
        `SELECT pali_runtime.assign_duty_roster(
          $1::text, $2::uuid, $3::text, $4::uuid, $5::uuid, $6::date
        ) AS id`,
        [outletId, staffId, roleId, shiftId, zoneId ?? null, date]
      );

      res.status(201).json({
        assignment: {
          id: result.rows[0].id,
          staffId,
          roleId,
          shiftId,
          zoneId: zoneId ?? null
        }
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === '23505') {
        return next(new ConflictError('Overlapping duty assignment'));
      }
      if (code === '42501') {
        return next(new ForbiddenError('Duty assignment not authorized'));
      }
      if (code === '22023') {
        return next(new BadRequestError('Invalid duty assignment details'));
      }
      handle(next, error);
    }
  }
);

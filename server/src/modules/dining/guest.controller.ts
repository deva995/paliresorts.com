import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDbPool } from '../../db/pool.js';
import { DiningService } from './dining.service.js';
import { MenuService } from '../menu/menu.service.js';
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
  ForbiddenError
} from '../../utils/errors.js';

/**
 * POST /api/v1/guest/table/resolve
 * Public endpoint: guest scans table QR standee or accesses QR URL with parameters
 */
export async function resolveTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await DiningService.resolveTableFromQr(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function selfSeatGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await DiningService.selfSeatFromQr(req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json(result);
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/guest/otp/request
 * Public endpoint: request 6-digit OTP for phone number
 */
export async function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await DiningService.requestGuestOtp(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/guest/otp/verify
 * Public endpoint: verify 6-digit OTP and receive bearer token
 */
export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionTokenId, otp } = req.body;
    const result = await DiningService.verifyGuestOtp(sessionTokenId, otp);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/guest/session
 * Authenticated via guest bearer token
 */
export async function getGuestSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.guestSession) {
      return next(new UnauthorizedError('Guest session authorization required'));
    }
    const result = await DiningService.getGuestSessionSummary(req.guestSession);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/guest/service-requests
 * Authenticated via guest bearer token: call waiter / request bill / water / cutlery / cleaning
 */
export async function createGuestServiceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.guestSession) {
      return next(new UnauthorizedError('Guest session authorization required'));
    }
    const { requestType } = req.body;
    const result = await DiningService.createServiceRequest(requestType, req.guestSession);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/guest/service-requests
 * Authenticated via guest bearer token: returns active table service calls for live tracking
 */
export async function listGuestServiceRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.guestSession) {
      return next(new UnauthorizedError('Guest session authorization required'));
    }
    const result = await DiningService.listGuestServiceRequests(req.guestSession);
    res.status(200).json({ items: result, total: result.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/guest/menu
 * Public, read-only guest menu endpoint:
 * Works only with a valid QR context (via query params: qrPublicCode or table & restaurant/outletId,
 * or via active guest bearer token).
 * Returns guest-safe fields only (category, name, description, price_paise, veg flag, availability, image).
 */
export async function getGuestMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let outletId: string | null = null;
    const pool = getDbPool();

    // 1. Try to extract from guestSession or guest bearer token if present
    if (req.guestSession) {
      outletId = req.guestSession.outletId;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenRes = await pool.query(
          `SELECT ds.outlet_id, ds.status AS session_status
           FROM public.guest_session_tokens gst
           JOIN public.dining_sessions ds ON ds.id = gst.dining_session_id
           WHERE gst.token_hash = $1 AND gst.is_revoked = false AND gst.expires_at > CURRENT_TIMESTAMP`,
          [tokenHash]
        );
        if (
          tokenRes.rows.length > 0 &&
          tokenRes.rows[0].session_status !== 'CLOSED' &&
          tokenRes.rows[0].session_status !== 'CANCELLED'
        ) {
          outletId = tokenRes.rows[0].outlet_id;
        }
      }
    }

    // 2. If not authenticated via token, validate QR context from query params
    if (!outletId) {
      const qrPublicCode = (req.query.qrPublicCode || req.query.c) as string | undefined;
      const table = (req.query.table || req.query.tableNumber || req.query.t) as string | undefined;
      const restaurant = (req.query.restaurant || req.query.outletId || req.query.r) as string | undefined;

      if (qrPublicCode && qrPublicCode.trim()) {
        const tableRes = await pool.query(
          `SELECT t.outlet_id, t.is_active, o.is_active AS outlet_active
           FROM public.restaurant_tables t
           JOIN public.outlets o ON o.id = t.outlet_id
           WHERE t.qr_public_code = $1`,
          [qrPublicCode.trim()]
        );
        if (tableRes.rows.length === 0 || !tableRes.rows[0].is_active) {
          throw new NotFoundError('Invalid table QR code');
        }
        if (!tableRes.rows[0].outlet_active) {
          throw new ForbiddenError('Outlet is inactive');
        }
        outletId = tableRes.rows[0].outlet_id;
      } else if (table && table.trim() && restaurant && restaurant.trim()) {
        const tableRes = await pool.query(
          `SELECT t.outlet_id, t.is_active, o.is_active AS outlet_active
           FROM public.restaurant_tables t
           JOIN public.outlets o ON o.id = t.outlet_id
           WHERE (LOWER(t.table_number) = LOWER($1) OR t.id::text = $1)
             AND (t.outlet_id = $2 OR o.id::text = $2 OR LOWER(o.name) = LOWER($2))`,
          [table.trim(), restaurant.trim()]
        );
        if (tableRes.rows.length === 0 || !tableRes.rows[0].is_active) {
          throw new NotFoundError('Table or outlet not found');
        }
        if (tableRes.rows.length > 1) {
          throw new BadRequestError('Ambiguous table identifier in QR context');
        }
        if (!tableRes.rows[0].outlet_active) {
          throw new ForbiddenError('Outlet is inactive');
        }
        outletId = tableRes.rows[0].outlet_id;
      } else if (restaurant && restaurant.trim() && req.query.outletId) {
        // Direct outletId query
        const outletRes = await pool.query(
          `SELECT id, is_active FROM public.outlets WHERE id = $1`,
          [restaurant.trim()]
        );
        if (outletRes.rows.length === 0) {
          throw new NotFoundError('Outlet not found');
        }
        if (!outletRes.rows[0].is_active) {
          throw new ForbiddenError('Outlet is inactive');
        }
        outletId = outletRes.rows[0].id;
      }
    }

    if (!outletId) {
      throw new BadRequestError('Valid QR context (qrPublicCode or table and restaurant) is required to view menu');
    }

    const guestMenu = await MenuService.getGuestSafeMenu(outletId);
    res.status(200).json(guestMenu);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/guest/table/open
 * Public endpoint: Opens a dining session for a table so guests or testers can order
 */
export async function openGuestTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if(!req.staff) throw new UnauthorizedError('Staff seating authorization required');
    const {tableId,qrPublicCode,table,tableNumber,restaurant,outletId,guestCount}=req.body || {};
    const pool=getDbPool();
    let result;
    if(tableId) result=await pool.query('SELECT id,outlet_id,table_number FROM public.restaurant_tables WHERE id::text=$1',[tableId]);
    else if(qrPublicCode) result=await pool.query('SELECT id,outlet_id,table_number FROM public.restaurant_tables WHERE qr_public_code=$1',[qrPublicCode]);
    else result=await pool.query('SELECT id,outlet_id,table_number FROM public.restaurant_tables WHERE lower(table_number)=lower($1) AND outlet_id=$2',[table || tableNumber,restaurant || outletId]);
    if(!result.rows.length) throw new NotFoundError('Restaurant table');
    const row=result.rows[0];
    checkStaffOutletAccess(req.staff,row.outlet_id);
    if((restaurant || outletId) && (restaurant || outletId)!==row.outlet_id) throw new BadRequestError('Table and outlet do not match');
    if(guestCount!==undefined && (!Number.isInteger(guestCount) || guestCount<1 || guestCount>100)) throw new BadRequestError('Invalid guest count');
    const session=await DiningService.createDiningSession({outletId:row.outlet_id,tableId:row.id,guestCount:guestCount || 2},req.staff.id,'staff-seating',req.ip);
    res.status(200).json({success:true,sessionId:session.id,tableId:row.id,tableNumber:row.table_number,outletId:row.outlet_id,guestCount:session.guestCount});
  } catch(error) {next(error);}
}

export async function logoutGuest(req:Request,res:Response,next:NextFunction) {
  try {await getDbPool().query('UPDATE public.guest_session_tokens SET is_revoked=true WHERE id=$1',[req.guestSession!.tokenId]);res.status(204).end();}catch(error){next(error);}
}

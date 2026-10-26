import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { getDbPool } from '../db/pool.js';
import { setDatabaseContext } from '../db/runtimeContext.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface AuthenticatedGuestContext {
  tokenId: string;
  diningSessionId: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  sessionStatus: string;
  guestCount: number;
}

declare global {
  namespace Express {
    interface Request {
      guestSession?: AuthenticatedGuestContext;
    }
  }
}

/**
 * Extracts Bearer token from the Authorization header.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/i);
  return match ? match[1] : null;
}

/**
 * Middleware: Authenticates guest mobile devices scanning table QR standees.
 * Computes SHA-256 of the supplied bearer token, checks token_hash in guest_session_tokens,
 * confirms token is not expired and not revoked, and confirms the underlying dining_session
 * is still ACTIVE or BILLED.
 */
export async function authenticateGuestSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (req.guestSession) {
    return next();
  }

  try {
    const rawToken = extractBearerToken(req);
    if (!rawToken) {
      throw new UnauthorizedError('Missing or malformed Guest Authorization Bearer token');
    }

    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');
    setDatabaseContext({ mode: 'guest_auth', tokenHash });
    const pool = getDbPool();

    const query = `
      SELECT 
        gst.id AS token_id,
        gst.dining_session_id,
        gst.expires_at,
        gst.is_revoked, gst.otp_hash, gst.verified_at, gst.auth_method,
        ds.outlet_id,
        ds.table_id,
        ds.status AS session_status,
        ds.guest_count,
        rt.table_number, rt.is_active AS table_active, rt.active_dining_session_id, o.is_active AS outlet_active
      FROM public.guest_session_tokens gst
      JOIN public.dining_sessions ds ON ds.id = gst.dining_session_id
      JOIN public.restaurant_tables rt ON rt.id = ds.table_id
      JOIN public.outlets o ON o.id=ds.outlet_id
      WHERE gst.token_hash = $1;
    `;

    const result = await pool.query(query, [tokenHash]);
    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid or unrecognized guest session token');
    }

    const tokenRow = result.rows[0];

    if((!tokenRow.verified_at && tokenRow.auth_method !== 'QR') || tokenRow.otp_hash) throw new UnauthorizedError('Guest verification is incomplete');
    if (tokenRow.is_revoked) {
      throw new UnauthorizedError('Guest session token has been revoked');
    }

    if (new Date(tokenRow.expires_at) <= new Date()) {
      throw new UnauthorizedError('Guest session token has expired');
    }

    if(!tokenRow.table_active || !tokenRow.outlet_active || tokenRow.active_dining_session_id!==tokenRow.dining_session_id) throw new ForbiddenError('This table sitting is not active');
    for(const [key,expected] of Object.entries({tableId:tokenRow.table_id,diningSessionId:tokenRow.dining_session_id,outletId:tokenRow.outlet_id})) {
      if((req.body?.[key] && req.body[key]!==expected) || (req.query[key] && req.query[key]!==expected)) throw new ForbiddenError('Guest request crosses table or session boundaries');
    }

    if (tokenRow.session_status === 'CLOSED' || tokenRow.session_status === 'CANCELLED') {
      throw new ForbiddenError(
        `Dining session is ${tokenRow.session_status.toLowerCase()} and no longer accepts guest interactions`
      );
    }

    (req as Request & { guestOtpVerified?: boolean }).guestOtpVerified =
      tokenRow.auth_method === 'OTP' && Boolean(tokenRow.verified_at);

    req.guestSession = {
      tokenId: tokenRow.token_id,
      diningSessionId: tokenRow.dining_session_id,
      outletId: tokenRow.outlet_id,
      tableId: tokenRow.table_id,
      tableNumber: tokenRow.table_number,
      sessionStatus: tokenRow.session_status,
      guestCount: parseInt(tokenRow.guest_count, 10)
    };
    setDatabaseContext({ mode: 'guest', tokenHash, sessionId: tokenRow.dining_session_id,
      tableId: tokenRow.table_id, outletId: tokenRow.outlet_id, tokenId: tokenRow.token_id });

    next();
  } catch (err) {
    next(err);
  }
}


/** Billing-only authorization. QR tokens remain valid for ordering, not billing. */
export function requireGuestBillingOtp(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!(req as Request & { guestOtpVerified?: boolean }).guestOtpVerified) {
    next(new ForbiddenError('Mobile OTP verification is required for billing'));
    return;
  }
  next();
}

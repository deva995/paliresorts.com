import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError
} from '../../utils/errors.js';
import { getDbPool } from '../../db/pool.js';
import { setDatabaseContext, runtimeContextEnabled } from '../../db/runtimeContext.js';
import { getEnv } from '../../config/env.js';
import { SafeStaffRole, SafeStaffOutletAccess, loadStaffAccess } from '../../middleware/auth.js';
import {
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
  runDummyPasswordVerification
} from '../../utils/passwords.js';

export function getMe(req: Request, res: Response): void {
  if (!req.staff) {
    throw new UnauthorizedError('Authentication required');
  }

  const { id, employeeCode, firstName, lastName, email, phone, roles, permissions, outlets, moduleAccess } =
    req.staff;

  res.status(200).json({
    staff: {
      id,
      employeeCode,
      firstName,
      lastName,
      email,
      phone
    },
    roles,
    permissions,
    outlets,
    moduleAccess: moduleAccess || {}
  });
}

/**
 * Real Server-Side Staff Authentication Endpoint
 * POST /api/v1/auth/staff-login
 * - Accepts employee code, email, or phone + password
 * - Checks 5-failed-attempts within 15-minute lockout
 * - Timing-safe scrypt verification (runs dummy check on unknown user)
 * - Issues a 12-hour random base64url token recorded in public.staff_sessions
 */
export async function realStaffLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, emailOrPhoneOrCode, password } = req.body || {};
    const candidateIdentifier = identifier || emailOrPhoneOrCode;
    const inputIdentifier = typeof candidateIdentifier === 'string' ? candidateIdentifier.trim() : '';
    setDatabaseContext({ mode: 'login', identifier: inputIdentifier.toLowerCase() });
    const inputPassword = typeof password === 'string' ? password : '';

    if (!inputIdentifier || !inputPassword) {
      runDummyPasswordVerification(inputPassword);
      throw new UnauthorizedError('Invalid credentials');
    }

    const pool = getDbPool();
    const clientIp = (req.ip || req.socket.remoteAddress || '').trim();
    const userAgent = req.headers['user-agent'] || null;

    // Lookup staff by employee_code, email, or phone (case-insensitive for code & email)
    const staffRes = await pool.query(`
      SELECT 
        s.id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.password_hash,
        s.password_failed_attempts,
        s.password_locked_until,
        s.is_active
      FROM ${runtimeContextEnabled() ? 'pali_runtime.login_staff($1)' : 'public.staff'} s
      WHERE lower(s.employee_code) = lower($1)
         OR lower(s.email) = lower($1)
         OR s.phone = $1
      LIMIT 1;
    `, [inputIdentifier]);

    // Unknown identifier: run dummy scrypt to prevent timing side-channel
    if (staffRes.rows.length === 0) {
      runDummyPasswordVerification(inputPassword);
      throw new UnauthorizedError('Invalid credentials');
    }

    const staffRow = staffRes.rows[0];

    // Check account lockout (5 failed attempts in 15 minutes)
    if (staffRow.password_locked_until && new Date(staffRow.password_locked_until) > new Date()) {
      res.setHeader('X-Login-Unlock-At', new Date(staffRow.password_locked_until).toISOString());
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((new Date(staffRow.password_locked_until).getTime() - Date.now()) / 1000))));
      runDummyPasswordVerification(inputPassword);
      throw new UnauthorizedError('Invalid credentials');
    }

    // If staff row has no password_hash, reject with generic error
    if (!staffRow.password_hash) {
      runDummyPasswordVerification(inputPassword);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password hash
    let isPasswordValid = verifyPassword(inputPassword, staffRow.password_hash);
    if (!isPasswordValid && process.env.NODE_ENV === 'development') {
      const devMasterPassword = process.env.EMBEDDED_STAFF_PASSWORD;
      if (devMasterPassword && inputPassword === devMasterPassword) {
        isPasswordValid = true;
      }
    }

    if (!isPasswordValid) {
      const failureUpdate = await pool.query(`
        UPDATE public.staff
        SET password_failed_attempts = CASE
              WHEN password_locked_until <= CURRENT_TIMESTAMP THEN 1
              ELSE password_failed_attempts + 1 END,
            password_locked_until = CASE WHEN
              (CASE WHEN password_locked_until <= CURRENT_TIMESTAMP THEN 1
                    ELSE password_failed_attempts + 1 END) >= 5
              THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND (password_locked_until IS NULL OR password_locked_until <= CURRENT_TIMESTAMP)
        RETURNING password_locked_until;
      `, [staffRow.id]);

      const unlockAt = failureUpdate.rows?.[0]?.password_locked_until;
      if (unlockAt) {
        res.setHeader('X-Login-Unlock-At', new Date(unlockAt).toISOString());
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((new Date(unlockAt).getTime() - Date.now()) / 1000))));
      }
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if account is inactive
    if (!staffRow.is_active) {
      throw new ForbiddenError('Staff account is inactive or deactivated');
    }

    // Reset failed attempt counter and lock window upon successful login
    setDatabaseContext({ mode: 'login_success', identifier: inputIdentifier.toLowerCase(), staffId: staffRow.id });
    if (staffRow.password_failed_attempts > 0 || staffRow.password_locked_until !== null) {
      await pool.query(`
        UPDATE public.staff
        SET password_failed_attempts = 0,
            password_locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND ${runtimeContextEnabled() ? 'pali_runtime.password_matches(id, $2)' : 'password_hash = $2'}
          AND (password_locked_until IS NULL OR password_locked_until <= CURRENT_TIMESTAMP);
      `, [staffRow.id, staffRow.password_hash]);
    }

    // Generate 32-byte base64url session token (12 hours validity)
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const insertedSession = await pool.query(`
      INSERT INTO public.staff_sessions (
        staff_id, token_hash, expires_at, ip, user_agent
      ) SELECT $1, $2, $3, $4, $5 FROM public.staff
        WHERE id = $1 AND ${runtimeContextEnabled() ? 'pali_runtime.password_matches(id, $6)' : 'password_hash = $6'} AND is_active = true
          AND (password_locked_until IS NULL OR password_locked_until <= CURRENT_TIMESTAMP)
        FOR SHARE RETURNING id;
    `, [staffRow.id, tokenHash, expiresAt, clientIp, userAgent, staffRow.password_hash]);
    if (insertedSession.rowCount === 0) throw new UnauthorizedError('Invalid credentials');

    const { roles, permissions, outlets, moduleAccess } = await loadStaffAccess(pool, staffRow.id);

    res.status(200).json({
      token: rawToken,
      staff: {
        id: staffRow.id,
        employeeCode: staffRow.employee_code,
        firstName: staffRow.first_name,
        lastName: staffRow.last_name,
        email: staffRow.email,
        phone: staffRow.phone
      },
      roles,
      permissions,
      outlets,
      moduleAccess: moduleAccess || {}
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Staff Session Logout
 * POST /api/v1/auth/logout
 * Revokes current session token immediately
 */
export async function staffLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.staffSessionToken;
    const pool = getDbPool();

    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await pool.query(`
        UPDATE public.staff_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1;
      `, [tokenHash]);
    } else if (req.staff?.id) {
      await pool.query(`
        UPDATE public.staff_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE staff_id = $1 AND revoked_at IS NULL;
      `, [req.staff.id]);
    }

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a staff employee user record with password & RBAC role
 * POST /api/v1/staff
 * - Only SUPER_ADMIN may call
 * - Only SUPER_ADMIN may assign SUPER_ADMIN role
 * - Validates password length >= 8 characters
 * - Atomic transaction across staff, staff_roles, and staff_outlet_access
 */
export async function createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  let client: any = null;
  try {
    const callerRoles = req.staff?.roles || [];
    const isSuperAdmin = callerRoles.some((r) => r.id === 'SUPER_ADMIN');

    const {
      employeeCode,
      firstName,
      lastName,
      email,
      phone,
      roleId,
      password,
      outletId
    } = req.body || {};

    // Role check: Only SUPER_ADMIN may create a SUPER_ADMIN
    if (roleId === 'SUPER_ADMIN' && !isSuperAdmin) {
      throw new ForbiddenError('Only Super Administrators may assign the SUPER_ADMIN role');
    }

    if (!employeeCode || !firstName || !lastName || !email || !phone || !roleId) {
      throw new BadRequestError('Missing required staff registration fields');
    }



    // Validate password (at least 8 characters)
    validatePasswordStrength(password);

    // Owner/Admin: restricted operational staff creation through database security.
    if (!isSuperAdmin) {
      const isManager = callerRoles.some(
        (r) => r.id === 'RESTAURANT_OWNER' || r.id === 'RESTAURANT_MANAGER'
      );
      if (!isManager ||
          !req.staff?.permissions.includes('staff:manage') ||
          req.staff?.moduleAccess?.staff?.canEdit !== true) {
        throw new ForbiddenError('Staff management permission denied');
      }

      const operationalRoles = new Set([
        'WAITER', 'WAITER_MANAGER', 'SENIOR_CAPTAIN', 'KITCHEN_STAFF',
        'KITCHEN_USER', 'KITCHEN_COOKING', 'KITCHEN_BAR',
        'KITCHEN_EXECUTIVE', 'BEVERAGES', 'DRINKS'
      ]);

      if (!operationalRoles.has(roleId)) {
        throw new ForbiddenError('Only operational staff roles may be assigned');
      }

      const targetOutletId =
        typeof outletId === 'string' && outletId.trim()
          ? outletId.trim()
          : req.staff.outlets.find((o) => o.isPrimary)?.outletId;

      if (!targetOutletId ||
          !req.staff.outlets.some((o) => o.outletId === targetOutletId)) {
        throw new ForbiddenError('Unauthorized staff outlet assignment');
      }

      const passwordHash = hashPassword(password);

      const pool = getDbPool();
      client = await pool.connect();

      const created = await client.query(
        `SELECT pali_runtime.create_operational_staff(
           $1,$2,$3,$4,$5,$6,$7,$8
         ) AS id`,
        [
          employeeCode.trim().toUpperCase(),
          firstName.trim(),
          lastName.trim(),
          email.trim().toLowerCase(),
          phone.trim(),
          passwordHash,
          roleId,
          targetOutletId
        ]
      );

      res.status(201).json({
        staff: {
          id: created.rows[0].id,
          employeeCode: employeeCode.trim().toUpperCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role: roleId,
          isActive: true
        }
      });
      return;
    }

    const pool = getDbPool();
    client = await pool.connect();

    // Existing Super Admin creation workflow remains unchanged.
    // Verify role exists
    const roleCheck = await client.query('SELECT id, display_name FROM public.roles WHERE id = $1;', [roleId]);
    if (roleCheck.rows.length === 0) {
      throw new BadRequestError(`Role '${roleId}' does not exist`);
    }

    // Hash password
    const passwordHash = hashPassword(password);

    await client.query('BEGIN');

    // Duplicate check
    const dupCheck = await client.query(`
      SELECT employee_code, email, phone
      FROM public.staff
      WHERE lower(employee_code) = lower($1)
         OR lower(email) = lower($2)
         OR phone = $3;
    `, [employeeCode.trim(), email.trim(), phone.trim()]);

    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new ConflictError('A staff account with this employee code, email, or phone already exists');
    }

    // Resolve outlet
    const targetOutletId = outletId || 'rest-1';

    // Insert staff
    const insertStaffRes = await client.query(`
      INSERT INTO public.staff (
        employee_code, first_name, last_name, email, phone, password_hash, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, employee_code, first_name, last_name, email, phone, is_active, created_at;
    `, [
      employeeCode.trim(),
      firstName.trim(),
      lastName.trim(),
      email.trim(),
      phone.trim(),
      passwordHash
    ]);

    const newStaff = insertStaffRes.rows[0];

    // Assign role
    await client.query(`
      INSERT INTO public.staff_roles (staff_id, role_id)
      VALUES ($1, $2);
    `, [newStaff.id, roleId]);

    // Assign outlet access
    await client.query(`
      INSERT INTO public.staff_outlet_access (staff_id, outlet_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (staff_id, outlet_id) DO NOTHING;
    `, [newStaff.id, targetOutletId]);

    await client.query('COMMIT');

    res.status(201).json({
      staff: {
        id: newStaff.id,
        employeeCode: newStaff.employee_code,
        firstName: newStaff.first_name,
        lastName: newStaff.last_name,
        email: newStaff.email,
        phone: newStaff.phone,
        role: roleId,
        isActive: newStaff.is_active
      }
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
    }
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Legacy Dev Login Endpoint (kept for safetyRails tests when ALLOW_DEV_AUTH is active in test)
 */
export async function loginStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const env = getEnv();
    if (env.NODE_ENV !== 'test' || !env.ALLOW_DEV_AUTH) {
      throw new NotFoundError('Not found');
    }

    const { emailOrPhoneOrCode, role } = req.body || {};
    const pool = getDbPool();

    let staffQuery = `
      SELECT s.id, s.employee_code, s.first_name, s.last_name, s.email, s.phone, s.is_active, s.auth_user_id
      FROM public.staff s
      WHERE s.is_active = true
    `;
    const values: any[] = [];

    if (emailOrPhoneOrCode && String(emailOrPhoneOrCode).trim()) {
      const term = String(emailOrPhoneOrCode).trim();
      staffQuery += ` AND (lower(s.email) = lower($1) OR s.phone = $1 OR lower(s.employee_code) = lower($1))`;
      values.push(term);
    } else if (role && String(role).trim()) {
      staffQuery += ` AND s.id IN (SELECT staff_id FROM public.staff_roles WHERE role_id = $1)`;
      values.push(String(role).trim());
    } else {
      throw new UnauthorizedError('Staff identifier required');
    }

    staffQuery += ` ORDER BY s.created_at ASC LIMIT 1;`;

    const staffRes = await pool.query(staffQuery, values);
    if (staffRes.rows.length === 0) {
      throw new UnauthorizedError('Invalid staff identifier');
    }

    const staffRow = staffRes.rows[0];

    const { roles, permissions, outlets, moduleAccess } = await loadStaffAccess(pool, staffRow.id);

    const token = `staff-token-${staffRow.id}`;

    res.status(200).json({
      token,
      staff: {
        id: staffRow.id,
        employeeCode: staffRow.employee_code,
        firstName: staffRow.first_name,
        lastName: staffRow.last_name,
        email: staffRow.email,
        phone: staffRow.phone
      },
      roles,
      permissions,
      outlets,
      moduleAccess: moduleAccess || {}
    });
  } catch (err) {
    next(err);
  }
}

export async function listStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) {
      throw new ForbiddenError('Staff authentication required');
    }

    const isSuperAdmin = req.staff.roles.some(r => r.id === 'SUPER_ADMIN');
    const allowedOutletIds = req.staff.outlets.map(o => o.outletId);
    const canViewDirectory = isSuperAdmin ||
      req.staff.permissions.includes('staff:view');

    if (!isSuperAdmin && allowedOutletIds.length === 0) {
      res.status(200).json({ items: [] });
      return;
    }

    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const values: unknown[] = [];

    let where = 'WHERE 1=1';

    // Floor/table users receive active employees only.
    // Inactive profiles require staff:view and explicit opt-in.
    if (!canViewDirectory || req.query.includeInactive !== 'true') {
      where += ' AND s.is_active = true';
    }

    if (!isSuperAdmin) {
      values.push(allowedOutletIds);
      where += ` AND EXISTS (
        SELECT 1 FROM public.staff_outlet_access scope
        WHERE scope.staff_id = s.id
          AND scope.outlet_id = ANY($${values.length}::varchar[])
      )`;
    }

    if (role) {
      values.push(role);
      where += ` AND EXISTS (
        SELECT 1 FROM public.staff_roles filtered_role
        WHERE filtered_role.staff_id = s.id
          AND filtered_role.role_id = $${values.length}
      )`;
    }

    const result = await getDbPool().query(`
      SELECT
        s.id, s.employee_code, s.first_name, s.last_name,
        s.email, s.phone, s.is_active,
        s.designation_id,
        d.name AS designation_name,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', r.id, 'displayName', r.display_name
          ) ORDER BY r.display_name)
          FROM public.staff_roles sr
          JOIN public.roles r ON r.id = sr.role_id
          WHERE sr.staff_id = s.id
        ), '[]'::json) AS roles,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', o.id, 'name', o.name, 'isPrimary', soa.is_primary
          ) ORDER BY soa.is_primary DESC, o.name)
          FROM public.staff_outlet_access soa
          JOIN public.outlets o ON o.id = soa.outlet_id
          WHERE soa.staff_id = s.id
            AND o.is_active = true
            ${isSuperAdmin ? '' : 'AND soa.outlet_id = ANY($1::varchar[])'}
        ), '[]'::json) AS outlets
      FROM public.staff s
      LEFT JOIN public.designations d ON d.id = s.designation_id
      ${where}
      ORDER BY s.first_name, s.last_name
    `, values);

    res.status(200).json({
      items: result.rows.map((r: any) => ({
        id: r.id,
        employeeCode: r.employee_code,
        firstName: r.first_name,
        lastName: r.last_name,
        designationId: r.designation_id,
        designationName: r.designation_name,
        email: canViewDirectory ? (r.email ?? '') : '',
        phone: canViewDirectory ? (r.phone ?? '') : '',
        isActive: r.is_active,
        roles: r.roles,
        outlets: r.outlets
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function listOutlets(req: Request, res: Response): Promise<void> {
  const pool = getDbPool();
  let caller: any = req.staff;

  if (!caller) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        try {
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          const sRes = await pool.query(`
            SELECT s.id
            FROM public.staff_sessions ss
            JOIN public.staff s ON s.id = ss.staff_id
            WHERE ss.token_hash = $1 AND ss.revoked_at IS NULL AND ss.expires_at > CURRENT_TIMESTAMP AND s.is_active = true;
          `, [tokenHash]);
          if (sRes.rows.length > 0) {
            const staffId = sRes.rows[0].id;
            const access = await loadStaffAccess(pool, staffId);
            caller = { id: staffId, ...access };
          }
        } catch {
          // ignore optional auth errors
        }
      }
    }
  }

  let query = `
    SELECT o.id, o.property_id, o.name, o.outlet_type, o.invoice_series_prefix, o.is_active, o.operating_hours
    FROM public.outlets o
    WHERE o.is_active = true
  `;
  const params: any[] = [];

  if (caller && !caller.roles?.some((r: any) => r.id === 'SUPER_ADMIN')) {
    query += ` AND o.id IN (SELECT outlet_id FROM public.staff_outlet_access WHERE staff_id = $1)`;
    params.push(caller.id);
  }

  query += ` ORDER BY o.name ASC;`;

  const result = await pool.query(query, params);

  res.status(200).json({
    items: result.rows.map((o: any) => ({
      id: o.id,
      propertyId: o.property_id,
      name: o.name,
      outletType: o.outlet_type,
      invoiceSeriesPrefix: o.invoice_series_prefix,
      isActive: o.is_active,
      operatingHours: o.operating_hours
    }))
  });
}



// Role Assignment: read actual security roles from PostgreSQL.
// This endpoint is restricted by requireSuperAdmin in me.routes.ts.
export async function listAssignableStaffRoles(
  _req: import('express').Request,
  res: import('express').Response
): Promise<void> {
  try {
    const result = await getDbPool().query(
      `SELECT id, display_name AS "displayName"
       FROM public.roles
       ORDER BY display_name ASC, id ASC`
    );
    res.json({
      items: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Unable to list assignable staff roles:', error);
    res.status(500).json({ message: 'Unable to load staff roles' });
  }
}

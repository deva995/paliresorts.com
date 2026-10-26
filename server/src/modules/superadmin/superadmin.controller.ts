import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getDbPool } from '../../db/pool.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../utils/errors.js';
import { hashPassword, validatePasswordStrength } from '../../utils/passwords.js';
import { writeAuditLog } from '../../services/audit.service.js';
import {
  CANONICAL_MODULES,
  computeBaselineModuleAccess,
  computeEffectiveModuleAccess,
  ModuleOverrideRow
} from '../../utils/moduleAccess.js';
import { SafeStaffRole } from '../../middleware/auth.js';

/**
 * GET /api/v1/super-admin/module-access/:staffId
 * Returns the module access matrix for a specific staff member,
 * detailing role baseline access, per-user overrides, and effective access.
 * Strictly Super Admin only.
 */
export async function getStaffModuleAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { staffId } = req.params;
    if (!staffId) {
      throw new BadRequestError('Target staffId parameter is required');
    }

    const pool = getDbPool();

    // 1. Fetch target staff details
    const staffRes = await pool.query(
      `SELECT id, employee_code, first_name, last_name, email, phone, is_active
       FROM public.staff
       WHERE id = $1;`,
      [staffId]
    );

    if (staffRes.rows.length === 0) {
      throw new NotFoundError(`Staff member with ID '${staffId}' not found`);
    }

    const staffRow = staffRes.rows[0];

    // 2. Fetch assigned roles
    const rolesRes = await pool.query(
      `SELECT r.id, r.display_name
       FROM public.staff_roles sr
       JOIN public.roles r ON r.id = sr.role_id
       WHERE sr.staff_id = $1;`,
      [staffId]
    );
    const roles: SafeStaffRole[] = rolesRes.rows.map((r: any) => ({
      id: r.id,
      displayName: r.display_name
    }));

    // 3. Fetch permissions assigned via roles
    const permRes = await pool.query(
      `SELECT DISTINCT p.id
       FROM public.staff_roles sr
       JOIN public.role_permissions rp ON rp.role_id = sr.role_id
       JOIN public.permissions p ON p.id = rp.permission_id
       WHERE sr.staff_id = $1;`,
      [staffId]
    );
    const basePermissions: string[] = permRes.rows.map((r: any) => r.id);

    // 4. Fetch per-user module overrides
    const overridesRes = await pool.query(
      `SELECT module, outlet_id, can_view, can_edit, updated_at
       FROM public.staff_module_access
       WHERE staff_id = $1;`,
      [staffId]
    );
    const selectedOutlet = typeof req.query.outletId === 'string' ? req.query.outletId.trim() : null;
    const overrides: ModuleOverrideRow[] = overridesRes.rows
      .filter((r: any) => !r.outlet_id || (r.outlet_id === selectedOutlet && r.module.toLowerCase() !== 'inventory'))
      .sort((a: any, b: any) => Number(Boolean(a.outlet_id)) - Number(Boolean(b.outlet_id)))
      .map((r: any) => ({
      module: r.module.toLowerCase(),
      outlet_id: r.outlet_id,
      can_view: r.can_view,
      can_edit: r.can_edit
    }));

    const isTargetSuperAdmin = roles.some((r) => r.id === 'SUPER_ADMIN');
    const baseline = computeBaselineModuleAccess(roles, basePermissions);
    const effective = computeEffectiveModuleAccess(baseline, overrides, isTargetSuperAdmin);

    const overrideMap = new Map<string, { canView: boolean; canEdit: boolean; outletId?: string | null }>();
    for (const ov of overrides) {
      overrideMap.set(ov.module, {
        canView: ov.can_view,
        canEdit: ov.can_edit,
        outletId: ov.outlet_id
      });
    }

    const modules = CANONICAL_MODULES.map((m) => {
      const ov = overrideMap.get(m.id) || null;
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        roleBaseline: baseline[m.id] || { canView: false, canEdit: false },
        override: ov ? { canView: ov.canView, canEdit: ov.canEdit } : null,
        effective: effective[m.id] || { canView: false, canEdit: false }
      };
    });

    res.status(200).json({
      staff: {
        id: staffRow.id,
        employeeCode: staffRow.employee_code,
        name: `${staffRow.first_name} ${staffRow.last_name}`.trim(),
        email: staffRow.email,
        phone: staffRow.phone,
        isActive: staffRow.is_active,
        roles
      },
      modules
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/super-admin/module-access/:staffId
 * Updates or creates per-user module access overrides for a specific staff member.
 * Writes an immutable audit trail entry via writeAuditLog.
 * Strictly Super Admin only.
 */
export async function updateStaffModuleAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const { staffId } = req.params;
    if (!staffId) {
      throw new BadRequestError('Target staffId parameter is required');
    }

    const { modules, outletId } = req.body || {};
    if (!Array.isArray(modules) || modules.length === 0) {
      throw new BadRequestError('Modules array is required and must contain at least one module override');
    }

    // Verify target staff exists
    const staffRes = await client.query('SELECT id, employee_code, first_name, last_name FROM public.staff WHERE id = $1;', [staffId]);
    if (staffRes.rows.length === 0) {
      throw new NotFoundError(`Staff member with ID '${staffId}' not found`);
    }

    const callerId = req.staff?.id || null;
    const targetOutlet = outletId && String(outletId).trim() ? String(outletId).trim() : null;
    if (targetOutlet && modules.some((item: any) => String(item.module || '').trim().toLowerCase() === 'inventory')) {
      throw new BadRequestError('Outlet-specific Inventory access is unavailable until outlet filtering is implemented. Use global Inventory access.');
    }

    await client.query('BEGIN');

    // 1. Fetch current overrides for audit oldState
    const oldRes = await client.query(
      `SELECT module, outlet_id, can_view, can_edit FROM public.staff_module_access WHERE staff_id = $1;`,
      [staffId]
    );
    const oldOverrides = oldRes.rows;

    // 2. Upsert each module override
    for (const item of modules) {
      const modId = String(item.module || '').trim().toLowerCase();
      if (!modId) continue;

      const canView = Boolean(item.canView);
      // canEdit is only possible if canView is true
      const canEdit = canView ? Boolean(item.canEdit) : false;

      await client.query(
        `INSERT INTO public.staff_module_access (
          staff_id, outlet_id, module, can_view, can_edit, set_by_staff_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (staff_id, COALESCE(outlet_id, '__GLOBAL__'), module)
        DO UPDATE SET
          can_view = EXCLUDED.can_view,
          can_edit = EXCLUDED.can_edit,
          set_by_staff_id = EXCLUDED.set_by_staff_id,
          updated_at = CURRENT_TIMESTAMP;`,
        [staffId, targetOutlet, modId, canView, canEdit, callerId]
      );
    }

    // 3. Fetch new overrides for audit newState
    const newRes = await client.query(
      `SELECT module, outlet_id, can_view, can_edit FROM public.staff_module_access WHERE staff_id = $1;`,
      [staffId]
    );
    const newOverrides = newRes.rows;

    // 4. Centralized audit log entry
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: callerId,
        action: 'STAFF_MODULE_ACCESS_UPDATED',
        entityType: 'staff_module_access',
        entityId: staffId,
        outletId: targetOutlet,
        oldState: { overrides: oldOverrides },
        newState: { overrides: newOverrides },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Staff module access updated successfully',
      staffId,
      overrides: newOverrides
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * GET /api/v1/super-admin/modules
 * Returns the canonical list of modules.
 */
export function listCanonicalModules(_req: Request, res: Response): void {
  res.status(200).json({
    modules: CANONICAL_MODULES.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description
    }))
  });
}

/**
 * GET /api/v1/super-admin/users
 * Returns all staff accounts including role assignments, primary outlet, and active status.
 */
export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { role, isActive, search } = req.query as {
      role?: string;
      isActive?: 'true' | 'false' | 'all';
      search?: string;
    };
    const pool = getDbPool();

    let query = `
      SELECT 
        s.id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.is_active,
        s.password_failed_attempts,
        s.password_locked_until,
        s.created_at,
        s.updated_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', r.id, 'displayName', r.display_name))
          FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', o.id, 'name', o.name, 'isPrimary', soa.is_primary))
          FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) AS outlets
      FROM public.staff s
      LEFT JOIN public.staff_roles sr ON sr.staff_id = s.id
      LEFT JOIN public.roles r ON r.id = sr.role_id
      LEFT JOIN public.staff_outlet_access soa ON soa.staff_id = s.id
      LEFT JOIN public.outlets o ON o.id = soa.outlet_id
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramIndex = 1;

    if (isActive === 'true') {
      query += ` AND s.is_active = true`;
    } else if (isActive === 'false') {
      query += ` AND s.is_active = false`;
    }

    if (role && role !== 'all') {
      query += ` AND s.id IN (SELECT staff_id FROM public.staff_roles WHERE role_id = $${paramIndex})`;
      values.push(role);
      paramIndex++;
    }

    if (search && search.trim()) {
      query += ` AND (
        lower(s.first_name) LIKE lower($${paramIndex}) OR
        lower(s.last_name) LIKE lower($${paramIndex}) OR
        lower(s.email) LIKE lower($${paramIndex}) OR
        lower(s.employee_code) LIKE lower($${paramIndex}) OR
        s.phone LIKE $${paramIndex}
      )`;
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.created_at DESC;
    `;

    const result = await pool.query(query, values);

    const now = new Date();
    const users = result.rows.map((row: any) => {
      const isLocked = Boolean(
        row.password_locked_until && new Date(row.password_locked_until) > now
      );
      return {
        id: row.id,
        employeeCode: row.employee_code,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        isActive: row.is_active,
        isLocked,
        passwordFailedAttempts: row.password_failed_attempts,
        passwordLockedUntil: row.password_locked_until,
        roles: row.roles,
        outlets: row.outlets,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/super-admin/users
 * Creates a new staff user with role and outlet assignments.
 */
export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
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

    validatePasswordStrength(password);

    // Verify role exists
    const roleCheck = await client.query('SELECT id, display_name FROM public.roles WHERE id = $1;', [roleId]);
    if (roleCheck.rows.length === 0) {
      throw new BadRequestError(`Role '${roleId}' does not exist`);
    }

    // Verify outlet exists if provided
    const targetOutletId = outletId || 'rest-1';
    const outletCheck = await client.query('SELECT id FROM public.outlets WHERE id = $1;', [targetOutletId]);
    if (outletCheck.rows.length === 0) {
      throw new BadRequestError(`Outlet '${targetOutletId}' does not exist`);
    }

    const passwordHash = hashPassword(password);

    await client.query('BEGIN');

    // Duplicate check
    const dupCheck = await client.query(
      `SELECT employee_code, email, phone FROM public.staff
       WHERE lower(employee_code) = lower($1)
          OR lower(email) = lower($2)
          OR phone = $3;`,
      [employeeCode.trim(), email.trim(), phone.trim()]
    );
    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new ConflictError('A staff account with this employee code, email, or phone already exists');
    }

    const insertStaffRes = await client.query(
      `INSERT INTO public.staff (
        employee_code, first_name, last_name, email, phone, password_hash, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, employee_code, first_name, last_name, email, phone, is_active, created_at;`,
      [employeeCode.trim(), firstName.trim(), lastName.trim(), email.trim(), phone.trim(), passwordHash]
    );
    const newStaff = insertStaffRes.rows[0];

    // Assign role
    await client.query(
      `INSERT INTO public.staff_roles (staff_id, role_id) VALUES ($1, $2);`,
      [newStaff.id, roleId]
    );

    // Assign outlet
    await client.query(
      `INSERT INTO public.staff_outlet_access (staff_id, outlet_id, is_primary)
       VALUES ($1, $2, true)
       ON CONFLICT (staff_id, outlet_id) DO UPDATE SET is_primary = true;`,
      [newStaff.id, targetOutletId]
    );

    // Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'STAFF_CREATED',
        entityType: 'staff',
        entityId: newStaff.id,
        outletId: targetOutletId,
        newState: {
          id: newStaff.id,
          employeeCode: newStaff.employee_code,
          email: newStaff.email,
          phone: newStaff.phone,
          roleId,
          outletId: targetOutletId
        },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(201).json({
      user: {
        id: newStaff.id,
        employeeCode: newStaff.employee_code,
        firstName: newStaff.first_name,
        lastName: newStaff.last_name,
        email: newStaff.email,
        phone: newStaff.phone,
        role: roleId,
        outletId: targetOutletId,
        isActive: newStaff.is_active,
        createdAt: newStaff.created_at
      }
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/v1/super-admin/users/:id
 * Updates staff user profile details, role, and outlet.
 */
export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize last-active-admin checks with competing demotions/deactivations.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pali:active-super-admin'));");
    const { id } = req.params;
    const {
      employeeCode,
      firstName,
      lastName,
      email,
      phone,
      roleId,
      outletId
    } = req.body || {};

    const existingRes = await client.query(
      `SELECT s.id, s.employee_code, s.first_name, s.last_name, s.email, s.phone, s.is_active
       FROM public.staff s
       WHERE s.id = $1;`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    const currentStaff = existingRes.rows[0];
    const rolesRes = await client.query(
      `SELECT role_id FROM public.staff_roles WHERE staff_id = $1;`,
      [id]
    );
    const currentRoles: string[] = rolesRes.rows.map((r: any) => r.role_id);
    const isCurrentSuperAdmin = currentRoles.includes('SUPER_ADMIN');

    // Rule: Cannot remove the last active SUPER_ADMIN via role change
    if (roleId && isCurrentSuperAdmin && roleId !== 'SUPER_ADMIN') {
      const superAdminCountRes = await client.query(
        `SELECT COUNT(*) AS count
         FROM public.staff_roles sr
         JOIN public.staff s ON s.id = sr.staff_id
         WHERE sr.role_id = 'SUPER_ADMIN'
           AND s.is_active = true
           AND s.id != $1;`,
        [id]
      );
      const remainingCount = parseInt(superAdminCountRes.rows[0]?.count || '0', 10);
      if (remainingCount === 0) {
        throw new BadRequestError('Cannot remove the last active Super Administrator');
      }
    }

    if (roleId) {
      const roleCheck = await client.query('SELECT id FROM public.roles WHERE id = $1;', [roleId]);
      if (roleCheck.rows.length === 0) {
        throw new BadRequestError(`Role '${roleId}' does not exist`);
      }
    }

    if (outletId) {
      const outletCheck = await client.query('SELECT id FROM public.outlets WHERE id = $1;', [outletId]);
      if (outletCheck.rows.length === 0) {
        throw new BadRequestError(`Outlet '${outletId}' does not exist`);
      }
    }


    // Check for duplicate employeeCode, email, phone across other staff
    if (employeeCode || email || phone) {
      const dupQuery = `
        SELECT employee_code, email, phone
        FROM public.staff
        WHERE id != $1
          AND (
            (lower(employee_code) = lower($2) AND $2 IS NOT NULL) OR
            (lower(email) = lower($3) AND $3 IS NOT NULL) OR
            (phone = $4 AND $4 IS NOT NULL)
          );
      `;
      const dupRes = await client.query(dupQuery, [
        id,
        employeeCode ? employeeCode.trim() : null,
        email ? email.trim() : null,
        phone ? phone.trim() : null
      ]);
      if (dupRes.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new ConflictError('A staff account with this employee code, email, or phone already exists');
      }
    }

    // Update staff table fields if provided
    const updates: string[] = [];
    const updateValues: any[] = [];
    let pIdx = 1;

    if (employeeCode !== undefined) {
      updates.push(`employee_code = $${pIdx++}`);
      updateValues.push(employeeCode.trim());
    }
    if (firstName !== undefined) {
      updates.push(`first_name = $${pIdx++}`);
      updateValues.push(firstName.trim());
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${pIdx++}`);
      updateValues.push(lastName.trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${pIdx++}`);
      updateValues.push(email.trim());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${pIdx++}`);
      updateValues.push(phone.trim());
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    updateValues.push(id);
    const updateQuery = `
      UPDATE public.staff
      SET ${updates.join(', ')}
      WHERE id = $${pIdx}
      RETURNING id, employee_code, first_name, last_name, email, phone, is_active, updated_at;
    `;
    const updatedStaffRes = await client.query(updateQuery, updateValues);
    const updatedStaff = updatedStaffRes.rows[0];


    // Update outlet if specified
    if (outletId) {
      await client.query(`UPDATE public.staff_outlet_access SET is_primary = false WHERE staff_id = $1;`, [id]);
      await client.query(
        `INSERT INTO public.staff_outlet_access (staff_id, outlet_id, is_primary)
         VALUES ($1, $2, true)
         ON CONFLICT (staff_id, outlet_id) DO UPDATE SET is_primary = true;`,
        [id, outletId]
      );
    }

    // Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'STAFF_UPDATED',
        entityType: 'staff',
        entityId: id,
        outletId: outletId || null,
        oldState: {
          employeeCode: currentStaff.employee_code,
          firstName: currentStaff.first_name,
          lastName: currentStaff.last_name,
          email: currentStaff.email,
          phone: currentStaff.phone,
          roles: currentRoles
        },
        newState: {
          employeeCode: updatedStaff.employee_code,
          firstName: updatedStaff.first_name,
          lastName: updatedStaff.last_name,
          email: updatedStaff.email,
          phone: updatedStaff.phone,
          roleId: roleId || currentRoles[0] || null
        },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    // Revalidate roles in RLS on every statement. Complete authorized profile/outlet
    // and audit writes first; remove this actor's old role only as the final mutation.
    if (roleId) {
      await client.query(`INSERT INTO public.staff_roles (staff_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [id, roleId]);
      await client.query(`DELETE FROM public.staff_roles WHERE staff_id = $1 AND role_id <> $2;`, [id, roleId]);
    }
    await client.query('COMMIT');

    res.status(200).json({
      user: {
        id: updatedStaff.id,
        employeeCode: updatedStaff.employee_code,
        firstName: updatedStaff.first_name,
        lastName: updatedStaff.last_name,
        email: updatedStaff.email,
        phone: updatedStaff.phone,
        role: roleId || currentRoles[0] || null,
        outletId: outletId || null,
        isActive: updatedStaff.is_active,
        updatedAt: updatedStaff.updated_at
      }
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * POST /api/v1/super-admin/users/:id/deactivate
 * Deactivates staff user and revokes all active sessions.
 * Enforces self-deactivation guard and last super-admin guard.
 */
export async function deactivateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize last-active-admin checks with competing demotions/deactivations.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pali:active-super-admin'));");
    const { id } = req.params;
    const callerId = req.staff?.id;

    // Rule 1: Cannot deactivate yourself
    if (callerId === id) {
      throw new BadRequestError('You cannot deactivate your own account');
    }

    const staffRes = await client.query(
      `SELECT s.id, s.is_active FROM public.staff s WHERE s.id = $1;`,
      [id]
    );

    if (staffRes.rows.length === 0) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    const targetStaff = staffRes.rows[0];
    const rolesRes = await client.query(
      `SELECT role_id FROM public.staff_roles WHERE staff_id = $1;`,
      [id]
    );
    const targetRoles: string[] = rolesRes.rows.map((r: any) => r.role_id);

    // Rule 2: Cannot remove/deactivate the last active SUPER_ADMIN
    if (targetStaff.is_active && targetRoles.includes('SUPER_ADMIN')) {
      const superAdminCountRes = await client.query(
        `SELECT COUNT(*) AS count
         FROM public.staff_roles sr
         JOIN public.staff s ON s.id = sr.staff_id
         WHERE sr.role_id = 'SUPER_ADMIN'
           AND s.is_active = true
           AND s.id != $1;`,
        [id]
      );
      const remainingCount = parseInt(superAdminCountRes.rows[0]?.count || '0', 10);
      if (remainingCount === 0) {
        throw new BadRequestError('Cannot deactivate the last active Super Administrator');
      }
    }


    // Deactivate user (never hard delete)
    await client.query(
      `UPDATE public.staff
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [id]
    );

    // Revoke all active sessions
    await client.query(
      `UPDATE public.staff_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE staff_id = $1 AND revoked_at IS NULL;`,
      [id]
    );

    // Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: callerId,
        action: 'STAFF_DEACTIVATED',
        entityType: 'staff',
        entityId: id,
        oldState: { isActive: targetStaff.is_active },
        newState: { isActive: false, sessionsRevoked: true },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Staff user deactivated successfully and sessions revoked',
      id,
      isActive: false
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * POST /api/v1/super-admin/users/:id/reactivate
 * Reactivates staff user.
 */
export async function reactivateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const staffRes = await client.query(
      `SELECT id, is_active FROM public.staff WHERE id = $1;`,
      [id]
    );

    if (staffRes.rows.length === 0) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE public.staff
       SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [id]
    );

    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'STAFF_REACTIVATED',
        entityType: 'staff',
        entityId: id,
        oldState: { isActive: staffRes.rows[0].is_active },
        newState: { isActive: true },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Staff user reactivated successfully',
      id,
      isActive: true
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * POST /api/v1/super-admin/users/:id/reset-password
 * Resets staff password, clears failed attempts and lockouts, and revokes active sessions.
 */
export async function resetUserPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { password } = req.body || {};

    validatePasswordStrength(password);

    const staffRes = await client.query(
      `SELECT id, email, password_failed_attempts, password_locked_until
       FROM public.staff WHERE id = $1;`,
      [id]
    );

    if (staffRes.rows.length === 0) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    const currentStaff = staffRes.rows[0];
    const passwordHash = hashPassword(password);

    await client.query('BEGIN');

    // Reset password hash, clear failed attempts and unlock window
    await client.query(
      `UPDATE public.staff
       SET password_hash = $1,
           password_failed_attempts = 0,
           password_locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2;`,
      [passwordHash, id]
    );

    // Revoke all active sessions
    await client.query(
      `UPDATE public.staff_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE staff_id = $1 AND revoked_at IS NULL;`,
      [id]
    );

    // Audit log (sanitized, password never logged)
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'STAFF_PASSWORD_RESET',
        entityType: 'staff',
        entityId: id,
        oldState: {
          failedAttempts: currentStaff.password_failed_attempts,
          isLocked: Boolean(currentStaff.password_locked_until && new Date(currentStaff.password_locked_until) > new Date())
        },
        newState: {
          passwordReset: true,
          failedAttemptsCleared: true,
          lockoutCleared: true,
          sessionsRevoked: true
        },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Password reset successfully, lockout cleared, and active sessions revoked',
      id
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

// ============================================================================
// PHASE 3: SUPER ADMIN OUTLETS & MULTI-RESTAURANT MANAGEMENT
// ============================================================================

function normalizeOutletType(type: string): string {
  const map: Record<string, string> = {
    'Resort Dining': 'FINE_DINING',
    'Fine Dining': 'FINE_DINING',
    'Boutique Cafe': 'POOL_DECK',
    'Lounge Bar': 'BAR_LOUNGE',
    'Pool Deck': 'POOL_DECK',
    'Room Service': 'ROOM_SERVICE',
    'Banquet': 'BANQUET'
  };
  return map[type] || type.toUpperCase();
}

/**
 * Lists all outlets across property with metrics (tables, stations, active dining sessions)
 * GET /api/v1/super-admin/outlets
 */
export async function listOutletsAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pool = getDbPool();
    const { isActive, search } = req.query as { isActive?: string; search?: string };

    let query = `
      SELECT 
        o.id,
        o.property_id,
        o.name,
        o.outlet_type,
        o.invoice_series_prefix,
        o.is_active,
        o.operating_hours,
        o.created_at,
        o.updated_at,
        COALESCE((SELECT COUNT(*)::int FROM public.restaurant_tables rt WHERE rt.outlet_id = o.id AND rt.is_active = true), 0) AS tables_count,
        COALESCE((SELECT COUNT(*)::int FROM public.kitchen_stations ks WHERE ks.outlet_id = o.id AND ks.is_active = true), 0) AS stations_count,
        COALESCE((SELECT COUNT(*)::int FROM public.dining_sessions ds WHERE ds.outlet_id = o.id AND ds.status IN ('ACTIVE', 'BILLED')), 0) AS active_sessions_count
      FROM public.outlets o
      WHERE 1=1
    `;
    const params: any[] = [];

    if (isActive === 'true') {
      query += ` AND o.is_active = true`;
    } else if (isActive === 'false') {
      query += ` AND o.is_active = false`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      query += ` AND (lower(o.name) LIKE $${params.length} OR lower(o.id) LIKE $${params.length} OR lower(o.invoice_series_prefix) LIKE $${params.length})`;
    }

    query += ` ORDER BY o.name ASC;`;

    const result = await pool.query(query, params);

    const outlets = result.rows.map((row: any) => ({
      id: row.id,
      propertyId: row.property_id,
      name: row.name,
      outletType: row.outlet_type,
      invoiceSeriesPrefix: row.invoice_series_prefix,
      isActive: row.is_active,
      operatingHours: row.operating_hours,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tablesCount: row.tables_count,
      stationsCount: row.stations_count,
      activeSessionsCount: row.active_sessions_count
    }));

    res.status(200).json({ outlets });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new outlet and automatically provisions default settings and kitchen stations in an atomic transaction
 * POST /api/v1/super-admin/outlets
 */
export async function createOutletAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const {
      id: customId,
      name,
      outletType,
      invoiceSeriesPrefix,
      operatingHours
    } = req.body || {};

    const normalizedType = normalizeOutletType(outletType);
    const validDbTypes = ['FINE_DINING', 'BAR_LOUNGE', 'FINE_DINING_BAR_LOUNGE', 'POOL_DECK', 'ROOM_SERVICE', 'BANQUET'];
    if (!validDbTypes.includes(normalizedType)) {
      throw new BadRequestError(`Invalid outlet type '${outletType}'. Must be one of: ${validDbTypes.join(', ')}`);
    }

    const cleanPrefix = invoiceSeriesPrefix.trim().toUpperCase();

    // Default operating hours
    const finalHours = operatingHours || { opens: '07:00', closes: '23:00' };

    await client.query('BEGIN');

    // Retrieve default property
    const propRes = await client.query('SELECT id FROM public.properties LIMIT 1;');
    if (propRes.rows.length === 0) {
      throw new BadRequestError('No resort property registered in database');
    }
    const propertyId = propRes.rows[0].id;

    // Check prefix uniqueness per property
    const prefixCheck = await client.query(
      `SELECT id FROM public.outlets WHERE property_id = $1 AND invoice_series_prefix = $2;`,
      [propertyId, cleanPrefix]
    );
    if (prefixCheck.rows.length > 0) {
      throw new ConflictError(`Invoice series prefix '${cleanPrefix}' is already in use by outlet '${prefixCheck.rows[0].id}'`);
    }

    // Determine outlet ID
    let outletId = customId ? customId.trim().toLowerCase() : '';
    if (!outletId) {
      const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
      outletId = baseSlug ? `rest-${baseSlug}` : `rest-${Date.now()}`;
      if (outletId.length > 32) {
        outletId = outletId.slice(0, 32);
      }
    }

    // Ensure ID uniqueness
    const idCheck = await client.query('SELECT id FROM public.outlets WHERE id = $1;', [outletId]);
    if (idCheck.rows.length > 0) {
      if (customId) {
        throw new ConflictError(`Outlet ID '${outletId}' already exists`);
      }
      outletId = `rest-${Date.now()}`.slice(0, 32);
    }

    // 1. Insert into public.outlets
    const insertOutletRes = await client.query(
      `INSERT INTO public.outlets (
        id, property_id, name, outlet_type, invoice_series_prefix, is_active, operating_hours
      ) VALUES ($1, $2, $3, $4, $5, true, $6)
      RETURNING id, property_id, name, outlet_type, invoice_series_prefix, is_active, operating_hours, created_at;`,
      [outletId, propertyId, name.trim(), normalizedType, cleanPrefix, JSON.stringify(finalHours)]
    );
    const newOutlet = insertOutletRes.rows[0];

    // 2. Provision default outlet_settings
    await client.query(
      `INSERT INTO public.outlet_settings (
        outlet_id, default_gst_rate_percent, cgst_rate_percent, sgst_rate_percent,
        service_charge_percent, max_auto_round_off_paise, waiter_max_discount_percent,
        waiter_max_discount_paise, manager_max_discount_percent, manager_max_discount_paise,
        approval_escalation_wait_minutes, allow_customer_order_punch, discount_gst_treatment
      ) VALUES (
        $1, 5.00, 2.50, 2.50, 0.00, 50, 0.00, 0, 15.00, 150000, 5, true, 'PRE_TAX_DISCOUNT'
      ) ON CONFLICT (outlet_id) DO NOTHING;`,
      [newOutlet.id]
    );

    // 2b. Provision default dining zone
    await client.query(
      `INSERT INTO public.dining_zones (
        outlet_id, name, code, display_order, is_active
      ) VALUES ($1, 'Main Dining Area', 'ZONE-MAIN', 1, true)
      ON CONFLICT (outlet_id, code) DO NOTHING;`,
      [newOutlet.id]
    );

    // 3. Provision default kitchen stations
    await client.query(
      `INSERT INTO public.kitchen_stations (outlet_id, code, name, display_order, is_active)
       VALUES 
         ($1, 'MAIN_KITCHEN', 'Main Kitchen & Prep', 1, true),
         ($1, 'BAR', 'Beverages & Bar Counter', 2, true),
         ($1, 'DESSERT', 'Pantry & Desserts', 3, true)
       ON CONFLICT (outlet_id, code) DO NOTHING;`,
      [newOutlet.id]
    );

    // 4. Grant creator Super Admin immediate outlet access
    if (req.staff?.id) {
      await client.query(
        `INSERT INTO public.staff_outlet_access (staff_id, outlet_id, is_primary)
         VALUES ($1, $2, false)
         ON CONFLICT (staff_id, outlet_id) DO NOTHING;`,
        [req.staff.id, newOutlet.id]
      );
    }

    // 5. Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'OUTLET_CREATED',
        entityType: 'outlet',
        entityId: newOutlet.id,
        outletId: newOutlet.id,
        newState: {
          id: newOutlet.id,
          name: newOutlet.name,
          outletType: newOutlet.outlet_type,
          invoiceSeriesPrefix: newOutlet.invoice_series_prefix,
          operatingHours: newOutlet.operating_hours,
          isActive: newOutlet.is_active
        },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(201).json({
      outlet: {
        id: newOutlet.id,
        propertyId: newOutlet.property_id,
        name: newOutlet.name,
        outletType: newOutlet.outlet_type,
        invoiceSeriesPrefix: newOutlet.invoice_series_prefix,
        isActive: newOutlet.is_active,
        operatingHours: newOutlet.operating_hours,
        createdAt: newOutlet.created_at,
        tablesCount: 0,
        stationsCount: 3,
        activeSessionsCount: 0
      }
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Updates outlet metadata
 * PATCH /api/v1/super-admin/outlets/:id
 */
export async function updateOutletAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { name, outletType, invoiceSeriesPrefix, operatingHours } = req.body || {};

    await client.query('BEGIN');

    // Lock existing outlet
    const lockRes = await client.query(
      `SELECT * FROM public.outlets WHERE id = $1 FOR UPDATE;`,
      [id]
    );

    if (lockRes.rows.length === 0) {
      throw new NotFoundError(`Outlet with ID '${id}' not found`);
    }

    const currentOutlet = lockRes.rows[0];

    let newType = currentOutlet.outlet_type;
    if (outletType) {
      newType = normalizeOutletType(outletType);
      const validDbTypes = ['FINE_DINING', 'BAR_LOUNGE', 'FINE_DINING_BAR_LOUNGE', 'POOL_DECK', 'ROOM_SERVICE', 'BANQUET'];
      if (!validDbTypes.includes(newType)) {
        throw new BadRequestError(`Invalid outlet type '${outletType}'. Must be one of: ${validDbTypes.join(', ')}`);
      }
    }

    let newPrefix = currentOutlet.invoice_series_prefix;
    if (invoiceSeriesPrefix && invoiceSeriesPrefix.trim().toUpperCase() !== currentOutlet.invoice_series_prefix) {
      newPrefix = invoiceSeriesPrefix.trim().toUpperCase();
      const prefixCheck = await client.query(
        `SELECT id FROM public.outlets WHERE property_id = $1 AND invoice_series_prefix = $2 AND id != $3;`,
        [currentOutlet.property_id, newPrefix, id]
      );
      if (prefixCheck.rows.length > 0) {
        throw new ConflictError(`Invoice series prefix '${newPrefix}' is already in use by outlet '${prefixCheck.rows[0].id}'`);
      }
    }

    const newName = name ? name.trim() : currentOutlet.name;
    const newHours = operatingHours ? JSON.stringify(operatingHours) : JSON.stringify(currentOutlet.operating_hours);

    const updateRes = await client.query(
      `UPDATE public.outlets
       SET name = $1,
           outlet_type = $2,
           invoice_series_prefix = $3,
           operating_hours = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, property_id, name, outlet_type, invoice_series_prefix, is_active, operating_hours, created_at, updated_at;`,
      [newName, newType, newPrefix, newHours, id]
    );

    const updatedOutlet = updateRes.rows[0];

    // Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'OUTLET_UPDATED',
        entityType: 'outlet',
        entityId: id,
        outletId: id,
        oldState: {
          id,
          name: currentOutlet.name,
          outletType: currentOutlet.outlet_type,
          invoiceSeriesPrefix: currentOutlet.invoice_series_prefix
        },
        newState: {
          id,
          name: updatedOutlet.name,
          outletType: updatedOutlet.outlet_type,
          invoiceSeriesPrefix: updatedOutlet.invoice_series_prefix
        },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      outlet: {
        id: updatedOutlet.id,
        propertyId: updatedOutlet.property_id,
        name: updatedOutlet.name,
        outletType: updatedOutlet.outlet_type,
        invoiceSeriesPrefix: updatedOutlet.invoice_series_prefix,
        isActive: updatedOutlet.is_active,
        operatingHours: updatedOutlet.operating_hours,
        createdAt: updatedOutlet.created_at,
        updatedAt: updatedOutlet.updated_at
      }
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Deactivates an outlet (never hard deletes).
 * BLOCKED with 409 Conflict if active dining sessions exist.
 * Concurrency-safe via row-level locks on outlet and dining_sessions.
 * POST /api/v1/super-admin/outlets/:id/deactivate
 */
export async function deactivateOutletAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Lock outlet row
    const outletRes = await client.query(
      `SELECT id, name, is_active FROM public.outlets WHERE id = $1 FOR UPDATE;`,
      [id]
    );

    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet with ID '${id}' not found`);
    }

    const currentOutlet = outletRes.rows[0];

    // 2. Concurrency-safe check for open dining sessions with row-level locks
    const activeSessionsRes = await client.query(
      `SELECT ds.id, ds.status, ds.table_id, rt.table_number
       FROM public.dining_sessions ds
       LEFT JOIN public.restaurant_tables rt ON rt.id = ds.table_id
       WHERE ds.outlet_id = $1 AND ds.status IN ('ACTIVE', 'BILLED')
       FOR UPDATE OF ds;`,
      [id]
    );

    if (activeSessionsRes.rows.length > 0) {
      const activeCount = activeSessionsRes.rows.length;
      const sampleTables = activeSessionsRes.rows
        .map((r: any) => r.table_number || r.table_id)
        .slice(0, 3)
        .join(', ');

      throw new ConflictError(
        `Cannot deactivate outlet '${currentOutlet.name}': there are ${activeCount} active or billed dining session(s) open (tables: ${sampleTables}). All dining sessions must be completed and closed before deactivating this outlet.`
      );
    }

    // 3. Mark outlet inactive (never hard delete)
    await client.query(
      `UPDATE public.outlets
       SET is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [id]
    );

    // 4. Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'OUTLET_DEACTIVATED',
        entityType: 'outlet',
        entityId: id,
        outletId: id,
        oldState: { id, name: currentOutlet.name, isActive: currentOutlet.is_active },
        newState: { id, name: currentOutlet.name, isActive: false },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Outlet '${currentOutlet.name}' deactivated successfully`,
      id
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Reactivates a previously deactivated outlet
 * POST /api/v1/super-admin/outlets/:id/reactivate
 */
export async function reactivateOutletAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Lock outlet row
    const outletRes = await client.query(
      `SELECT id, name, is_active FROM public.outlets WHERE id = $1 FOR UPDATE;`,
      [id]
    );

    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet with ID '${id}' not found`);
    }

    const currentOutlet = outletRes.rows[0];

    // Mark outlet active
    await client.query(
      `UPDATE public.outlets
       SET is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [id]
    );

    // Audit log
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: req.staff?.id,
        action: 'OUTLET_REACTIVATED',
        entityType: 'outlet',
        entityId: id,
        outletId: id,
        oldState: { id, name: currentOutlet.name, isActive: currentOutlet.is_active },
        newState: { id, name: currentOutlet.name, isActive: true },
        requestId,
        ipAddress: req.ip || null
      },
      client
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Outlet '${currentOutlet.name}' reactivated successfully`,
      id
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    next(err);
  } finally {
    client.release();
  }
}



import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  authenticateStaff,
  requireAuth,
  requireAnyPermission,
  requireSuperAdmin,
  requireModuleAccess
} from '../../middleware/auth.js';
import { loginIpRateLimiter } from '../../middleware/loginRateLimiter.js';
import {
  getMe,
  realStaffLogin,
  staffLogout,
  createStaff,
  loginStaff,
  listStaff,
  listOutlets,
  listAssignableStaffRoles
} from './me.controller.js';

import {
  listDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation
} from './designations.controller.js';

import { assignStaffDesignation } from './staffDesignation.controller.js';

import { updateStaffProfile } from './staffProfile.controller.js';

export const meRouter = Router();

// Real production authentication endpoints
// POST /api/v1/auth/staff-login - Real server-side staff authentication with IP rate-limiting
meRouter.post('/auth/staff-login', loginIpRateLimiter, realStaffLogin);

// POST /api/v1/auth/logout - Revokes staff session token
meRouter.post('/auth/logout', authenticateStaff, requireAuth, staffLogout);

// GET /api/v1/auth/me & GET /api/v1/me - Validates session and returns current staff profile
meRouter.get('/auth/me', authenticateStaff, requireAuth, getMe);
meRouter.get('/me', authenticateStaff, requireAuth, getMe);

// POST /api/v1/staff - Super Admin creates new staff member
meRouter.post('/staff', authenticateStaff, requireAuth, createStaff);

// Unified Department + Designation Master.
import {
  listRoleMaster,
  createRoleMaster,
  editRoleMaster,
  removeRoleMaster
} from './roleMaster.controller.js';

const allowRoleMasterManagement = (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): void => {
  const roles = req.staff?.roles.map(r => r.id) ?? [];
  if (roles.includes('SUPER_ADMIN') ||
      (roles.includes('RESTAURANT_OWNER') &&
       (req.staff?.outlets.length ?? 0) > 0)) {
    next();
    return;
  }
  res.status(403).json({ message: 'Permission denied' });
};

meRouter.get(
  '/staff/role-master',
  authenticateStaff, requireAuth,
  requireAnyPermission(['staff:view']),
  requireModuleAccess('staff', 'view'),
  listRoleMaster
);

meRouter.post(
  '/staff/role-master',
  authenticateStaff, requireAuth,
  allowRoleMasterManagement, createRoleMaster
);

meRouter.patch(
  '/staff/role-master/:id',
  authenticateStaff, requireAuth,
  allowRoleMasterManagement, editRoleMaster
);

meRouter.delete(
  '/staff/role-master/:id',
  authenticateStaff, requireAuth,
  allowRoleMasterManagement, removeRoleMaster
);

// Security roles for the Role Assignment dropdown.
// Never expose the full assignable-role catalog to unprivileged users.
meRouter.get(
  '/staff/assignable-roles',
  authenticateStaff,
  requireAuth,
  requireSuperAdmin,
  listAssignableStaffRoles
);

// Designation management is separate from security-role assignment.
const requireDesignationManager = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.staff) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const roles = req.staff.roles.map(role => role.id);
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isOwner = roles.includes('RESTAURANT_OWNER');

  if (!isSuperAdmin && !(isOwner && req.staff.outlets.length > 0)) {
    res.status(403).json({
      message: 'Designation management permission required'
    });
    return;
  }

  next();
};

// Designation Master: reads require staff access.
// Mutations are initially Super Admin-only.
meRouter.get(
  '/staff/designations',
  authenticateStaff, requireAuth,
  requireAnyPermission(['staff:view']),
  requireModuleAccess('staff', 'view'),
  listDesignations
);

meRouter.post(
  '/staff/designations',
  authenticateStaff, requireAuth, requireDesignationManager,
  createDesignation
);

meRouter.patch(
  '/staff/designations/:id',
  authenticateStaff, requireAuth, requireDesignationManager,
  updateDesignation
);

// Permanent designation deletion, restricted to designation managers.
meRouter.delete(
  '/staff/designations/:id',
  authenticateStaff,
  requireAuth,
  requireDesignationManager,
  deleteDesignation
);

// Assign a descriptive designation without modifying security roles.
meRouter.patch(
  '/staff/:id/designation',
  authenticateStaff,
  requireAuth,
  requireSuperAdmin,
  assignStaffDesignation
);

// Basic profile editing — Super Admin only.
// Never accepts role, outlet, password or designation fields.
meRouter.patch(
  '/staff/:id/profile',
  authenticateStaff,
  requireAuth,
  requireSuperAdmin,
  updateStaffProfile
);

// GET /api/v1/staff - List active staff (for floor table allocation, etc.)
meRouter.get(
  '/staff',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['staff:view', 'table:assign', 'table:manage']),
  requireModuleAccess('staff', 'view'),
  listStaff
);

// GET /api/v1/outlets - List active outlets
meRouter.get('/outlets', listOutlets);

// Legacy dev routes (kept for backwards-compatibility and dev safetyRails tests)
meRouter.post('/staff/login', loginStaff);
meRouter.post('/auth/login', loginStaff);

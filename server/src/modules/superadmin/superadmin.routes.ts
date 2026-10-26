import { Router } from 'express';
import {
  authenticateStaff,
  requireAuth,
  requireSuperAdmin
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  getStaffModuleAccess,
  updateStaffModuleAccess,
  listCanonicalModules,
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  listOutletsAdmin,
  createOutletAdmin,
  updateOutletAdmin,
  deactivateOutletAdmin,
  reactivateOutletAdmin
} from './superadmin.controller.js';
import {
  createSuperAdminUserBodySchema,
  updateSuperAdminUserBodySchema,
  userIdParamSchema,
  resetPasswordBodySchema,
  listUsersQuerySchema,
  createSuperAdminOutletBodySchema,
  updateSuperAdminOutletBodySchema,
  outletIdParamSchema,
  listOutletsQuerySchema
} from './superadmin.validation.js';

export const superAdminRouter = Router();

// All Super Admin routes require valid authentication and strict SUPER_ADMIN role (403 for other roles)
superAdminRouter.use('/super-admin', authenticateStaff, requireAuth, requireSuperAdmin);

// Module access endpoints
superAdminRouter.get('/super-admin/modules', listCanonicalModules);
superAdminRouter.get('/super-admin/module-access/:staffId', getStaffModuleAccess);
superAdminRouter.put('/super-admin/module-access/:staffId', updateStaffModuleAccess);

// User management endpoints
superAdminRouter.get(
  '/super-admin/users',
  validate({ query: listUsersQuerySchema }),
  listUsers
);

superAdminRouter.post(
  '/super-admin/users',
  validate({ body: createSuperAdminUserBodySchema }),
  createUser
);

superAdminRouter.patch(
  '/super-admin/users/:id',
  validate({ params: userIdParamSchema, body: updateSuperAdminUserBodySchema }),
  updateUser
);

superAdminRouter.post(
  '/super-admin/users/:id/deactivate',
  validate({ params: userIdParamSchema }),
  deactivateUser
);

superAdminRouter.post(
  '/super-admin/users/:id/reactivate',
  validate({ params: userIdParamSchema }),
  reactivateUser
);

superAdminRouter.post(
  '/super-admin/users/:id/reset-password',
  validate({ params: userIdParamSchema, body: resetPasswordBodySchema }),
  resetUserPassword
);

// Outlet management endpoints (Phase 3)
superAdminRouter.get(
  '/super-admin/outlets',
  validate({ query: listOutletsQuerySchema }),
  listOutletsAdmin
);

superAdminRouter.post(
  '/super-admin/outlets',
  validate({ body: createSuperAdminOutletBodySchema }),
  createOutletAdmin
);

superAdminRouter.patch(
  '/super-admin/outlets/:id',
  validate({ params: outletIdParamSchema, body: updateSuperAdminOutletBodySchema }),
  updateOutletAdmin
);

superAdminRouter.post(
  '/super-admin/outlets/:id/deactivate',
  validate({ params: outletIdParamSchema }),
  deactivateOutletAdmin
);

superAdminRouter.post(
  '/super-admin/outlets/:id/reactivate',
  validate({ params: outletIdParamSchema }),
  reactivateOutletAdmin
);


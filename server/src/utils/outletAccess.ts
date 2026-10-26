import type { AuthenticatedStaffContext } from '../middleware/auth.js';
import { ForbiddenError } from './errors.js';

/** Authenticated memberships are loaded from active outlets, never request hints. */
export function hasGlobalOutletAccess(staff: Pick<AuthenticatedStaffContext,'roles'>): boolean {
  return staff.roles.some(role => role.id === 'SUPER_ADMIN');
}
export function hasStaffOutletAccess(staff: Pick<AuthenticatedStaffContext,'roles'|'outlets'>, outletId: string): boolean {
  return hasGlobalOutletAccess(staff) || staff.outlets.some(outlet => outlet.outletId === outletId);
}
export function checkStaffOutletAccess(staff: AuthenticatedStaffContext, outletId: string): void {
  if (!hasStaffOutletAccess(staff, outletId)) throw new ForbiddenError('Staff does not have authorized access to outlet');
}

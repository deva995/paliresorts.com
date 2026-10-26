import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { getDefaultDashboardRoute } from '../../utils/rbac';
import { UserRole } from '../../types';

interface AccessDeniedProps {
  routePath?: string;
  route?: string;
  userRole?: UserRole;
  matchedModule?: string;
  requiredRoles?: UserRole[];
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  routePath,
  route,
  userRole,
  matchedModule = 'Restricted Operations',
  requiredRoles = ['SUPER_ADMIN']
}) => {
  const { currentUser, pushRoute, currentRoute, effectiveRole } = useApp();
  const activePath = routePath || route || currentRoute;
  const activeRole = userRole || effectiveRole || currentUser.role;
  const isKitchen =
    activeRole === 'KITCHEN_USER' ||
    activeRole === 'KITCHEN_STAFF' ||
    activeRole === 'KITCHEN_COOKING' ||
    activeRole === 'KITCHEN_BAR' ||
    activeRole === 'KITCHEN_EXECUTIVE' ||
    activeRole === 'BEVERAGES' ||
    activeRole === 'DRINKS' ||
    (activeRole as string) === 'KITCHEN';
  const isWaiter = activeRole === 'WAITER';
  const isOwner = activeRole === 'RESTAURANT_OWNER';
  const isCustomer = activeRole === 'CUSTOMER';

  const buttonLabel = isCustomer
    ? 'RETURN TO CUSTOMER MENU'
    : isKitchen
    ? 'RETURN TO KITCHEN'
    : isWaiter
    ? 'RETURN TO WAITER DASHBOARD'
    : isOwner
    ? 'RETURN TO RESTAURANT DASHBOARD'
    : 'Return to Authorized Dashboard';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-[#DDD8C9] p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#163024]/5 border border-[#163024]/20 flex items-center justify-center text-[#163024] shadow-inner">
          <ShieldAlert className="w-8 h-8 text-[#C5A86A]" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C5A86A] bg-[#163024] px-3 py-1 rounded-full border border-[#244737]">
            HTTP 403 Forbidden • Role-Based Access Control
          </span>
          <h2 className="text-2xl font-bold text-[#163024] tracking-tight font-serif uppercase">
            {isCustomer ? '403 ACCESS RESTRICTED' : 'ACCESS RESTRICTED'}
          </h2>
          <p className="text-sm text-[#1D241F] leading-relaxed font-medium">
            You don't have permission to access this area.
          </p>
          <p className="text-xs text-[#687067]">
            Your current assigned profile <strong className="text-[#1D241F] font-semibold">{currentUser.roleTitle || currentUser.name}</strong> ({activeRole}) does not possess authorization to access the <span className="font-semibold text-[#163024]">{matchedModule}</span> route.
          </p>
        </div>

        {/* Diagnostic Card */}
        <div className="bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl p-4 text-left space-y-2 text-xs font-mono">
          <div className="flex justify-between border-b border-[#DDD8C9] pb-1.5">
            <span className="text-[#687067]">Attempted Route:</span>
            <span className="text-rose-700 font-bold">{activePath}</span>
          </div>
          <div className="flex justify-between border-b border-[#DDD8C9] pb-1.5">
            <span className="text-[#687067]">Your Active Role:</span>
            <span className="text-[#1D241F] font-semibold">{activeRole}</span>
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-[#687067]">Authorized System Roles:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {requiredRoles.map(role => (
                <span
                  key={role}
                  className="px-2 py-0.5 bg-white text-[#163024] border border-[#DDD8C9] rounded text-[11px] font-semibold"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            id="btn-return-dashboard"
            onClick={() => pushRoute(getDefaultDashboardRoute(activeRole))}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#C5A86A]" />
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

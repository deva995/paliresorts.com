import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { AccessDenied } from './components/layout/AccessDenied';
import { checkRouteAccess, getDefaultDashboardRoute } from './utils/rbac';

// Module View Components
import { LoginView } from './views/auth/LoginView';
import { SuperAdminDashboard } from './views/superadmin/SuperAdminDashboard';
import { RestaurantViews } from './views/restaurant/RestaurantViews';
import { HotelViews } from './views/hotel/HotelViews';
import { CashierViews } from './views/cashier/CashierViews';
import { KitchenKDSView } from './views/kitchen/KitchenKDSView';
import { WaiterViews } from './views/waiter/WaiterViews';
import { HousekeepingView } from './views/housekeeping/HousekeepingView';
import { RoomServiceView } from './views/roomservice/RoomServiceView';
import { InventoryView } from './views/inventory/InventoryView';
import { StaffView } from './views/staff/StaffView';
import { CRMView } from './views/crm/CRMView';
import { ReportsView } from './views/reports/ReportsView';
import { SystemViews } from './views/system/SystemViews';
import { CustomerPortalView } from './views/customer/CustomerPortalView';
import { OnboardingTour } from './components/common/OnboardingTour';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FeatureDisabledView } from './components/common/FeatureDisabledView';
import { FEATURES } from './config/features';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    restaurantSyncError,
    isAuthenticated,
    authRole,
    isAuthLoading,
    currentUser,
    effectiveRole,
    previewRole,
    exitPreviewRole,
    currentRoute,
    isKitchenOffline,
    toggleKitchenOffline,
    syncOfflineProductionEvents,
    isTourOpen,
    closeTour,
    tourRoleOverride,
    pushRoute
  } = useApp();

  // Dual-State Sidebar Controller
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);

  // Close mobile sidebar on route transition
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [currentRoute]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Identify protected route groups:
  const isProtectedGroup =
    currentRoute.startsWith('/restaurant') ||
    currentRoute.startsWith('/waiter') ||
    currentRoute.startsWith('/kitchen') ||
    currentRoute.startsWith('/cashier') ||
    currentRoute.startsWith('/hotel') ||
    currentRoute.startsWith('/housekeeping') ||
    currentRoute.startsWith('/room-service') ||
    currentRoute.startsWith('/inventory') ||
    currentRoute.startsWith('/staff') ||
    currentRoute.startsWith('/users') ||
    currentRoute.startsWith('/crm') ||
    currentRoute.startsWith('/reports') ||
    currentRoute.startsWith('/settings') ||
    currentRoute.startsWith('/system') ||
    currentRoute.startsWith('/roles') ||
    currentRoute.startsWith('/permissions') ||
    currentRoute.startsWith('/audit-logs') ||
    currentRoute.startsWith('/payments') ||
    currentRoute.startsWith('/reception') ||
    currentRoute.startsWith('/frontdesk') ||
    currentRoute.startsWith('/super-admin') ||
    currentRoute.startsWith('/admin') ||
    currentRoute === '/restaurants';

  // Server-verified role authority for route guards:
  const serverRole = authRole || currentUser.role;
  const access = checkRouteAccess(currentRoute, serverRole, currentUser);
  const userDashboard = getDefaultDashboardRoute(serverRole);

  // Hook 1: Signed-out redirection: Every protected route group redirects to /login when signed out
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && isProtectedGroup && currentRoute !== '/login') {
      pushRoute('/login');
    }
  }, [isAuthLoading, isAuthenticated, isProtectedGroup, currentRoute, pushRoute]);

  // Hook 2: Role-access redirection: Every frontend route group redirects a user without the right role to their own dashboard
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && isProtectedGroup && !access.allowed) {
      if (currentRoute !== userDashboard) pushRoute(userDashboard);
    }
  }, [isAuthLoading, isAuthenticated, isProtectedGroup, access.allowed, userDashboard, pushRoute]);

  // --- CONDITIONAL EARLY RETURNS (strictly placed after all hooks have executed) ---

  // 1. Customer QR Dining & Guest Portal (Publicly accessible without employee login)
  if (currentRoute.startsWith('/customer') || currentRoute.startsWith('/qr') || currentRoute.startsWith('/menu')) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] text-[#1D241F] font-sans antialiased">
        <CustomerPortalView />
      </div>
    );
  }

  // 2. Loading state while verifying server session via GET /auth/me
  if (isAuthLoading && isProtectedGroup) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#163024] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated View
  if (!isAuthenticated || currentRoute === '/login') {
    return <LoginView />;
  }

  // 4. Role Access Redirection Loader
  if (!access.allowed && currentRoute === userDashboard) {
    return <AccessDenied />;
  }

  if (!access.allowed) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#163024] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Redirecting to your dashboard...</span>
        </div>
      </div>
    );
  }

  // 4. Resolve Active Route View
  const renderView = () => {
    if (
      currentRoute.startsWith('/super-admin') ||
      currentRoute.startsWith('/admin') ||
      currentRoute === '/restaurants'
    ) {
      return <SuperAdminDashboard />;
    }

    if (currentRoute.startsWith('/restaurant')) {
      return <RestaurantViews />;
    }

    if (currentRoute.startsWith('/kitchen')) {
      return <KitchenKDSView />;
    }

    if (currentRoute.startsWith('/waiter')) {
      return <WaiterViews />;
    }

    if (
      currentRoute.startsWith('/hotel') ||
      currentRoute.startsWith('/reception') ||
      currentRoute.startsWith('/frontdesk')
    ) {
      return <HotelViews />;
    }

    if (currentRoute.startsWith('/cashier') || currentRoute.startsWith('/payments')) {
      return <CashierViews />;
    }

    if (currentRoute.startsWith('/housekeeping')) {
      return <HousekeepingView />;
    }

    if (currentRoute.startsWith('/room-service')) {
      if (!FEATURES.ROOM_SERVICE) {
        return (
          <FeatureDisabledView
            featureName="Room Service"
            description="In-room dining order processing is disabled in this release."
          />
        );
      }
      return <RoomServiceView />;
    }

    if (currentRoute.startsWith('/inventory')) {
      return <InventoryView />;
    }

    if (currentRoute.startsWith('/staff') || currentRoute.startsWith('/users')) {
      return <StaffView />;
    }

    if (currentRoute.startsWith('/crm')) {
      if (!FEATURES.CRM) {
        return (
          <FeatureDisabledView
            featureName="Guest CRM"
            description="Customer relationship management is disabled in this release."
          />
        );
      }
      return <CRMView />;
    }

    if (currentRoute.startsWith('/reports')) {
      return <ReportsView />;
    }

    if (
      currentRoute.startsWith('/settings') ||
      currentRoute.startsWith('/system') ||
      currentRoute.startsWith('/audit-logs') ||
      currentRoute.startsWith('/roles') ||
      currentRoute.startsWith('/permissions')
    ) {
      return <SystemViews />;
    }

    // Default fallback based on effective role
    if (effectiveRole === 'RESTAURANT_OWNER') {
      return <RestaurantViews />;
    }
    if (
      effectiveRole === 'KITCHEN_STAFF' ||
      effectiveRole === 'KITCHEN_USER' ||
      effectiveRole === 'KITCHEN_COOKING' ||
      effectiveRole === 'KITCHEN_BAR' ||
      effectiveRole === 'KITCHEN_EXECUTIVE' ||
      effectiveRole === 'BEVERAGES' ||
      effectiveRole === 'DRINKS'
    ) {
      return <KitchenKDSView />;
    }
    if (effectiveRole === 'WAITER' || effectiveRole === 'WAITER_MANAGER') {
      return <WaiterViews />;
    }
    if (effectiveRole === 'CASHIER') {
      return <CashierViews />;
    }
    if (effectiveRole === 'RECEPTIONIST') {
      return <HotelViews />;
    }
    if (effectiveRole === 'HOUSEKEEPING') {
      return <HousekeepingView />;
    }
    if (effectiveRole === 'ROOM_SERVICE') {
      return <RoomServiceView />;
    }

    return <SuperAdminDashboard />;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#163024] selection:text-[#F7F4EC]">
      {/* Super Admin Role Preview Notification Banner */}
      {previewRole && (
        <div className="bg-[#C5A86A] text-[#163024] px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs sticky top-0 z-50 border-b border-[#B39352]">
          <div className="flex items-center gap-2">
            <span className="bg-[#163024] text-[#F7F4EC] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
              Preview Mode
            </span>
            <span>
              Simulating live user interface as{' '}
              <strong className="underline underline-offset-2">{previewRole}</strong>
            </span>
          </div>
          <button
            onClick={exitPreviewRole}
            className="flex items-center gap-1.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>Exit Role Preview</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offline Production Alerts Banner */}
      {isKitchenOffline && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
            <span>
              <strong>Kitchen Offline Mode Active:</strong> Production events are queued locally and will sync when reconnected.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncOfflineProductionEvents}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Now</span>
            </button>
            <button
              onClick={toggleKitchenOffline}
              className="bg-white text-amber-900 hover:bg-amber-50 px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              Go Online
            </button>
          </div>
        </div>
      )}

      {/* Global Header */}
      <Header
        onToggleSidebar={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsMobileSidebarOpen(prev => !prev);
          } else {
            setIsDesktopSidebarOpen(prev => !prev);
          }
        }}
        isSidebarOpen={isMobileSidebarOpen}
      />

      <div className="flex flex-1 relative">
        {/* Collapsible Multi-Tier Navigation Sidebar */}
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          isDesktopOpen={isDesktopSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
          onToggleDesktop={() => setIsDesktopSidebarOpen(prev => !prev)}
        />

        {/* Dynamic Responsive View Shell */}
        <main
          className={`flex-1 transition-all duration-300 ease-in-out w-full ${
            isDesktopSidebarOpen ? 'lg:pl-72' : 'lg:pl-20'
          }`}
        >
          <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {isProtectedGroup && restaurantSyncError && <p role="alert" className="p-3 text-red-700">{restaurantSyncError}</p>}
            {renderView()}
          </div>
        </main>
      </div>

      {/* Global Onboarding Tour Modal */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={closeTour}
        initialRole={tourRoleOverride || effectiveRole}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

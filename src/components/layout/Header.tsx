import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  Search,
  LogOut,
  Menu,
  Sparkles,
  QrCode,
  BedDouble,
  Store,
  ChevronDown,
  Check,
  Building2,
  Users,
  UserCheck,
  Layers,
  ClipboardList,
  CalendarDays,
  Hotel,
  FileBarChart,
  ArrowRight,
  Compass
} from 'lucide-react';
import { UserRole } from '../../types';
import { buildGlobalSearch } from '../../utils/globalSearch';
import { checkRouteAccess } from '../../utils/rbac';
import { ProfileModal } from './ProfileModal';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const getRoleBadgeStyle = (role: UserRole) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-[#163024] text-[#F7F4EC] border-[#163024]';
    case 'RESTAURANT_OWNER':
      return 'bg-[#526B4A]/15 text-[#163024] border-[#526B4A]/30';
    case 'WAITER_MANAGER':
      return 'bg-[#526B4A]/20 text-[#163024] border-[#526B4A]/40';
    case 'WAITER':
      return 'bg-[#C5A86A]/20 text-[#163024] border-[#C5A86A]/50';
    case 'KITCHEN_STAFF':
    case 'KITCHEN_USER':
      return 'bg-[#EDE7D8] text-[#3e5237] border-[#DDD8C9]';
    case 'CASHIER':
      return 'bg-[#526B4A]/10 text-[#163024] border-[#DDD8C9]';
    default:
      return 'bg-[#F7F4EC] text-[#1D241F] border-[#DDD8C9]';
  }
};

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const {
    currentUser,
    effectiveRole,
    currentRoute,
    pushRoute,
    logout,
    notifications,
    markNotificationRead,
    clearAllNotifications,
    restaurants,
    activeRestaurantId,
    activeRestaurant,
    switchRestaurant,
    tables,
    orders,
    reservations,
    rooms,
    menuItems,
    customers,
    employees,
    openTour
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showRestaurantMenu, setShowRestaurantMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const restaurantMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const isOwner = effectiveRole === 'RESTAURANT_OWNER';
  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN';
  const isKitchen = effectiveRole === 'KITCHEN_USER' || effectiveRole === 'KITCHEN_STAFF' || (effectiveRole as string) === 'KITCHEN';
  const isWaiter = effectiveRole === 'WAITER';

  // Section 25: Filtered notifications for Kitchen and Waiter / Restaurant Owner
  const displayedNotifications = notifications.filter(n => {
    if (isSuperAdmin) return true;
    const t = (n.title + ' ' + n.message + ' ' + (n.type || '')).toLowerCase();
    if (isKitchen) {
      return t.includes('order') || t.includes('kitchen') || t.includes('kds') || t.includes('kot') || t.includes('bot') || t.includes('ready') || t.includes('preparing');
    }
    if (isWaiter) {
      return t.includes('order') || t.includes('waiter') || t.includes('table') || t.includes('ready') || t.includes('bill') || t.includes('service') || t.includes('request');
    }
    if (isOwner) {
      return (
        t.includes('order') ||
        t.includes('kitchen') ||
        t.includes('kds') ||
        t.includes('waiter') ||
        t.includes('bill') ||
        t.includes('payment') ||
        t.includes('table') ||
        t.includes('dining') ||
        t.includes('ready')
      );
    }
    return true;
  });

  const unreadCount = displayedNotifications.filter(n => !n.read).length;

  // Keyboard shortcut listener for CMD+K or CTRL+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowNotifications(false);
        setShowRestaurantMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (restaurantMenuRef.current && !restaurantMenuRef.current.contains(e.target as Node)) {
        setShowRestaurantMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = (route: string) => {
    const parts = route.split('/').filter(Boolean);
    if (parts.length === 0) return 'Executive Overview';
    const lastPart = parts[parts.length - 1];
    return lastPart
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const searchIcons={Employees:Users,Customers:UserCheck,Tables:Store,Orders:ClipboardList,Reservations:CalendarDays,Rooms:Hotel,'Menu Items':Layers,Reports:FileBarChart};
  const searchResults=buildGlobalSearch(searchQuery,{employees,customers,tables,orders,reservations,rooms,menuItems},{...currentUser,role:effectiveRole},activeRestaurantId).map(result=>({...result,icon:searchIcons[result.category]}));

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#DDD8C9] h-18 px-4 lg:px-6 flex items-center justify-between transition-all">
      {/* Left: Mobile Toggle, Brand & Page Header */}
      <div className="flex items-center gap-3">
        <button
          id="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
          title="Toggle Navigation Sidebar"
          className={`p-2 -ml-1 text-[#1D241F] hover:text-[#163024] hover:bg-[#F7F4EC] rounded-lg transition-colors cursor-pointer ${
            isWaiter ? 'hidden lg:inline-flex' : ''
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block select-none">
            <img
              src="/palilogo.png"
              alt="Pali Resort & Club • Pali Village"
              className="h-8 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-[#DDD8C9] hidden sm:inline-block">/</span>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-[#163024] tracking-tight">
              {isKitchen ? 'Kitchen Operations & KDS' : isWaiter ? currentUser.name : isOwner ? 'Restaurant Operations' : getPageTitle(currentRoute)}
            </h1>
            <p className="text-[10px] text-[#687067] hidden sm:block font-medium">
              {isKitchen ? 'Pali Resort & Club • Culinary Line & Dispatch' : isWaiter ? `${currentUser.name} • Waiter` : isOwner ? 'Pali Resort & Club • F&B Dining' : currentUser.department}
            </p>
          </div>
        </div>
      </div>

      {/* Center: Global Quick Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <button
          id="btn-header-search"
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] border border-[#DDD8C9] rounded-xl text-[#687067] text-xs transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#687067] group-hover:text-[#163024] transition-colors" />
            <span className="truncate">Search employees, tables, orders, rooms, menu...</span>
          </div>
          <kbd className="hidden lg:inline-block text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#DDD8C9] rounded text-[#687067]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Live Sync, Multi-Restaurant Switcher (Super Admin Only), Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Section 8: Live synchronization status */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#526B4A]/10 border border-[#DDD8C9] text-[11px] font-medium text-[#163024] select-none">
          <span className="w-2 h-2 rounded-full bg-[#526B4A] animate-pulse" />
          <span>Cloud Synced</span>
        </div>

        {/* Section 18: Multi-Restaurant Switcher (Super Admin ONLY!) */}
        {isSuperAdmin && (
          <div className="relative" ref={restaurantMenuRef}>
            <button
              id="btn-restaurant-switcher"
              onClick={() => setShowRestaurantMenu(!showRestaurantMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#F7F4EC] hover:bg-[#ede8db] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024] transition-colors cursor-pointer"
              title="Switch Active Outlet"
            >
              <Store className="w-3.5 h-3.5 text-[#C5A86A]" />
              <span className="max-w-[130px] truncate">{activeRestaurant?.name || 'All Outlets'}</span>
              <span className="text-[10px] text-[#687067] font-normal hidden sm:inline">
                ({activeRestaurant?.type || 'Dining'})
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#687067]" />
            </button>

            {showRestaurantMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#DDD8C9] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3 bg-[#F7F4EC] border-b border-[#DDD8C9]">
                  <p className="text-[10px] font-bold text-[#163024] uppercase tracking-wider">
                    Operational Outlets
                  </p>
                  <p className="text-[10px] text-[#687067]">
                    Multi-outlet tenant isolation active
                  </p>
                </div>
                <div className="p-1.5 space-y-1">
                  {restaurants.filter(r => r.status === 'active').map(rest => {
                    const isSelected = rest.id === activeRestaurantId;
                    return (
                      <button
                        key={rest.id}
                        onClick={() => {
                          switchRestaurant(rest.id);
                          setShowRestaurantMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#163024] text-[#F7F4EC]'
                            : 'hover:bg-[#F7F4EC] text-[#1D241F]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>{rest.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-normal uppercase ${
                                isSelected
                                  ? 'bg-[#C5A86A] text-[#163024]'
                                  : 'bg-[#526B4A]/15 text-[#526B4A]'
                              }`}
                            >
                              {rest.type}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-[#DDD8C9]' : 'text-[#687067]'}`}>
                            {rest.tablesCount} Tables • Tax: {rest.taxRate}% GST
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#C5A86A]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationsRef}>
          <button
            id="btn-notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[#1D241F] hover:text-[#163024] hover:bg-[#F7F4EC] rounded-xl transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#C53030] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#DDD8C9] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3.5 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#163024] text-xs uppercase tracking-wider">Notifications</span>
                  <span className="text-[10px] bg-[#163024] text-[#F7F4EC] px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                </div>
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-[#526B4A] hover:text-[#163024] font-semibold cursor-pointer"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-[#DDD8C9]/50">
                {displayedNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#687067]">No new notifications</div>
                ) : (
                  displayedNotifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationRead(notif.id);
                        if (notif.link) {
                          pushRoute(notif.link);
                          setShowNotifications(false);
                        }
                      }}
                      className={`p-3 text-xs hover:bg-[#F7F4EC]/60 transition-colors cursor-pointer ${
                        !notif.read ? 'bg-[#F7F4EC]/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-[#1D241F]">{notif.title}</p>
                        <span className="text-[10px] text-[#687067] whitespace-nowrap">{notif.createdAt}</span>
                      </div>
                      <p className="text-[#687067] mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Authenticated User Role Badge */}
        <button
          onClick={() => setShowProfileModal(true)}
          title="View Profile Details"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border select-none cursor-pointer transition-transform hover:scale-[1.02] ${getRoleBadgeStyle(currentUser.role)}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A86A]" />
          <span>{currentUser.roleTitle}</span>
        </button>

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#DDD8C9]">
          <button
            onClick={() => setShowProfileModal(true)}
            title="Open Profile"
            className="cursor-pointer transition-transform hover:scale-105"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#C5A86A]/40"
            />
          </button>
          <button
            id="btn-logout"
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-[#687067] hover:text-[#C53030] hover:bg-[#C53030]/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Profile Details Modal */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />

      {/* Global Quick Search Modal (Section 9) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/40 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-[#DDD8C9] flex items-center gap-3 bg-[#F7F4EC]/40">
              <Search className="w-5 h-5 text-[#163024]" />
              <input
                autoFocus
                type="text"
                placeholder="Search anything... (Employees, Customers, Tables, Orders, Rooms, Menu, Reports)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-sm outline-none bg-transparent text-[#1D241F] placeholder:text-[#687067]"
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-xs px-2.5 py-1 bg-white hover:bg-[#F7F4EC] border border-[#DDD8C9] rounded-lg text-[#687067] font-semibold cursor-pointer"
              >
                ESC
              </button>
            </div>

            {/* Quick Categories Bar when empty */}
            {!searchQuery.trim() && (
              <div className="p-5 text-xs text-[#687067] space-y-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#163024]">
                  <span>Operational Quick Links</span>
                  <span className="text-[#687067] font-normal">Type to search live records</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Employees & Staff', path: '/users', icon: Users },
                    { label: 'Guest Profiles', path: '/crm/customers', icon: UserCheck },
                    { label: 'Restaurant Tables', path: '/restaurant/tables', icon: Store },
                    { label: 'Live Orders', path: '/restaurant/orders', icon: ClipboardList },
                    { label: 'Room Bookings', path: '/hotel/reservations', icon: CalendarDays },
                    { label: 'Hotel Rooms', path: '/hotel/rooms', icon: Hotel },
                    { label: 'Resort Food Menu', path: '/restaurant/menu', icon: Layers },
                    { label: 'Financial Reports', path: '/reports/dashboard', icon: FileBarChart }
                  ].filter(item=>checkRouteAccess(item.path,effectiveRole,currentUser).allowed).map(qItem => {
                    const QIcon = qItem.icon;
                    return (
                      <button
                        key={qItem.path}
                        onClick={() => {
                          pushRoute(qItem.path);
                          setShowSearchModal(false);
                        }}
                        className="p-3 bg-[#F7F4EC] hover:bg-[#ede8db] border border-[#DDD8C9] rounded-xl text-left transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <QIcon className="w-4 h-4 text-[#526B4A]" />
                        <span className="font-semibold text-[#163024]">{qItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results List */}
            {searchQuery.trim() && (
              <div className="p-2 max-h-96 overflow-y-auto divide-y divide-[#DDD8C9]/40 scrollbar-thin">
                {searchResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#687067]">
                    No matching records found for "{searchQuery}".
                  </div>
                ) : (
                  searchResults.map(result => {
                    const ResultIcon = result.icon;
                    return (
                      <button
                        key={result.id}
                        onClick={() => {
                          pushRoute(result.path);
                          setShowSearchModal(false);
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-[#F7F4EC] text-left transition-colors group cursor-pointer rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#163024]/10 text-[#163024] flex items-center justify-center">
                            <ResultIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1D241F] group-hover:text-[#163024]">
                              {result.title}
                            </p>
                            <p className="text-xs text-[#687067]">{result.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-white text-[#526B4A] border border-[#DDD8C9] rounded-md font-bold uppercase">
                            {result.category}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#DDD8C9] group-hover:text-[#163024] transition-colors" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

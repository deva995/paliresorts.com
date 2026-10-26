import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { DEMO_USERS } from '../../data/mockData';
import { api, SuperAdminUserItem, SuperAdminOutletItem } from '../../api/client';
import {
  ShieldCheck,
  Users,
  KeyRound,
  FileText,
  Settings,
  Search,
  Plus,
  CheckCircle2,
  Lock,
  Building2,
  Server,
  Globe,
  Database,
  X,
  Store,
  Edit2,
  Check,
  Filter,
  AlertTriangle,
  History,
  Shield,
  Layers,
  Sparkles,
  UtensilsCrossed,
  CookingPot,
  UserSquare2,
  CreditCard,
  Hotel,
  Power,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { UserRole, User, Restaurant } from '../../types';
import { ModuleAccessView } from './ModuleAccessView';

export const SystemViews: React.FC = () => {
  const {
    currentRoute,
    pushRoute,
    auditLogs,
    restaurants,
    activeRestaurantId,
    switchRestaurant,
    tables,
    orders,
    employees,
    currentUser
  } = useApp();

  const activeView = currentRoute.replace('/', '').split('/')[0] || 'users';

  // State
  const [usersList, setUsersList] = useState<User[]>(DEMO_USERS);
  const [realUsers, setRealUsers] = useState<SuperAdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [userFeedback, setUserFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showAddRestaurantModal, setShowAddRestaurantModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedAdminUser, setSelectedAdminUser] = useState<SuperAdminUserItem | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleId: 'WAITER',
    outletId: 'rest-1',
    password: ''
  });

  const [editForm, setEditForm] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleId: 'WAITER',
    outletId: 'rest-1'
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: '',
    confirmPassword: ''
  });
  const [submittingUserAction, setSubmittingUserAction] = useState(false);

  // Filters for Audit Log
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('all');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Search for Users
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // Load real staff accounts from Super Admin API
  const loadRealUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await api.listSuperAdminUsers({
        role: userRoleFilter === 'all' ? undefined : userRoleFilter,
        isActive: userStatusFilter === 'all' ? undefined : userStatusFilter,
        search: userSearchQuery.trim() || undefined
      });
      if (res && Array.isArray(res.users)) {
        setRealUsers(res.users);
      }
    } catch (err: any) {
      console.warn('Super Admin list users failed, falling back:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [userRoleFilter, userStatusFilter, userSearchQuery]);

  useEffect(() => {
    if (activeView === 'users') {
      loadRealUsers();
    }
  }, [activeView, loadRealUsers]);

  const activeSuperAdminCount = useMemo(() => {
    return realUsers.filter(u => u.isActive && u.roles.some(r => r.id === 'SUPER_ADMIN')).length;
  }, [realUsers]);

  // Phase 3: Outlets & Multi-Restaurant State
  const [realOutlets, setRealOutlets] = useState<SuperAdminOutletItem[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [outletStatusFilter, setOutletStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [outletSearchQuery, setOutletSearchQuery] = useState('');
  const [outletFeedback, setOutletFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showCreateOutletModal, setShowCreateOutletModal] = useState(false);
  const [showEditOutletModal, setShowEditOutletModal] = useState(false);
  const [showDeactivateOutletModal, setShowDeactivateOutletModal] = useState(false);
  const [showReactivateOutletModal, setShowReactivateOutletModal] = useState(false);
  const [selectedAdminOutlet, setSelectedAdminOutlet] = useState<SuperAdminOutletItem | null>(null);
  const [submittingOutletAction, setSubmittingOutletAction] = useState(false);

  const [createOutletForm, setCreateOutletForm] = useState({
    id: '',
    name: '',
    outletType: 'FINE_DINING',
    invoiceSeriesPrefix: '',
    opens: '07:00',
    closes: '23:00'
  });

  const [editOutletForm, setEditOutletForm] = useState({
    name: '',
    outletType: 'FINE_DINING',
    invoiceSeriesPrefix: '',
    opens: '07:00',
    closes: '23:00'
  });

  const loadRealOutlets = useCallback(async () => {
    try {
      setLoadingOutlets(true);
      const res = await api.listSuperAdminOutlets({
        isActive: outletStatusFilter === 'all' ? undefined : outletStatusFilter,
        search: outletSearchQuery.trim() || undefined
      });
      if (res && Array.isArray(res.outlets)) {
        setRealOutlets(res.outlets);
      }
    } catch (err: any) {
      console.warn('Super Admin list outlets failed, falling back:', err);
    } finally {
      setLoadingOutlets(false);
    }
  }, [outletStatusFilter, outletSearchQuery]);

  useEffect(() => {
    if (currentRoute === '/settings/outlets') {
      loadRealOutlets();
    }
  }, [currentRoute, loadRealOutlets]);

  // Settings State
  const [propertyName, setPropertyName] = useState('Pali Resort & Club');
  const [gstin, setGstin] = useState('27AABCG1234F1Z5');
  const [currency] = useState('INR (₹)');
  const [saveMessage, setSaveMessage] = useState(false);


  // User Form State (Section 21)
  const [newUser, setNewUser] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'WAITER' as UserRole,
    department: 'Food & Beverage',
    restaurantId: 'rest-1',
    status: 'active' as 'active' | 'inactive',
    permissions: ['VIEW_ORDERS', 'ATTEND_TABLES']
  });

  // Section 22: Primary Roles Definition
  const coreRoles = [
    {
      role: 'SUPER_ADMIN',
      name: 'Super Administrator',
      desc: 'Complete omni-channel resort authority, SaaS configuration, and financial reconciliation.',
      scope: 'Global System, All Outlets, Financials, RBAC & Audit Trails',
      icon: ShieldCheck
    },
    {
      role: 'RESTAURANT_OWNER',
      name: 'Restaurant Owner',
      desc: 'Dedicated F&B outlet oversight, menu governance, sales tracking, and table turnover.',
      scope: 'Restaurant & Dining, Kitchen KDS, Waiter Operations (Scoped strictly to outlet)',
      icon: UtensilsCrossed
    },
    {
      role: 'WAITER',
      name: 'Waiter & Captain',
      desc: 'Floor management, guest request servicing, and real-time order punching at tables.',
      scope: 'Table Service, Guest Requests, Live Check Punching',
      icon: UserSquare2
    },
    {
      role: 'KITCHEN_STAFF',
      name: 'Kitchen & KDS (Chef)',
      desc: 'Kitchen order ticket queue, preparation phase dispatch, and cooking status updates.',
      scope: 'Kitchen Display System, Prep Stations, Dispatch Alerts',
      icon: CookingPot
    },
    {
      role: 'CUSTOMER',
      name: 'Resort Guest (Customer)',
      desc: 'Self-service mobile digital QR ordering, room service dining, and booking portals.',
      scope: 'QR Digital Menu, Order Status, Room Reservation Inquiries',
      icon: Users
    }
  ];

  // Extended Roles Matrix
  const rolesMatrix = [
    { role: 'SUPER_ADMIN', name: 'Super Administrator', users: 1, access: 'Global Unrestricted Master Access' },
    { role: 'RESTAURANT_OWNER', name: 'Restaurant Owner', users: 1, access: 'F&B, Menus, Tables, Staff, Dining Outlets' },
    { role: 'CASHIER', name: 'Billing & POS Cashier', users: 3, access: 'Fast POS, Bill Settlements, Daily Register' },
    { role: 'KITCHEN_STAFF', name: 'Head Chef & Cook (KDS)', users: 4, access: 'Kitchen Display System, Cooking Timers' },
    { role: 'WAITER', name: 'Captain & Waiter', users: 6, access: 'Table Service, Guest Requests, Order Punch' },
    { role: 'RECEPTIONIST', name: 'Front Desk Executive', users: 3, access: 'Check-In, Check-Out, Keycards, Guest Folios' },
    { role: 'HOUSEKEEPING', name: 'Housekeeper & Supervisor', users: 5, access: 'Cleaning Queue, Turnarounds, Inspections' },
    { role: 'ROOM_SERVICE', name: 'Room Service & In-Dining', users: 2, access: 'In-Room Deliveries & Orders' }
  ];

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.phone.includes(userSearchQuery);
      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchSearch && matchRole;
    });
  }, [usersList, userSearchQuery, userRoleFilter]);

  // Filtered Audit Logs (Section 23)
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchModule = auditModuleFilter === 'all' || log.module?.toLowerCase() === auditModuleFilter.toLowerCase();
      const matchRole = auditRoleFilter === 'all' || log.userRole === auditRoleFilter;
      const matchStatus = auditStatusFilter === 'all' || log.status === auditStatusFilter;
      const matchQuery =
        !auditSearchQuery ||
        log.action.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        log.userName.toLowerCase().includes(auditSearchQuery.toLowerCase());
      return matchModule && matchRole && matchStatus && matchQuery;
    });
  }, [auditLogs, auditModuleFilter, auditRoleFilter, auditStatusFilter, auditSearchQuery]);

  // Super Admin Action Handlers
  const handleCreateSuperAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      setUserFeedback({ type: 'error', message: 'Please provide all required fields including password (min 8 chars).' });
      return;
    }
    if (createForm.password.length < 8) {
      setUserFeedback({ type: 'error', message: 'Password must be at least 8 characters long.' });
      return;
    }

    try {
      setSubmittingUserAction(true);
      setUserFeedback(null);
      await api.createSuperAdminUser({
        employeeCode: createForm.employeeCode.trim() || `EMP-${Date.now().toString().slice(-4)}`,
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        roleId: createForm.roleId,
        outletId: createForm.outletId || 'rest-1',
        password: createForm.password
      });

      setUserFeedback({ type: 'success', message: `Staff account created successfully for ${createForm.firstName} ${createForm.lastName}.` });
      setShowAddUserModal(false);
      setCreateForm({
        employeeCode: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        roleId: 'WAITER',
        outletId: 'rest-1',
        password: ''
      });
      await loadRealUsers();
    } catch (err: any) {
      setUserFeedback({ type: 'error', message: err.message || 'Failed to create staff account.' });
    } finally {
      setSubmittingUserAction(false);
    }
  };

  const handleUpdateSuperAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminUser) return;

    try {
      setSubmittingUserAction(true);
      setUserFeedback(null);
      await api.updateSuperAdminUser(selectedAdminUser.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        employeeCode: editForm.employeeCode.trim(),
        roleId: editForm.roleId,
        outletId: editForm.outletId
      });

      setUserFeedback({ type: 'success', message: `Staff profile updated for ${editForm.firstName} ${editForm.lastName}.` });
      setShowEditUserModal(false);
      setSelectedAdminUser(null);
      await loadRealUsers();
    } catch (err: any) {
      setUserFeedback({ type: 'error', message: err.message || 'Failed to update user profile.' });
    } finally {
      setSubmittingUserAction(false);
    }
  };

  const handleDeactivateUser = async () => {
    if (!selectedAdminUser) return;
    try {
      setSubmittingUserAction(true);
      setUserFeedback(null);
      await api.deactivateSuperAdminUser(selectedAdminUser.id);
      setUserFeedback({ type: 'success', message: `Account for ${selectedAdminUser.firstName} ${selectedAdminUser.lastName} deactivated. All sessions revoked.` });
      setShowDeactivateModal(false);
      setSelectedAdminUser(null);
      await loadRealUsers();
    } catch (err: any) {
      setUserFeedback({ type: 'error', message: err.message || 'Failed to deactivate staff account.' });
    } finally {
      setSubmittingUserAction(false);
    }
  };

  const handleReactivateUser = async () => {
    if (!selectedAdminUser) return;
    try {
      setSubmittingUserAction(true);
      setUserFeedback(null);
      await api.reactivateSuperAdminUser(selectedAdminUser.id);
      setUserFeedback({ type: 'success', message: `Account for ${selectedAdminUser.firstName} ${selectedAdminUser.lastName} reactivated successfully.` });
      setShowReactivateModal(false);
      setSelectedAdminUser(null);
      await loadRealUsers();
    } catch (err: any) {
      setUserFeedback({ type: 'error', message: err.message || 'Failed to reactivate staff account.' });
    } finally {
      setSubmittingUserAction(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminUser) return;
    if (resetPasswordForm.password.length < 8) {
      setUserFeedback({ type: 'error', message: 'Password must be at least 8 characters long.' });
      return;
    }
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setUserFeedback({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    try {
      setSubmittingUserAction(true);
      setUserFeedback(null);
      await api.resetSuperAdminUserPassword(selectedAdminUser.id, resetPasswordForm.password);
      setUserFeedback({
        type: 'success',
        message: `Password reset successfully for ${selectedAdminUser.firstName} ${selectedAdminUser.lastName}. Active sessions revoked and lockout window cleared.`
      });
      setShowResetPasswordModal(false);
      setSelectedAdminUser(null);
      setResetPasswordForm({ password: '', confirmPassword: '' });
      await loadRealUsers();
    } catch (err: any) {
      setUserFeedback({ type: 'error', message: err.message || 'Failed to reset password.' });
    } finally {
      setSubmittingUserAction(false);
    }
  };

  // Phase 3: Super Admin Outlet Action Handlers
  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingOutletAction(true);
      setOutletFeedback(null);
      const payload: any = {
        name: createOutletForm.name.trim(),
        outletType: createOutletForm.outletType,
        invoiceSeriesPrefix: createOutletForm.invoiceSeriesPrefix.trim().toUpperCase(),
        operatingHours: {
          opens: createOutletForm.opens,
          closes: createOutletForm.closes
        }
      };
      if (createOutletForm.id.trim()) {
        payload.id = createOutletForm.id.trim().toLowerCase();
      }
      await api.createSuperAdminOutlet(payload);
      setOutletFeedback({
        type: 'success',
        message: `Outlet '${createOutletForm.name}' provisioned successfully with default settings & 3 kitchen stations.`
      });
      setShowCreateOutletModal(false);
      setCreateOutletForm({
        id: '',
        name: '',
        outletType: 'FINE_DINING',
        invoiceSeriesPrefix: '',
        opens: '07:00',
        closes: '23:00'
      });
      await loadRealOutlets();
    } catch (err: any) {
      setOutletFeedback({ type: 'error', message: err.message || 'Failed to create outlet.' });
    } finally {
      setSubmittingOutletAction(false);
    }
  };

  const openEditOutlet = (outlet: SuperAdminOutletItem) => {
    setSelectedAdminOutlet(outlet);
    setEditOutletForm({
      name: outlet.name,
      outletType: outlet.outletType,
      invoiceSeriesPrefix: outlet.invoiceSeriesPrefix,
      opens: outlet.operatingHours?.opens || '07:00',
      closes: outlet.operatingHours?.closes || '23:00'
    });
    setShowEditOutletModal(true);
  };

  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminOutlet) return;
    try {
      setSubmittingOutletAction(true);
      setOutletFeedback(null);
      await api.updateSuperAdminOutlet(selectedAdminOutlet.id, {
        name: editOutletForm.name.trim(),
        outletType: editOutletForm.outletType,
        invoiceSeriesPrefix: editOutletForm.invoiceSeriesPrefix.trim().toUpperCase(),
        operatingHours: {
          opens: editOutletForm.opens,
          closes: editOutletForm.closes
        }
      });
      setOutletFeedback({
        type: 'success',
        message: `Outlet '${selectedAdminOutlet.name}' updated successfully.`
      });
      setShowEditOutletModal(false);
      setSelectedAdminOutlet(null);
      await loadRealOutlets();
    } catch (err: any) {
      setOutletFeedback({ type: 'error', message: err.message || 'Failed to update outlet.' });
    } finally {
      setSubmittingOutletAction(false);
    }
  };

  const handleDeactivateOutlet = async () => {
    if (!selectedAdminOutlet) return;
    try {
      setSubmittingOutletAction(true);
      setOutletFeedback(null);
      await api.deactivateSuperAdminOutlet(selectedAdminOutlet.id);
      setOutletFeedback({
        type: 'success',
        message: `Outlet '${selectedAdminOutlet.name}' deactivated successfully. It can no longer accept new operational transactions.`
      });
      setShowDeactivateOutletModal(false);
      setSelectedAdminOutlet(null);
      await loadRealOutlets();
    } catch (err: any) {
      setOutletFeedback({ type: 'error', message: err.message || 'Failed to deactivate outlet.' });
    } finally {
      setSubmittingOutletAction(false);
    }
  };

  const handleReactivateOutlet = async () => {
    if (!selectedAdminOutlet) return;
    try {
      setSubmittingOutletAction(true);
      setOutletFeedback(null);
      await api.reactivateSuperAdminOutlet(selectedAdminOutlet.id);
      setOutletFeedback({
        type: 'success',
        message: `Outlet '${selectedAdminOutlet.name}' reactivated successfully.`
      });
      setShowReactivateOutletModal(false);
      setSelectedAdminOutlet(null);
      await loadRealOutlets();
    } catch (err: any) {
      setOutletFeedback({ type: 'error', message: err.message || 'Failed to reactivate outlet.' });
    } finally {
      setSubmittingOutletAction(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(true);
    setTimeout(() => setSaveMessage(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#DDD8C9] scrollbar-thin">
        {[
          { label: 'Staff Users', path: '/users', icon: Users },
          { label: 'Roles Architecture', path: '/roles', icon: ShieldCheck },
          { label: 'RBAC Permission Matrix', path: '/permissions', icon: KeyRound },
          { label: 'Module Access Control', path: '/settings/module-access', icon: ShieldCheck },
          { label: 'Security Audit Logs', path: '/audit-logs', icon: History },
          { label: 'Outlets & Multi-Restaurant', path: '/settings/outlets', icon: Store },
          { label: 'Enterprise Settings', path: '/settings', icon: Settings }
        ].map(tab => {
          const isActive = currentRoute === tab.path;
          const TabIcon = tab.icon;

          return (
            <button
              key={tab.path}
              onClick={() => pushRoute(tab.path)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'bg-white text-[#687067] hover:text-[#163024] hover:bg-[#F7F4EC] border border-[#DDD8C9]'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. USERS LIST (Section 20 & 21) */}
      {activeView === 'users' && (
        <div className="space-y-4">
          {/* Notification banner */}
          {userFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
                userFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {userFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{userFeedback.message}</span>
              </div>
              <button
                onClick={() => setUserFeedback(null)}
                className="text-gray-500 hover:text-gray-700 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
            <div>
              <h2 className="text-base font-bold text-[#163024]">Staff Accounts & Credentials</h2>
              <p className="text-xs text-[#687067]">
                Master staff governance: create, edit profile & role, deactivate (never hard delete), and reset passwords.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadRealUsers()}
                disabled={loadingUsers}
                className="px-3 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] text-xs font-bold rounded-xl border border-[#DDD8C9] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh user list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-3.5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#C5A86A]" />
                <span>Create User</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9]">
              <Search className="w-4 h-4 text-[#687067]" />
              <input
                type="text"
                placeholder="Search by name, email, employee code, or phone..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent outline-none text-[#1D241F] placeholder:text-[#687067]"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="RESTAURANT_OWNER">Restaurant Owner</option>
                <option value="WAITER">Waiter</option>
                <option value="KITCHEN_STAFF">Kitchen Staff</option>
                <option value="CASHIER">Cashier</option>
                <option value="RECEPTIONIST">Receptionist</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="true">Active Only</option>
                <option value="false">Deactivated Only</option>
              </select>
            </div>
          </div>

          {/* Section 24: Data Table */}
          <div className="bg-white rounded-2xl border border-[#DDD8C9] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">User Identity</th>
                    <th className="p-3.5">Role Assignment</th>
                    <th className="p-3.5">Primary Outlet</th>
                    <th className="p-3.5">Contact Details</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8C9]/40">
                  {loadingUsers && realUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#687067]">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#163024]" />
                          <span>Loading staff accounts...</span>
                        </div>
                      </td>
                    </tr>
                  ) : realUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#687067]">
                        No staff accounts found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    realUsers.map(user => {
                      const isSelf = user.id === currentUser?.id;
                      const isSuperAdmin = user.roles.some(r => r.id === 'SUPER_ADMIN');
                      const isLastSuperAdmin = isSuperAdmin && activeSuperAdminCount <= 1;

                      return (
                        <tr key={user.id} className="hover:bg-[#F7F4EC]/60 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#163024] text-[#C5A86A] flex items-center justify-center font-bold text-xs ring-1 ring-[#DDD8C9]">
                                {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
                              </div>
                              <div>
                                <p className="font-bold text-[#1D241F]">
                                  {user.firstName} {user.lastName}
                                  {isSelf && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#163024]/10 text-[#163024]">
                                      YOU
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-[#687067] font-mono">
                                  {user.employeeCode} • {user.id.slice(0, 8)}...
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map(r => (
                                <span
                                  key={r.id}
                                  className="px-2 py-0.5 rounded bg-[#163024]/10 text-[#163024] font-bold font-mono text-[11px] border border-[#DDD8C9]"
                                >
                                  {r.displayName || r.id}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 text-[#687067]">
                            <span className="font-semibold text-[#163024]">
                              {user.outlets?.[0]?.name || 'Pali Resort (Main Dining)'}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#687067] font-mono">
                            <p>{user.email}</p>
                            <p className="text-[10px] text-[#687067]">{user.phone}</p>
                          </td>
                          <td className="p-3.5">
                            {!user.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                                Deactivated
                              </span>
                            ) : user.isLocked ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                Locked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#526B4A]/10 text-[#526B4A] border border-[#526B4A]/30">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Profile & Role */}
                              <button
                                onClick={() => {
                                  setSelectedAdminUser(user);
                                  setEditForm({
                                    employeeCode: user.employeeCode,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    email: user.email,
                                    phone: user.phone,
                                    roleId: user.roles[0]?.id || 'WAITER',
                                    outletId: user.outlets[0]?.id || 'rest-1'
                                  });
                                  setShowEditUserModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-[#F7F4EC] hover:bg-[#DDD8C9] text-[#163024] transition-colors cursor-pointer"
                                title="Edit Profile & Role"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset Password */}
                              <button
                                onClick={() => {
                                  setSelectedAdminUser(user);
                                  setResetPasswordForm({ password: '', confirmPassword: '' });
                                  setShowResetPasswordModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-[#F7F4EC] hover:bg-[#DDD8C9] text-[#163024] transition-colors cursor-pointer"
                                title="Reset Password & Clear Lockout"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Deactivate / Reactivate */}
                              {user.isActive ? (
                                <button
                                  onClick={() => {
                                    setSelectedAdminUser(user);
                                    setShowDeactivateModal(true);
                                  }}
                                  disabled={isSelf || isLastSuperAdmin}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isSelf || isLastSuperAdmin
                                      ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                  }`}
                                  title={
                                    isSelf
                                      ? 'Cannot deactivate your own account'
                                      : isLastSuperAdmin
                                      ? 'Cannot deactivate the last active Super Administrator'
                                      : 'Deactivate Account & Revoke Sessions'
                                  }
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedAdminUser(user);
                                    setShowReactivateModal(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                                  title="Reactivate Account"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. ROLE MANAGEMENT (Section 22) */}
      {activeView === 'roles' && (
        <div className="space-y-6">
          <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
            <h2 className="text-base font-bold text-[#163024]">Role-Based Access Control Architecture</h2>
            <p className="text-xs text-[#687067]">
              Strictly separated functional profiles. Privilege escalation is mathematically blocked.
            </p>
          </div>

          {/* Section 22: Display 5 Core Roles */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#163024]">
              Primary Operational Profiles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coreRoles.map(item => {
                const RoleIcon = item.icon;
                return (
                  <div
                    key={item.role}
                    className="bg-white p-5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-3 hover:border-[#163024] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#163024] bg-[#163024]/10 px-2 py-0.5 rounded border border-[#DDD8C9]">
                        {item.role}
                      </span>
                      <RoleIcon className="w-4 h-4 text-[#526B4A]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#1D241F]">{item.name}</h4>
                      <p className="text-xs text-[#687067] mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-[11px] text-[#163024] font-medium">
                      <strong>Permission Scope:</strong> {item.scope}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Role Directory */}
          <div className="space-y-3 pt-4 border-t border-[#DDD8C9]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#163024]">
              All Configured Departmental Profiles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesMatrix.map(item => (
                <div
                  key={item.role}
                  className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#163024] bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#DDD8C9]">
                      {item.role}
                    </span>
                    <span className="text-[11px] text-[#687067] font-semibold">
                      {item.users} Active Users
                    </span>
                  </div>
                  <h4 className="font-bold text-[#1D241F] text-sm">{item.name}</h4>
                  <p className="text-xs text-[#687067] bg-[#F7F4EC] p-2.5 rounded-xl border border-[#DDD8C9]/70">
                    {item.access}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. PERMISSIONS MATRIX */}
      {activeView === 'permissions' && (
        <div className="bg-white rounded-2xl border border-[#DDD8C9] overflow-hidden shadow-xs space-y-4 p-5">
          <div>
            <h2 className="text-base font-bold text-[#163024]">
              Enterprise Route & Action Permission Matrix
            </h2>
            <p className="text-xs text-[#687067]">
              Granular evaluation across Route, Page, Component, Action, and Scoped Data levels.
            </p>
          </div>

          <div className="overflow-x-auto border border-[#DDD8C9] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Department / Module</th>
                  <th className="p-3 text-center">Super Admin</th>
                  <th className="p-3 text-center">Rest. Owner</th>
                  <th className="p-3 text-center">Waiter</th>
                  <th className="p-3 text-center">Kitchen</th>
                  <th className="p-3 text-center">Cashier</th>
                  <th className="p-3 text-center">Hotel Mgr</th>
                  <th className="p-3 text-center">Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8C9]/40 font-mono text-[11px]">
                {[
                  { name: 'Super Admin Operations', roles: ['SUPER_ADMIN'] },
                  { name: 'Restaurant & Dining', roles: ['SUPER_ADMIN', 'RESTAURANT_OWNER'] },
                  { name: 'Kitchen KDS Display', roles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'KITCHEN_STAFF'] },
                  { name: 'Waiter Service Calls', roles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'WAITER'] },
                  { name: 'Dining POS & Cashier', roles: ['SUPER_ADMIN', 'CASHIER'] },
                  { name: 'Hotel Rooms & Front Desk', roles: ['SUPER_ADMIN', 'RECEPTIONIST'] },
                  { name: 'Housekeeping Queue', roles: ['SUPER_ADMIN', 'HOUSEKEEPING'] },
                  { name: 'Inventory & Stock Reorders', roles: ['SUPER_ADMIN', 'CASHIER'] },
                  { name: 'Statutory GST & P&L', roles: ['SUPER_ADMIN'] },
                  { name: 'Guest Digital QR Menu', roles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'CUSTOMER', 'WAITER'] }
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#F7F4EC]/60 transition-colors">
                    <td className="p-3 font-sans font-bold text-[#1D241F]">{row.name}</td>
                    {['SUPER_ADMIN', 'RESTAURANT_OWNER', 'WAITER', 'KITCHEN_STAFF', 'CASHIER', 'RECEPTIONIST', 'CUSTOMER'].map(role => (
                      <td key={role} className="p-3 text-center">
                        {row.roles.includes(role) || role === 'SUPER_ADMIN' ? (
                          <span className="text-[#526B4A] font-bold">✓ ALLOW</span>
                        ) : (
                          <span className="text-[#DDD8C9] font-medium">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. AUDIT LOGS (Section 23) */}
      {activeView === 'audit-logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
            <div>
              <h2 className="text-base font-bold text-[#163024]">Current Browser Activity</h2>
              <p className="text-xs text-[#687067]">
                Session activity only. Persisted server security audit records are not loaded in this screen.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#526B4A] bg-[#526B4A]/10 px-3 py-1 rounded-full border border-[#DDD8C9]">
              {filteredAuditLogs.length} Session Events
            </span>
          </div>

          {/* Section 23: Readable Filters (Module, Role, Action, Search) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9]">
              <Search className="w-4 h-4 text-[#687067]" />
              <input
                type="text"
                placeholder="Search action or user..."
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent outline-none text-[#1D241F] placeholder:text-[#687067]"
              />
            </div>

            <div>
              <select
                value={auditModuleFilter}
                onChange={e => setAuditModuleFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Modules</option>
                <option value="Billing">Billing & POS</option>
                <option value="Kitchen">Kitchen & KDS</option>
                <option value="Tables">Tables & Dining</option>
                <option value="Security">Security & Auth</option>
                <option value="Hotel">Hotel Front Desk</option>
                <option value="Inventory">Inventory</option>
              </select>
            </div>

            <div>
              <select
                value={auditRoleFilter}
                onChange={e => setAuditRoleFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="RESTAURANT_OWNER">Restaurant Owner</option>
                <option value="CASHIER">Cashier</option>
                <option value="WAITER">Waiter</option>
                <option value="KITCHEN_STAFF">Kitchen Staff</option>
              </select>
            </div>

            <div>
              <select
                value={auditStatusFilter}
                onChange={e => setAuditStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Results</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="WARNING">WARNING</option>
                <option value="DENIED">FAILURE / DENIED</option>
              </select>
            </div>
          </div>

          {/* Section 23: Audit Table */}
          <div className="bg-white rounded-2xl border border-[#DDD8C9] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Operator</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Module</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Record / Details</th>
                    <th className="p-3.5">Result</th>
                    <th className="p-3.5 font-mono">Source IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8C9]/40">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-[#687067]">
                        No current browser activity matches these filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#F7F4EC]/60 transition-colors">
                        <td className="p-3.5 font-mono text-[#687067] whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3.5 font-bold text-[#1D241F]">{log.userName}</td>
                        <td className="p-3.5">
                          <span className="px-1.5 py-0.5 rounded bg-[#F7F4EC] text-[#163024] font-mono text-[10px] border border-[#DDD8C9]">
                            {log.userRole}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-[#526B4A]">{log.module || 'System'}</td>
                        <td className="p-3.5 font-bold text-[#163024]">{log.action}</td>
                        <td className="p-3.5 text-[#1D241F] max-w-sm leading-relaxed">{log.details}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase font-mono ${
                              log.status === 'SUCCESS'
                                ? 'bg-[#526B4A]/10 text-[#526B4A] border border-[#526B4A]/30'
                                : log.status === 'WARNING'
                                ? 'bg-[#C5A86A]/20 text-[#163024] border border-[#C5A86A]'
                                : 'bg-[#9C413D]/15 text-[#9C413D] border border-[#9C413D]/30'
                            }`}
                          >
                            {log.status || 'SUCCESS'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[#687067] text-[11px]">{log.ipAddress}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. RESTAURANT MANAGEMENT & SETTINGS (Section 17 & 18) */}
      {activeView === 'settings' && (
        <div className="space-y-6">
          {currentRoute === '/settings/module-access' ? (
            <ModuleAccessView />
          ) : currentRoute === '/settings/outlets' ? (
            /* Section 17: Super Admin Live Outlets Management */
            <div className="space-y-4">
              {/* Outlet action feedback banner */}
              {outletFeedback && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
                    outletFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {outletFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{outletFeedback.message}</span>
                  </div>
                  <button
                    onClick={() => setOutletFeedback(null)}
                    className="text-gray-500 hover:text-gray-700 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD8C9] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#163024]">Resort Restaurant Outlets & Governance</h2>
                    <p className="text-xs text-[#687067]">
                      Provision dining venues, enforce active session deactivation guards, and manage multi-tenant isolation.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadRealOutlets()}
                      disabled={loadingOutlets}
                      className="p-2 border border-[#DDD8C9] hover:bg-[#F7F4EC] text-[#163024] rounded-xl transition-colors cursor-pointer"
                      title="Refresh Outlets"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingOutlets ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setShowCreateOutletModal(true)}
                      className="px-3.5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#C5A86A]" />
                      <span>Provision New Outlet</span>
                    </button>
                  </div>
                </div>

                {/* Filters toolbar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#687067]" />
                    <input
                      type="text"
                      placeholder="Search outlets by name, ID, or invoice series prefix..."
                      value={outletSearchQuery}
                      onChange={e => setOutletSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs text-[#1D241F] outline-none focus:border-[#163024]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#687067]">Status:</span>
                    <select
                      value={outletStatusFilter}
                      onChange={e => setOutletStatusFilter(e.target.value as any)}
                      className="px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024] outline-none focus:border-[#163024] cursor-pointer"
                    >
                      <option value="all">All Outlets</option>
                      <option value="true">Active Only</option>
                      <option value="false">Deactivated Only</option>
                    </select>
                  </div>
                </div>

                {/* Outlets Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {realOutlets.length === 0 && !loadingOutlets ? (
                    <div className="col-span-2 p-8 text-center text-xs text-[#687067] bg-[#F7F4EC] rounded-2xl border border-[#DDD8C9]">
                      No restaurant outlets found matching the selected filter.
                    </div>
                  ) : (
                    realOutlets.map(rest => {
                      const isCurrentActive = rest.id === activeRestaurantId;
                      const hasActiveSessions = (rest.activeSessionsCount || 0) > 0;

                      return (
                        <div
                          key={rest.id}
                          className={`p-5 rounded-2xl border transition-all space-y-4 ${
                            !rest.isActive
                              ? 'bg-rose-50/20 border-rose-200 opacity-90'
                              : isCurrentActive
                              ? 'bg-white border-[#163024] ring-2 ring-[#C5A86A]/40 shadow-sm'
                              : 'bg-white border-[#DDD8C9] hover:border-[#163024]/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-[#163024] text-base font-serif">{rest.name}</h3>
                                {isCurrentActive && rest.isActive && (
                                  <span className="px-2 py-0.5 bg-[#163024] text-[#F7F4EC] rounded text-[10px] font-bold uppercase">
                                    Active Context
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#687067] mt-0.5">
                                ID: <span className="font-mono font-bold text-[#163024]">{rest.id}</span> • Series Prefix:{' '}
                                <span className="font-mono font-bold text-[#163024]">{rest.invoiceSeriesPrefix}</span>
                              </p>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                rest.isActive
                                  ? 'bg-[#526B4A]/10 text-[#526B4A] border border-[#526B4A]/30'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {rest.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </div>

                          {/* Operational Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] text-xs">
                            <div>
                              <span className="text-[10px] text-[#687067] uppercase font-semibold block">Floor Tables</span>
                              <span className="font-bold font-mono text-[#163024]">{rest.tablesCount} Tables</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#687067] uppercase font-semibold block">KDS Stations</span>
                              <span className="font-bold font-mono text-[#163024]">{rest.stationsCount} Stations</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#687067] uppercase font-semibold block">Open Sessions</span>
                              <span className={`font-bold font-mono ${hasActiveSessions ? 'text-amber-700' : 'text-[#163024]'}`}>
                                {rest.activeSessionsCount} Active
                              </span>
                            </div>
                          </div>

                          {/* Active session safety note */}
                          {hasActiveSessions && (
                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                {rest.activeSessionsCount} open dining session(s). Outlet deactivation is strictly blocked until all sessions are closed.
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-[#687067]">
                            <span>Type: <strong className="text-[#163024]">{rest.outletType.replace('_', ' ')}</strong></span>
                            <span>Hours: <strong className="font-mono text-[#163024]">{rest.operatingHours?.opens || '07:00'} - {rest.operatingHours?.closes || '23:00'}</strong></span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#DDD8C9]">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditOutlet(rest)}
                                className="px-3 py-1.5 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {rest.isActive ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAdminOutlet(rest);
                                    setShowDeactivateOutletModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAdminOutlet(rest);
                                    setShowReactivateOutletModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Reactivate</span>
                                </button>
                              )}
                            </div>

                            {rest.isActive && !isCurrentActive ? (
                              <button
                                onClick={() => switchRestaurant(rest.id)}
                                className="px-3 py-1.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                              >
                                Switch Context
                              </button>
                            ) : rest.isActive && isCurrentActive ? (
                              <span className="text-xs font-semibold text-[#526B4A] flex items-center gap-1">
                                <Check className="w-4 h-4 text-[#526B4A]" /> Context Active
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-rose-600 italic">
                                Deactivated
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* System & Property Parameters Form */
            <div className="bg-white p-6 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-6 max-w-3xl">
              <div className="border-b border-[#DDD8C9] pb-4">
                <h3 className="font-bold text-[#163024] text-lg">Property & Legal Configuration</h3>
                <p className="text-xs text-[#687067] mt-0.5">
                  Corporate business profile, statutory tax parameters, and automated operational triggers.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">
                    Resort Legal Trade Name
                  </label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={e => setPropertyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#163024] mb-1">GSTIN Tax Registration</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={e => setGstin(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold text-[#1D241F] outline-none focus:border-[#163024]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#163024] mb-1">Base Currency</label>
                    <input
                      type="text"
                      value={currency}
                      readOnly
                      className="w-full px-3.5 py-2.5 bg-[#F7F4EC]/60 border border-[#DDD8C9] rounded-xl font-mono text-[#687067]"
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-2">
                  <span className="font-bold text-[#163024]">Operational Automated Directives:</span>
                  <div className="space-y-2 text-[#1D241F]">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded accent-[#163024]" />
                      <span>Auto-dispatch KOT tickets to Kitchen KDS upon order punching</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded accent-[#163024]" />
                      <span>Send SMS & WhatsApp booking confirmation upon room reservation</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded accent-[#163024]" />
                      <span>Dispatch dirty room turnaround state to housekeeping upon guest check-out</span>
                    </label>
                  </div>
                </div>

                {saveMessage && (
                  <div className="p-3 bg-[#526B4A]/10 border border-[#526B4A]/30 rounded-xl text-[#163024] font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#526B4A]" />
                    <span>Configuration changes saved successfully!</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => pushRoute('/settings/outlets')}
                    className="text-xs font-bold text-[#526B4A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Store className="w-4 h-4" />
                    <span>Manage Dining Outlets & Multi-Restaurant →</span>
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] font-bold rounded-xl shadow-xs text-xs cursor-pointer"
                  >
                    Save System Configuration
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Create Staff Account Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#163024]">Provision New Staff Account</h3>
                <p className="text-[11px] text-[#687067]">
                  Create staff identity, assign operational role, and set initial credentials.
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1 rounded-lg text-[#687067] hover:text-[#163024] hover:bg-[#DDD8C9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSuperAdminUser} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-101"
                    value={createForm.employeeCode}
                    onChange={e => setCreateForm({ ...createForm, employeeCode: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98200 12345"
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh"
                    value={createForm.firstName}
                    onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pawar"
                    value={createForm.lastName}
                    onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh.pawar@paliclub.com"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Assigned Role</label>
                  <select
                    value={createForm.roleId}
                    onChange={e => setCreateForm({ ...createForm, roleId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none focus:border-[#163024] cursor-pointer"
                  >
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    <option value="RESTAURANT_OWNER">RESTAURANT OWNER</option>
                    <option value="WAITER">WAITER</option>
                    <option value="KITCHEN_STAFF">KITCHEN</option>
                    <option value="CASHIER">CASHIER</option>
                    <option value="RECEPTIONIST">RECEPTIONIST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163024] mb-1">Primary Restaurant</label>
                  <select
                    value={createForm.outletId}
                    onChange={e => setCreateForm({ ...createForm, outletId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none focus:border-[#163024] cursor-pointer"
                  >
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Initial Password (min 8 characters) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                />
                <p className="text-[10px] text-[#687067] mt-1">
                  Passwords are authenticated using cryptographic scrypt hashes. Never logged in plaintext.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUserAction}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingUserAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enroll Staff Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Account Modal */}
      {showEditUserModal && selectedAdminUser && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#163024]">
                  Edit Staff Profile: {selectedAdminUser.firstName} {selectedAdminUser.lastName}
                </h3>
                <p className="text-[11px] text-[#687067]">
                  Code: {selectedAdminUser.employeeCode} • ID: {selectedAdminUser.id.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setSelectedAdminUser(null);
                }}
                className="p-1 rounded-lg text-[#687067] hover:text-[#163024] hover:bg-[#DDD8C9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSuperAdminUser} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Assigned Role</label>
                  <select
                    value={editForm.roleId}
                    onChange={e => setEditForm({ ...editForm, roleId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none focus:border-[#163024] cursor-pointer"
                  >
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    <option value="RESTAURANT_OWNER">RESTAURANT OWNER</option>
                    <option value="WAITER">WAITER</option>
                    <option value="KITCHEN_STAFF">KITCHEN</option>
                    <option value="CASHIER">CASHIER</option>
                    <option value="RECEPTIONIST">RECEPTIONIST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163024] mb-1">Primary Restaurant</label>
                  <select
                    value={editForm.outletId}
                    onChange={e => setEditForm({ ...editForm, outletId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none focus:border-[#163024] cursor-pointer"
                  >
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setSelectedAdminUser(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUserAction}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingUserAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedAdminUser && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#163024]">
                  Reset Password: {selectedAdminUser.firstName} {selectedAdminUser.lastName}
                </h3>
                <p className="text-[11px] text-[#687067]">
                  Code: {selectedAdminUser.employeeCode}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedAdminUser(null);
                }}
                className="p-1 rounded-lg text-[#687067] hover:text-[#163024] hover:bg-[#DDD8C9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Security Governance Note
                </span>
                <p className="text-[11px] leading-relaxed">
                  Resetting this user's password will immediately clear failed-attempt lockouts and revoke all active sessions across all devices.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">New Password (min 8 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={resetPasswordForm.password}
                  onChange={e => setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={resetPasswordForm.confirmPassword}
                  onChange={e => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setSelectedAdminUser(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUserAction}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingUserAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Reset Password & Clear Lockout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate User Confirmation Modal */}
      {showDeactivateModal && selectedAdminUser && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-rose-900">Deactivate Staff Account</h3>
              </div>
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setSelectedAdminUser(null);
                }}
                className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#1D241F] leading-relaxed">
                Are you sure you want to deactivate{' '}
                <strong className="text-[#163024]">
                  {selectedAdminUser.firstName} {selectedAdminUser.lastName} ({selectedAdminUser.employeeCode})
                </strong>
                ?
              </p>

              <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1.5 text-[11px] text-[#687067]">
                <p>• The user will immediately be blocked from logging into the platform.</p>
                <p>• All active sessions across mobile, POS, and browser will be revoked immediately.</p>
                <p>• Staff accounts are <strong>never permanently deleted</strong> and can be reactivated at any time.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setSelectedAdminUser(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingUserAction}
                  onClick={handleDeactivateUser}
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingUserAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Deactivate & Revoke Sessions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate User Confirmation Modal */}
      {showReactivateModal && selectedAdminUser && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-emerald-900">Reactivate Staff Account</h3>
              </div>
              <button
                onClick={() => {
                  setShowReactivateModal(false);
                  setSelectedAdminUser(null);
                }}
                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#1D241F] leading-relaxed">
                Reactivate{' '}
                <strong className="text-[#163024]">
                  {selectedAdminUser.firstName} {selectedAdminUser.lastName} ({selectedAdminUser.employeeCode})
                </strong>
                ? The staff member will be permitted to authenticate and access their assigned roles once again.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowReactivateModal(false);
                    setSelectedAdminUser(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingUserAction}
                  onClick={handleReactivateUser}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingUserAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Reactivate Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Create Outlet Modal */}
      {showCreateOutletModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#163024]">Provision New Resort Outlet</h3>
                <p className="text-[11px] text-[#687067]">Automated provisioning of default tax rules & kitchen stations</p>
              </div>
              <button
                onClick={() => setShowCreateOutletModal(false)}
                className="p-1 rounded-lg text-[#687067] hover:text-[#163024] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#163024] mb-1">Outlet Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Palm Deck & Poolside Bar"
                  value={createOutletForm.name}
                  onChange={e => setCreateOutletForm({ ...createOutletForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Custom Outlet ID (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. rest-palm-deck"
                    value={createOutletForm.id}
                    onChange={e => setCreateOutletForm({ ...createOutletForm, id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Invoice Prefix *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. PDB-"
                    value={createOutletForm.invoiceSeriesPrefix}
                    onChange={e => setCreateOutletForm({ ...createOutletForm, invoiceSeriesPrefix: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Venue Type</label>
                  <select
                    value={createOutletForm.outletType}
                    onChange={e => setCreateOutletForm({ ...createOutletForm, outletType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none focus:border-[#163024] cursor-pointer"
                  >
                    <option value="FINE_DINING">Fine Dining</option>
                    <option value="FINE_DINING_BAR_LOUNGE">Fine Dining &amp; Lounge Bar</option>
                    <option value="BAR_LOUNGE">Lounge Bar</option>
                    <option value="POOL_DECK">Pool Deck & Cabana</option>
                    <option value="ROOM_SERVICE">Room Service</option>
                    <option value="BANQUET">Banquet & Events</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-[#163024] mb-1">Opens</label>
                    <input
                      type="text"
                      placeholder="07:00"
                      value={createOutletForm.opens}
                      onChange={e => setCreateOutletForm({ ...createOutletForm, opens: e.target.value })}
                      className="w-full px-2.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono text-center text-[#1D241F] outline-none focus:border-[#163024]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#163024] mb-1">Closes</label>
                    <input
                      type="text"
                      placeholder="23:00"
                      value={createOutletForm.closes}
                      onChange={e => setCreateOutletForm({ ...createOutletForm, closes: e.target.value })}
                      className="w-full px-2.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono text-center text-[#1D241F] outline-none focus:border-[#163024]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Automated Provisioning Package
                </span>
                <p>• Standard statutory GST tax rules (5.00% split 2.5% CGST / 2.5% SGST) created automatically.</p>
                <p>• Three baseline KDS preparation stations (Main Kitchen, Bar Counter, Pantry) seeded.</p>
                <p>• Strict multi-tenant data isolation and invoice series uniqueness guaranteed.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowCreateOutletModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutletAction}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingOutletAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Provision Outlet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Outlet Modal */}
      {showEditOutletModal && selectedAdminOutlet && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#163024]">Edit Outlet: {selectedAdminOutlet.name}</h3>
                <p className="text-[11px] text-[#687067]">ID: {selectedAdminOutlet.id}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditOutletModal(false);
                  setSelectedAdminOutlet(null);
                }}
                className="p-1 rounded-lg text-[#687067] hover:text-[#163024] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#163024] mb-1">Outlet Display Name *</label>
                <input
                  type="text"
                  required
                  value={editOutletForm.name}
                  onChange={e => setEditOutletForm({ ...editOutletForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#1D241F] outline-none focus:border-[#163024]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Venue Type</label>
                  <select
                    value={editOutletForm.outletType}
                    onChange={e => setEditOutletForm({ ...editOutletForm, outletType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold outline-none focus:border-[#163024] cursor-pointer"
                  >
                    <option value="FINE_DINING">Fine Dining</option>
                    <option value="FINE_DINING_BAR_LOUNGE">Fine Dining &amp; Lounge Bar</option>
                    <option value="BAR_LOUNGE">Lounge Bar</option>
                    <option value="POOL_DECK">Pool Deck & Cabana</option>
                    <option value="ROOM_SERVICE">Room Service</option>
                    <option value="BANQUET">Banquet & Events</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163024] mb-1">Invoice Prefix *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={editOutletForm.invoiceSeriesPrefix}
                    onChange={e => setEditOutletForm({ ...editOutletForm, invoiceSeriesPrefix: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Opening Time</label>
                  <input
                    type="text"
                    value={editOutletForm.opens}
                    onChange={e => setEditOutletForm({ ...editOutletForm, opens: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono text-center text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Closing Time</label>
                  <input
                    type="text"
                    value={editOutletForm.closes}
                    onChange={e => setEditOutletForm({ ...editOutletForm, closes: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono text-center text-[#1D241F] outline-none focus:border-[#163024]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditOutletModal(false);
                    setSelectedAdminOutlet(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutletAction}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingOutletAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Deactivate Outlet Modal */}
      {showDeactivateOutletModal && selectedAdminOutlet && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-rose-900">Deactivate Resort Outlet</h3>
              </div>
              <button
                onClick={() => {
                  setShowDeactivateOutletModal(false);
                  setSelectedAdminOutlet(null);
                }}
                className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#1D241F] leading-relaxed">
                Are you sure you want to deactivate{' '}
                <strong className="text-[#163024]">{selectedAdminOutlet.name}</strong> ({selectedAdminOutlet.id})?
              </p>

              {(selectedAdminOutlet.activeSessionsCount || 0) > 0 ? (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                    DEACTIVATION STRICTLY BLOCKED
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    This outlet currently has <strong>{selectedAdminOutlet.activeSessionsCount} active dining session(s)</strong> open on the floor.
                    All customer dining sessions must be settled, paid, and closed before this outlet can be deactivated.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1.5 text-[11px] text-[#687067]">
                  <p>• The outlet will be marked inactive (never hard deleted).</p>
                  <p>• Inactive outlets cannot receive new dining sessions, orders, or table operations.</p>
                  <p>• Historical invoices, orders, and reports are permanently preserved.</p>
                  <p>• The outlet can be reactivated at any time.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeactivateOutletModal(false);
                    setSelectedAdminOutlet(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingOutletAction || (selectedAdminOutlet.activeSessionsCount || 0) > 0}
                  onClick={handleDeactivateOutlet}
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingOutletAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Deactivation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reactivate Outlet Modal */}
      {showReactivateOutletModal && selectedAdminOutlet && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-emerald-900">Reactivate Resort Outlet</h3>
              </div>
              <button
                onClick={() => {
                  setShowReactivateOutletModal(false);
                  setSelectedAdminOutlet(null);
                }}
                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#1D241F] leading-relaxed">
                Reactivate <strong className="text-[#163024]">{selectedAdminOutlet.name}</strong> ({selectedAdminOutlet.id})?
                The outlet will immediately be restored to active operational status and will appear in outlet switchers for authorized staff.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowReactivateOutletModal(false);
                    setSelectedAdminOutlet(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] text-[#163024] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingOutletAction}
                  onClick={handleReactivateOutlet}
                  className="px-5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingOutletAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Reactivate Outlet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

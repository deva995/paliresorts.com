import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  ShieldCheck,
  ShieldAlert,
  User,
  Users,
  UtensilsCrossed,
  ChefHat,
  Store,
  CreditCard,
  Package,
  Hotel,
  Sparkles,
  FileBarChart,
  HeartHandshake,
  Settings,
  ClipboardList,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  Info,
  Check,
  X
} from 'lucide-react';

interface ModuleCardState {
  id: string;
  name: string;
  description: string;
  roleBaseline: { canView: boolean; canEdit: boolean };
  override: { canView: boolean; canEdit: boolean } | null;
  effective: { canView: boolean; canEdit: boolean };
  // Local state for editing
  currentView: boolean;
  currentEdit: boolean;
}

interface StaffUserOption {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  menu: UtensilsCrossed,
  orders: ClipboardList,
  kitchen: ChefHat,
  floor: Store,
  billing: CreditCard,
  inventory: Package,
  hotel: Hotel,
  housekeeping: Sparkles,
  staff: Users,
  reports: FileBarChart,
  crm: HeartHandshake,
  settings: Settings
};

export const ModuleAccessView: React.FC = () => {
  const { restaurants, activeRestaurantId, currentUser } = useApp();

  const [staffUsers, setStaffUsers] = useState<StaffUserOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedOutletId, setSelectedOutletId] = useState<string>(''); // empty string = GLOBAL
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modules, setModules] = useState<ModuleCardState[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch staff roster on mount
  useEffect(() => {
    let isMounted = true;
    const loadStaff = async () => {
      setIsLoadingStaff(true);
      try {
        const res = await api.listStaff();
        if (isMounted && res && Array.isArray(res.items)) {
          const mapped = res.items.map((s) => ({
            id: s.id,
            employeeCode: s.employeeCode,
            name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.employeeCode,
            email: s.email || '',
            role: s.roles?.[0]?.displayName || s.roles?.[0]?.id || 'Staff',
            isActive: s.isActive
          }));
          setStaffUsers(mapped);
          if (mapped.length > 0 && !selectedStaffId) {
            setSelectedStaffId(mapped[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setStatusMessage({
            type: 'error',
            text: err.detail || err.message || 'Failed to load staff list'
          });
        }
      } finally {
        if (isMounted) setIsLoadingStaff(false);
      }
    };
    loadStaff();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch module access matrix whenever selected staff or outlet changes
  useEffect(() => {
    if (!selectedStaffId) return;

    let isMounted = true;
    const fetchMatrix = async () => {
      setIsLoadingAccess(true);
      setStatusMessage(null);
      try {
        const res = await api.getStaffModuleAccess(
          selectedStaffId,
          selectedOutletId || undefined
        );
        if (isMounted && res && Array.isArray(res.modules)) {
          const mapped = res.modules.map((m) => {
            const hasOverride = m.override !== null;
            return {
              id: m.id,
              name: m.name,
              description: m.description,
              roleBaseline: m.roleBaseline,
              override: m.override,
              effective: m.effective,
              currentView: hasOverride ? m.override!.canView : m.roleBaseline.canView,
              currentEdit: hasOverride ? m.override!.canEdit : m.roleBaseline.canEdit
            };
          });
          setModules(mapped);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatusMessage({
            type: 'error',
            text: err.detail || err.message || 'Failed to load module access'
          });
        }
      } finally {
        if (isMounted) setIsLoadingAccess(false);
      }
    };
    fetchMatrix();
    return () => {
      isMounted = false;
    };
  }, [selectedStaffId, selectedOutletId]);

  // Selected staff object
  const activeStaff = useMemo(() => {
    return staffUsers.find((s) => s.id === selectedStaffId);
  }, [staffUsers, selectedStaffId]);

  // Filtered staff list for search
  const filteredStaffUsers = useMemo(() => {
    if (!userSearch) return staffUsers;
    const q = userSearch.toLowerCase();
    return staffUsers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.employeeCode.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
    );
  }, [staffUsers, userSearch]);

  // Compute dirty count (changes differing from role baseline or server state)
  const unsavedCount = useMemo(() => {
    return modules.filter((m) => {
      const serverView = m.override !== null ? m.override.canView : m.roleBaseline.canView;
      const serverEdit = m.override !== null ? m.override.canEdit : m.roleBaseline.canEdit;
      return m.currentView !== serverView || m.currentEdit !== serverEdit;
    }).length;
  }, [modules]);

  // Toggle view
  const handleToggleView = (id: string) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextView = !m.currentView;
        // If view is turned off, edit must also be turned off
        const nextEdit = nextView ? m.currentEdit : false;
        return { ...m, currentView: nextView, currentEdit: nextEdit };
      })
    );
  };

  // Toggle edit
  const handleToggleEdit = (id: string) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextEdit = !m.currentEdit;
        // If edit is turned on, view must also be turned on
        const nextView = nextEdit ? true : m.currentView;
        return { ...m, currentView: nextView, currentEdit: nextEdit };
      })
    );
  };

  // Reset a single module to role baseline
  const handleResetModule = (id: string) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          currentView: m.roleBaseline.canView,
          currentEdit: m.roleBaseline.canEdit
        };
      })
    );
  };

  // Bulk: Reset all to role baseline
  const handleResetAllToBaseline = () => {
    setModules((prev) =>
      prev.map((m) => selectedOutletId && m.id === 'inventory' ? m : ({
        ...m,
        currentView: m.roleBaseline.canView,
        currentEdit: m.roleBaseline.canEdit
      }))
    );
  };

  // Bulk: Grant all
  const handleGrantAll = () => {
    setModules((prev) =>
      prev.map((m) => selectedOutletId && m.id === 'inventory' ? m : ({
        ...m,
        currentView: true,
        currentEdit: true
      }))
    );
  };

  // Bulk: Revoke all
  const handleRevokeAll = () => {
    setModules((prev) =>
      prev.map((m) => selectedOutletId && m.id === 'inventory' ? m : ({
        ...m,
        currentView: false,
        currentEdit: false
      }))
    );
  };

  // Save changes to backend API
  const handleSave = async () => {
    if (!selectedStaffId) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const payload = {
        outletId: selectedOutletId || null,
        modules: modules.filter(m => !selectedOutletId || m.id !== 'inventory').map((m) => ({
          module: m.id,
          canView: m.currentView,
          canEdit: m.currentEdit
        }))
      };

      const res = await api.updateStaffModuleAccess(selectedStaffId, payload);
      setStatusMessage({
        type: 'success',
        text: res.message || 'Module access overrides saved successfully with audit log entry.'
      });

      // Refresh server matrix
      const refreshed = await api.getStaffModuleAccess(
        selectedStaffId,
        selectedOutletId || undefined
      );
      if (refreshed && Array.isArray(refreshed.modules)) {
        setModules(
          refreshed.modules.map((m) => {
            const hasOverride = m.override !== null;
            return {
              id: m.id,
              name: m.name,
              description: m.description,
              roleBaseline: m.roleBaseline,
              override: m.override,
              effective: m.effective,
              currentView: hasOverride ? m.override!.canView : m.roleBaseline.canView,
              currentEdit: hasOverride ? m.override!.canEdit : m.roleBaseline.canEdit
            };
          })
        );
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.detail || err.message || 'Failed to save module access'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#163024] text-[#C5A86A]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#163024]">Module Access Control</h1>
          </div>
          <p className="text-xs text-[#687067] mt-1 max-w-2xl">
            Configure fine-grained per-user module visibility and action permissions. Overrides layer dynamically over role baseline permissions and are strictly enforced across server endpoints and sidebar navigation.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetAllToBaseline}
            disabled={isSaving || isLoadingAccess}
            className="px-3.5 py-2 bg-[#F7F4EC] hover:bg-[#EFEAD9] text-[#163024] text-xs font-semibold rounded-xl border border-[#DDD8C9] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Reset all toggles to match user's role permissions"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#687067]" />
            <span>Role Baseline</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || isLoadingAccess}
            className={`px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
              unsavedCount > 0 ? 'ring-2 ring-[#C5A86A] ring-offset-2 animate-pulse' : ''
            } disabled:opacity-50`}
          >
            <Save className="w-4 h-4 text-[#C5A86A]" />
            <span>{isSaving ? 'Saving Changes...' : unsavedCount > 0 ? `Save Overrides (${unsavedCount} Changed)` : 'Save Module Access'}</span>
          </button>
        </div>
      </div>

      {/* User & Outlet Selector Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* User Picker */}
        <div className="md:col-span-6 space-y-1.5">
          <label className="text-xs font-bold text-[#163024] flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Target Staff Member:</span>
          </label>
          <div className="relative">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              disabled={isLoadingStaff}
              className="w-full bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl px-3 py-2 text-xs font-semibold text-[#163024] focus:outline-hidden focus:ring-2 focus:ring-[#163024] cursor-pointer appearance-none pr-8"
            >
              {filteredStaffUsers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.employeeCode} • {s.name} ({s.role}) {!s.isActive ? '[Inactive]' : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#687067]">
              <Search className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Outlet Scope Selector */}
        <div className="md:col-span-6 space-y-1.5">
          <label className="text-xs font-bold text-[#163024] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Outlet Scope:</span>
          </label>
          <select
            value={selectedOutletId}
            aria-label="Outlet scope"
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="w-full bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl px-3 py-2 text-xs font-semibold text-[#163024] focus:outline-hidden focus:ring-2 focus:ring-[#163024] cursor-pointer"
          >
            <option value="">Universal / Global (Applies Across All Outlets)</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Profile Overview Card */}
      {activeStaff && (
        <div className="bg-[#F7F4EC] p-4 rounded-2xl border border-[#DDD8C9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#163024] text-[#F7F4EC] font-bold flex items-center justify-center text-sm shadow-xs border border-[#C5A86A]/40">
              {activeStaff.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#163024]">{activeStaff.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#163024]/10 text-[#163024] border border-[#163024]/20">
                  {activeStaff.role}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DDD8C9]/50 text-[#687067]">
                  {activeStaff.employeeCode}
                </span>
              </div>
              <p className="text-xs text-[#687067] mt-0.5">{activeStaff.email || 'No email registered'}</p>
            </div>
          </div>

          {/* Quick Stats & Bulk Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleGrantAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
            >
              Grant All
            </button>
            <button
              onClick={handleRevokeAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
            >
              Revoke All
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="ml-auto text-current opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modules Grid */}
      {isLoadingAccess ? (
        <div className="bg-white p-12 rounded-2xl border border-[#DDD8C9] text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#163024] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#687067] font-semibold">Loading module permissions for staff member...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => {
            const ModIcon = MODULE_ICONS[mod.id] || ShieldCheck;
            const scopedInventoryUnavailable = Boolean(selectedOutletId) && mod.id === 'inventory';
            const isOverridden =
              mod.currentView !== mod.roleBaseline.canView || mod.currentEdit !== mod.roleBaseline.canEdit;

            return (
              <div
                key={mod.id}
                className={`bg-white rounded-2xl border transition-all p-4.5 flex flex-col justify-between shadow-xs ${
                  isOverridden
                    ? 'border-[#C5A86A] ring-1 ring-[#C5A86A]/40'
                    : 'border-[#DDD8C9] hover:border-[#163024]/40'
                }`}
              >
                <div>
                  {/* Module Header */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9]">
                        <ModIcon className="w-4 h-4 text-[#163024]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#163024] leading-tight">{mod.name}</h3>
                        <span className="text-[10px] font-mono uppercase text-[#687067] tracking-wider">
                          ID: {mod.id}
                        </span>
                      </div>
                    </div>

                    {/* Override Badge */}
                    {isOverridden ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C5A86A]/20 text-[#8C6F2D] border border-[#C5A86A]/40 whitespace-nowrap">
                        Override Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#DDD8C9]/40 text-[#687067] whitespace-nowrap">
                        Role Baseline
                      </span>
                    )}
                  </div>

                  {/* Module Description */}
                  <p className="text-xs text-[#687067] mb-4 line-clamp-2 leading-relaxed">
                    {mod.description}
                  </p>
                  {scopedInventoryUnavailable && (
                    <p className="text-xs text-amber-800 mb-3">Outlet-specific Inventory access is unavailable. Select Global to manage Inventory access.</p>
                  )}

                  {/* Role Baseline Hint */}
                  <div className="bg-[#F7F4EC] rounded-xl p-2.5 border border-[#DDD8C9]/60 text-[11px] space-y-1 mb-4">
                    <div className="flex items-center justify-between text-[#687067]">
                      <span>Role Baseline View:</span>
                      <span className={`font-semibold ${mod.roleBaseline.canView ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {mod.roleBaseline.canView ? 'Allowed by Role' : 'Restricted'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#687067]">
                      <span>Role Baseline Edit:</span>
                      <span className={`font-semibold ${mod.roleBaseline.canEdit ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {mod.roleBaseline.canEdit ? 'Allowed by Role' : 'Restricted'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggles Footer */}
                <div className="pt-3 border-t border-[#DDD8C9]/60 space-y-2.5">
                  {/* View Access Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#163024]">View Access</span>
                      <p className="text-[10px] text-[#687067]">Sidebar menu & read queries</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleView(mod.id)}
                      disabled={scopedInventoryUnavailable}
                      aria-label={`${mod.name} view access`}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        mod.currentView ? 'bg-[#163024]' : 'bg-[#DDD8C9]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          mod.currentView ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Edit Access Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#163024]">Edit Access</span>
                      <p className="text-[10px] text-[#687067]">Mutations, creation & approvals</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleEdit(mod.id)}
                      disabled={scopedInventoryUnavailable}
                      aria-label={`${mod.name} edit access`}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        mod.currentEdit ? 'bg-[#C5A86A]' : 'bg-[#DDD8C9]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          mod.currentEdit ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Individual Reset */}
                  {isOverridden && !scopedInventoryUnavailable && (
                    <div className="pt-2 text-right">
                      <button
                        onClick={() => handleResetModule(mod.id)}
                        className="text-[10px] font-semibold text-[#8C6F2D] hover:underline cursor-pointer"
                      >
                        Reset to Role Baseline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

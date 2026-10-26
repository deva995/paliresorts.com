import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { DesignationsView } from './DesignationsView';
import { EmployeeEditForm } from './EmployeeEditForm';
import { EmployeeDataTable } from './EmployeeDataTable';
import './StaffMaster.css';
import { UserRole } from '../../types';
import {
  Users,
  Plus,
  Search,
  Lock,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';

export const StaffView: React.FC = () => {
  const { employees, currentUser, refreshStaffData, activeRestaurantId, currentRoute } = useApp();


  // Request /staff only for allowed roles (SUPER_ADMIN, RESTAURANT_OWNER, WAITER_MANAGER, WAITER)
  // Ensure other roles skip it without error
  React.useEffect(() => {
    const allowedStaffRoles: UserRole[] = ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'SENIOR_CAPTAIN', 'WAITER_MANAGER', 'WAITER'];
    if (currentUser?.role && allowedStaffRoles.includes(currentUser.role)) {
      refreshStaffData();
    }
  }, [currentUser?.role, refreshStaffData]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [employeeCode, setEmployeeCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<string>('WAITER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');


  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);



  const [editingEmployee, setEditingEmployee] =
    useState<(typeof employees)[number] | null>(null);
  const [editError, setEditError] = useState('');
  const [designationOptions, setDesignationOptions] = useState<
    Array<{ id: string; name: string; isActive: boolean }>
  >([]);
  const [designationsReady, setDesignationsReady] = useState(false);
  const [newDesignationId, setNewDesignationId] = useState('');

  const [selectedEmployee, setSelectedEmployee] =
    useState<(typeof employees)[number] | null>(null);


  const [databaseRoles, setDatabaseRoles] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState('');

  // Roles available for creation based on authenticated user's permissions
  // Only SUPER_ADMIN may create SUPER_ADMIN accounts
  const allRoles: Array<{ id: string; label: string; superAdminOnly?: boolean }> = [
    { id: 'SUPER_ADMIN', label: 'Super Admin (Full Access)', superAdminOnly: true },
    { id: 'RESTAURANT_OWNER', label: 'Restaurant Owner' },
    { id: 'SENIOR_CAPTAIN', label: 'Senior Captain' },
    { id: 'WAITER_MANAGER', label: 'Captain' },
    { id: 'KITCHEN_STAFF', label: 'Kitchen Staff' },
    { id: 'KITCHEN_USER', label: 'Kitchen User' },
    { id: 'WAITER', label: 'Waiter / Service Staff' },
    { id: 'CASHIER', label: 'Cashier / Billing Desk' },
    { id: 'KITCHEN_COOKING', label: 'Kitchen Cooking / Chef' },
    { id: 'KITCHEN_BAR', label: 'Kitchen Bar' },
    { id: 'KITCHEN_EXECUTIVE', label: 'Kitchen Executive' },
    { id: 'BEVERAGES', label: 'Beverages Station' },
    { id: 'DRINKS', label: 'Drinks Station' },
    { id: 'RECEPTIONIST', label: 'Receptionist' },
    { id: 'HOUSEKEEPING', label: 'Housekeeping' },
    { id: 'ROOM_SERVICE', label: 'Room Service' }
  ];

  const operationalRoleIds = new Set([
    'WAITER', 'WAITER_MANAGER', 'SENIOR_CAPTAIN', 'KITCHEN_STAFF', 'KITCHEN_USER',
    'KITCHEN_COOKING', 'KITCHEN_BAR', 'KITCHEN_EXECUTIVE',
    'BEVERAGES', 'DRINKS'
  ]);

  const allowedRoles = currentUser?.role === 'SUPER_ADMIN'
    ? databaseRoles
    : allRoles.filter(r => operationalRoleIds.has(r.id));

  const handleOpenAddModal = () => {
    setEmployeeCode(`EMP-${String(employees.length + 101).padStart(3, '0')}`);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setRoleId(currentUser.role === 'SUPER_ADMIN' ? 'WAITER' : 'WAITER');
    setFormErrors({});
    setApiError(null);
    setNewDesignationId('');
    setShowAddModal(true);
    setRolesError('');
    if (currentUser?.role === 'SUPER_ADMIN') {
      setRolesLoading(true);
      setDatabaseRoles([]);
      void api.listAssignableStaffRoles()
        .then(result => {
          const roles = result.items.map(role => ({
            id: role.id,
            label: role.displayName
          }));
          setDatabaseRoles(roles);
          if (roles.length > 0) {
            setRoleId(roles.some(r => r.id === 'WAITER')
              ? 'WAITER' : roles[0].id);
          } else {
            setRolesError('No security roles were returned by the database.');
          }
        })
        .catch(error => {
          setRolesError(
            error?.problem?.detail ||
            error?.message ||
            'Unable to load roles from the database.'
          );
        })
        .finally(() => setRolesLoading(false));
    }
    if (currentUser.role === 'SUPER_ADMIN') {
      setDesignationsReady(false);
      void api.listStaffDesignations()
        .then(result => {
          setDesignationOptions(result.items);
          setDesignationsReady(true);
        })
        .catch(() => setDesignationsReady(false));
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Inline form validation
    const errors: Record<string, string> = {};
    if (!employeeCode.trim()) {
      errors.employeeCode = 'Employee Code is required.';
    }
    if (!firstName.trim()) {
      errors.firstName = 'First Name is required.';
    }
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!phone.trim()) {
      errors.phone = 'Mobile number is required.';
    } else if (phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Mobile number must be at least 10 digits.';
    }
    if (!roleId) {
      errors.roleId = 'Role selection is required.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    let createdStaffId: string | null = null;
    try {
      const created = await api.createStaffUser({
        employeeCode: employeeCode.trim().toUpperCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        roleId,
        password,
        outletId: currentUser.role === 'SUPER_ADMIN'
          ? activeRestaurantId
          : currentUser.restaurantId
      });

      createdStaffId = created.staff.id;

      // The employee exists once createStaffUser succeeds.
      // A failed second request must never trigger duplicate creation.
      let designationWarning = '';
      if (currentUser.role === 'SUPER_ADMIN' && newDesignationId) {
        try {
          await api.assignStaffDesignation(created.staff.id, newDesignationId);
        } catch {
          designationWarning =
            'Employee created successfully, but designation assignment failed. Edit the employee to assign it.';
        }
      }

      await refreshStaffData();
      setShowAddModal(false);
      if (designationWarning) setEditError(designationWarning);
    } catch (err: any) {
      const detail = err?.problem?.detail || err?.message || 'Failed to create staff account. Please verify input and try again.';
      if (createdStaffId) {
        setShowAddModal(false);
        setEditError(
          'Employee was created successfully, but a follow-up operation failed. ' +
          'Check the employee directory before taking further action.'
        );
      } else {
        setApiError(detail);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const employeeRows = employees.map(emp => ({
    id: emp.id,
    employeeCode: emp.employeeCode || '',
    name: emp.name || '',
    designation: emp.designationName || 'Not assigned',
    phone: emp.phone || '',
    email: emp.email || '',
    outlet: emp.department || 'Not assigned',
    status: emp.status || 'inactive'
  }));

  const openEmployeeEdit = (id: string) => {
    if (currentUser?.role !== 'SUPER_ADMIN') return;

    const emp = employees.find(item => item.id === id);
    if (!emp) return;

    setEditError('');
    setDesignationsReady(false);
    setDesignationOptions([]);
    setEditingEmployee(emp);

    void api.listStaffDesignations()
      .then(result => {
        setDesignationOptions(result.items);
        setDesignationsReady(true);
      })
      .catch(() => {
        setDesignationsReady(false);
      });
  };

  if (currentRoute === '/staff/designations') return <DesignationsView />;

  return (
    <div className="pali-staff-master space-y-5 pb-12">


      <div className="pali-staff-header bg-white p-5 rounded-2xl border border-[#DDD8C9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#163024]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Human Resources & Workforce Operations
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage employee profiles, designations, and restaurant assignments.
          </p>
        </div>

        {<button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-xl text-xs font-bold shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>}
      </div>


      {/* Employee Directory — official Bootstrap 5 DataTables */}
      <div className="pali-staff-directory bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-bold text-[#163024]">
            Employee Directory ({employees.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <EmployeeDataTable
            items={employeeRows}
            canEdit={currentUser?.role === 'SUPER_ADMIN'}
            onView={id => {
              const employee = employees.find(item => item.id === id);
              if (employee) setSelectedEmployee(employee);
            }}
            onEdit={openEmployeeEdit}
          />
        </div>
      </div>

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="text-lg font-bold">Employee Details</h3>
            <p>Code: {selectedEmployee.employeeCode}</p>
            <p>Name: {selectedEmployee.name}</p>
            <p>Designation: {selectedEmployee.designationName || "Not assigned"}</p>
            <p>Phone: {selectedEmployee.phone}</p>
            <p>Email: {selectedEmployee.email}</p>
            <p>Outlet: {selectedEmployee.department}</p>
            <p>Status: {selectedEmployee.status}</p>
            <button type="button" onClick={() => setSelectedEmployee(null)}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg">
              Close
            </button>
          </div>
        </div>
      )}

      {editError && (
        <p role="alert" className="text-red-700 text-sm">{editError}</p>
      )}

      {editingEmployee && currentUser?.role === 'SUPER_ADMIN' && (
        <EmployeeEditForm
          employeeCode={editingEmployee.employeeCode}
          initial={{
            firstName: editingEmployee.firstName || '',
            lastName: editingEmployee.lastName || '',
            email: editingEmployee.email || '',
            phone: editingEmployee.phone || '',
            designationId: editingEmployee.designationId ?? null
          }}
          designations={designationOptions}
          allowDesignationEdit={designationsReady}
          onClose={() => setEditingEmployee(null)}
          onSave={async data => {
            await api.updateStaffProfile(editingEmployee.id, {
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              phone: data.phone
            });
            // Profile and designation use separate protected endpoints.
            if (designationsReady &&
                data.designationId !== (editingEmployee.designationId ?? null)) {
              await api.assignStaffDesignation(
                editingEmployee.id,
                data.designationId
              );
            }
            await refreshStaffData();
            setEditingEmployee(null);
          }}
        />
      )}

      {/* ENROLL NEW EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Enroll New Employee</h3>
                
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {apiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="space-y-3.5 text-xs">
              {/* Employee Code & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Employee Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-010"
                    value={employeeCode}
                    onChange={e => setEmployeeCode(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono uppercase ${
                      formErrors.employeeCode ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.employeeCode && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.employeeCode}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Role Assignment <span className="text-rose-500">*</span>
                    {currentUser?.role === 'SUPER_ADMIN' && !rolesLoading && (
                      <span className="ml-2 text-[11px] font-normal text-[#687067]">
                        ({databaseRoles.length} database roles)
                      </span>
                    )}
                  </label>
                  <select
                    required
                    disabled={rolesLoading || (currentUser?.role === 'SUPER_ADMIN' && databaseRoles.length === 0)}
                    value={roleId}
                    onChange={e => setRoleId(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-semibold ${
                      formErrors.roleId ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  >
                    {rolesLoading && (
                      <option value="">Loading database roles...</option>
                    )}
                    {allowedRoles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {rolesError && (
                    <p role="alert" className="mt-1 text-[11px] text-rose-600">
                      {rolesError}
                    </p>
                  )}
                  {formErrors.roleId && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.roleId}</p>
                  )}
                </div>
              </div>

              {currentUser.role === 'SUPER_ADMIN' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Designation
                  </label>
                  <select
                    value={newDesignationId}
                    disabled={!designationsReady}
                    onChange={e => setNewDesignationId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    <option value="">
                      {designationsReady ? 'Select designation (optional)' : 'Designations unavailable'}
                    </option>
                    {designationOptions.filter(d => d.isActive).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Designation does not change the employee's access role.
                  </p>
                </div>
              )}

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl ${
                      formErrors.firstName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.firstName && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@paliclub.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl ${
                      formErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98201 12345"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono ${
                      formErrors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password (min 8 chars) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 bg-slate-50 border rounded-xl ${
                        formErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {formErrors.password && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 bg-slate-50 border rounded-xl ${
                        formErrors.confirmPassword ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {formErrors.confirmPassword && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.confirmPassword}</p>
                  )}
                </div>
              </div>



              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Register Staff Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

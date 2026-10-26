import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

type Shift = {
  id: string; name: string; startTime: string; endTime: string;
};
type Zone = { id: string; name: string; code: string };
type Employee = {
  id: string; firstName: string; lastName: string;
  roles: Array<{ id: string; displayName: string }>;
};
type Assignment = {
  id: string; staffId: string; staffName: string; roleId: string;
  shiftName: string | null; zoneName: string | null;
  startsAt: string; endsAt: string; isLocked: boolean;
};

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DutyRosterPanel: React.FC<{
  outletId: string;
  canEdit: boolean;
}> = ({ outletId, canEdit }) => {
  const [date, setDate] = useState(localDate);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staffId, setStaffId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!outletId) return;
    setError('');
    try {
      const [configuration, roster, directory] = await Promise.all([
        api.getStaffShifts(outletId),
        api.getDutyRoster(outletId, date),
        api.listStaff()
      ]);
      setShifts(configuration.shifts);
      setZones(configuration.zones);
      setAssignments(roster.items);
      setEmployees(directory.items);
    } catch (err: any) {
      setError(err?.problem?.detail || err?.message ||
        'Unable to load the duty roster');
    }
  }, [outletId, date]);

  useEffect(() => { void load(); }, [load]);

  const selected = employees.find(e => e.id === staffId);
  const selectableRoles = selected?.roles || [];

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!outletId || !staffId || !roleId || !shiftId || !date) {
      setError('Select a date, employee, role and shift.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.createDutyRosterAssignment(outletId, {
        staffId, roleId, shiftId, date,
        zoneId: zoneId || null
      });
      setMessage('Duty assignment saved successfully.');
      await load();
    } catch (err: any) {
      setError(err?.problem?.detail || err?.message ||
        'Unable to save duty assignment');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

  if (!outletId) {
    return <p className="text-sm text-amber-700">
      Select a restaurant to manage its duty roster.
    </p>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Daily Duty Roster
          </h3>
          <p className="text-xs text-slate-500">
            Assign staff to restaurant shifts and dining areas.
          </p>
        </div>
        <label className="text-xs font-semibold text-slate-700">
          Duty Date
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setMessage(''); }}
            className={inputClass}
          />
        </label>
      </div>

      {canEdit && (
        <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="text-xs font-semibold">
            Employee
            <select
              value={staffId}
              onChange={e => {
                setStaffId(e.target.value);
                setRoleId('');
              }}
              className={inputClass}
              required
            >
              <option value="">Select employee</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold">
            Duty Role
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select role</option>
              {selectableRoles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.displayName || role.id}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold">
            Shift
            <select
              value={shiftId}
              onChange={e => setShiftId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select shift</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold">
            Dining Area
            <select
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              className={inputClass}
            >
              <option value="">No specific area</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Assign Duty'}
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-600">
              <th className="p-3">Employee</th>
              <th className="p-3">Role</th>
              <th className="p-3">Shift</th>
              <th className="p-3">Dining Area</th>
              <th className="p-3">Duty Time</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(item => (
              <tr key={item.id} className="border-b">
                <td className="p-3">{item.staffName}</td>
                <td className="p-3">{item.roleId}</td>
                <td className="p-3">{item.shiftName || 'Unspecified'}</td>
                <td className="p-3">{item.zoneName || 'All areas'}</td>
                <td className="p-3">
                  {new Date(item.startsAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit'
                  })} – {new Date(item.endsAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-5 text-center text-slate-500">
                  No duty assignments for the selected date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

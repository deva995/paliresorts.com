import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import './DesignationMaster.css';

type RoleRow = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  staffCount: number;
  permissionCount: number;
  isSystemRole: boolean;
};

type Department = { id: string; name: string };

export const DesignationsView: React.FC = () => {
  const [items, setItems] = useState<RoleRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getRoleMaster();
      setItems(data.items);
      setDepartments(data.departments);
      setCanManage(data.canManage);
      setError('');
    } catch (e: any) {
      setError(e?.problem?.detail || e?.message ||
        'Unable to load designations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter(item =>
    `${item.name} ${item.departmentName || ''}`
      .toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * size, currentPage * size
  );

  const openAdd = () => {
    setEditing(null);
    setName('');
    setDepartmentId('');
    setError('');
    setModal(true);
  };

  const openEdit = (item: RoleRow) => {
    setEditing(item);
    setName(item.name);
    setDepartmentId(item.departmentId || '');
    setError('');
    setModal(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || saving || !departmentId || !name.trim()) return;

    setSaving(true);
    try {
      if (editing) {
        await api.editRoleMaster(editing.id, {
          name: name.trim(), departmentId
        });
      } else {
        await api.addRoleMaster({
          name: name.trim(), departmentId
        });
      }
      setModal(false);
      await load();
    } catch (e: any) {
      setError(e?.problem?.detail || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: RoleRow) => {
    if (!canManage || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.removeRoleMaster(item.id);
      await load();
    } catch (e: any) {
      setError(e?.problem?.detail || e?.message ||
        'Designation cannot be removed');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-[#DDD8C9] bg-white px-3 py-2.5 text-sm text-[#163024] focus:outline-none focus:ring-2 focus:ring-[#C5A86A]';

  return (
    <div className="pali-designation-master space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#DDD8C9] bg-white p-5">
        <div>
          <h1 className="text-xl font-bold text-[#163024]">
            Designation Master
          </h1>
          <p className="text-sm text-slate-500">
            Manage departments, designations and role assignments.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={openAdd}
            className="rounded-xl bg-[#163024] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#244737]">
            + Add Designation
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[#DDD8C9] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-[#163024]">
            All Designations ({items.length})
          </h2>
          {loading && <span className="text-xs">Loading...</span>}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs">
            Show
            <select className="rounded-lg border p-2" value={size}
              onChange={e => {
                setSize(Number(e.target.value)); setPage(1);
              }}>
              {[10, 25, 50].map(n =>
                <option key={n} value={n}>{n}</option>)}
            </select>
            entries
          </label>
          <input className={field + ' max-w-xs'} value={search}
            placeholder="Search designations..."
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <table className="table table-hover w-100 pali-designation-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Designation Name</th>
                <th>Staff Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(item => (
                <tr key={item.id}>
                  <td>{item.departmentName || 'Not assigned'}</td>
                  <td className="font-semibold">{item.name}</td>
                  <td>{item.staffCount}</td>
                  <td>
                    {canManage ? (
                      <div className="flex gap-2 whitespace-nowrap">
                        <button type="button" disabled={saving}
                          onClick={() => openEdit(item)}
                          className="rounded-lg border border-[#163024] px-3 py-1.5 text-xs font-semibold text-[#163024]">
                          Edit
                        </button>
                        <button type="button" disabled={saving}
                          onClick={() => { void remove(item); }}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40">
                          Remove
                        </button>
                      </div>
                    ) : <span className="text-xs text-slate-400">
                      View only
                    </span>}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No designations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            Showing {filtered.length ? (currentPage - 1) * size + 1 : 0}
            {' '}to {Math.min(currentPage * size, filtered.length)}
            {' '}of {filtered.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage === 1}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
              onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
              onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </div>
      </div>

      {modal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#163024]">
              {editing ? 'Edit Designation' : 'Add Designation'}
            </h2>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Department *
              </label>
              <select required className={field} value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}>
                <option value="">Select Department</option>
                {departments.map(d =>
                  <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Designation Name *
              </label>
              <input required maxLength={100} className={field}
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter designation name"/>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={saving}
                onClick={() => setModal(false)}
                className="rounded-xl border px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="rounded-xl bg-[#163024] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Designation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

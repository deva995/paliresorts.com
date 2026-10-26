import React, { useState } from 'react';

export type EmployeeEditData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designationId: string | null;
};

export type EmployeeDesignationOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type Props = {
  employeeCode: string;
  initial: EmployeeEditData;
  designations: EmployeeDesignationOption[];
  onSave: (data: EmployeeEditData) => Promise<void>;
  allowDesignationEdit?: boolean;
  onClose: () => void;
};

export const EmployeeEditForm: React.FC<Props> = ({
  employeeCode,
  initial,
  designations,
  allowDesignationEdit = false,
  onSave,
  onClose
}) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const change = (key: keyof EmployeeEditData, value: string | null) =>
    setForm(previous => ({ ...previous, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setError('');
    setSaving(true);

    try {
      await onSave({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        designationId: form.designationId
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to update employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={submit}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold">Edit Employee</h2>

        {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-semibold mb-1">Employee Code</label>
          <input value={employeeCode} readOnly
            className="w-full border rounded-lg p-2 bg-slate-100"/>
        </div>

        {(['firstName', 'lastName', 'email', 'phone'] as const).map(field => (
          <div key={field}>
            <label className="block text-sm font-semibold mb-1">
              {{
                firstName: 'First Name',
                lastName: 'Last Name',
                email: 'Email',
                phone: 'Phone'
              }[field]}
            </label>
            <input
              required={field !== 'lastName'}
              type={field === 'email' ? 'email' : 'text'}
              value={form[field]}
              onChange={e => change(field, e.target.value)}
              maxLength={field === 'email' ? 150 : field === 'phone' ? 20 : 100}
              className="w-full border rounded-lg p-2"
            />
          </div>
        ))}

        {allowDesignationEdit && <div>
          <label className="block text-sm font-semibold mb-1">Designation</label>
          <select
            value={form.designationId || ''}
            onChange={e => change('designationId', e.target.value || null)}
            className="w-full border rounded-lg p-2"
          >
            <option value="">No designation</option>
            {designations
              .filter(item => item.isActive || item.id === form.designationId)
              .map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>}

        <p className="text-xs text-slate-500">
          Job designation is separate from login role and permissions.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="border rounded-lg px-4 py-2">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="bg-[#163024] text-white rounded-lg px-4 py-2 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

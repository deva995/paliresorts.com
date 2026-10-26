import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { MapPin, LayoutGrid, Plus, X, Loader2 } from 'lucide-react';

export const DiningAreaView: React.FC = () => {
  const {
    diningZones,
    tables,
    activeRestaurantId,
    refreshRestaurantData,
    currentUser
  } = useApp();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = [
    'SUPER_ADMIN',
    'RESTAURANT_OWNER',
    'RESTAURANT_MANAGER'
  ].includes(currentUser.role);

  useEffect(() => {
    if (activeRestaurantId) {
      void refreshRestaurantData(activeRestaurantId);
    }
  }, [activeRestaurantId, refreshRestaurantData]);

  const restaurantTables = useMemo(
    () => tables.filter(t => t.restaurantId === activeRestaurantId),
    [tables, activeRestaurantId]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !activeRestaurantId || saving) return;

    setError('');
    setNotice('');

    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setError('Area name must contain 2 to 100 characters.');
      return;
    }

    if (!/^[A-Z0-9_-]{2,30}$/.test(normalizedCode)) {
      setError('Area code must be 2 to 30 letters, numbers, hyphens or underscores.');
      return;
    }

    if (diningZones.some(z =>
      z.name.toLowerCase() === normalizedName.toLowerCase() ||
      z.code.toLowerCase() === normalizedCode.toLowerCase()
    )) {
      setError('This area name or code already exists.');
      return;
    }

    setSaving(true);

    try {
      await api.createDiningZone(activeRestaurantId, {
        name: normalizedName,
        code: normalizedCode,
        displayOrder
      });

      await refreshRestaurantData(activeRestaurantId);
      setShowAdd(false);
      setName('');
      setCode('');
      setDisplayOrder(0);
      setNotice('Dining area created successfully.');
    } catch (err: any) {
      setError(err?.problem?.detail || err?.message || 'Unable to create dining area.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-[#163024]" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Dining Area Management
            </h1>
            <p className="text-sm text-slate-500">
              View and manage restaurant dining areas.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
              setShowAdd(true);
            }}
            className="flex items-center gap-2 bg-[#163024] text-white px-4 py-2 rounded-xl font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Area
          </button>
        )}
      </div>

      {notice && <p role="status" className="text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {diningZones.map(zone => {
          const tableCount = restaurantTables.filter(
            table => table.zoneId === zone.id
          ).length;

          return (
            <div key={zone.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-[#163024]" />
                <h2 className="font-bold text-slate-900">{zone.name}</h2>
              </div>
              <p className="text-sm text-slate-500">Area Code: {zone.code}</p>
              <div className="flex items-center gap-2 mt-4 text-sm font-medium">
                <LayoutGrid className="w-4 h-4" />
                {tableCount} Tables
              </div>
            </div>
          );
        })}
      </div>

      {diningZones.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500">
          No dining areas available for this restaurant.
        </div>
      )}

      {showAdd && canManage && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Dining Area</h2>
              <button type="button" onClick={() => setShowAdd(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-sm font-medium">
              Area Name
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 w-full border rounded-lg p-2"
                placeholder="Main Hall"
              />
            </label>

            <label className="block text-sm font-medium">
              Area Code
              <input
                required
                minLength={2}
                maxLength={30}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="mt-1 w-full border rounded-lg p-2"
                placeholder="MAIN"
              />
            </label>

            <label className="block text-sm font-medium">
              Display Order
              <input
                type="number"
                min="0"
                max="10000"
                value={displayOrder}
                onChange={e => setDisplayOrder(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg p-2"
              />
            </label>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex justify-center items-center gap-2 bg-[#163024] text-white rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Creating...' : 'Create Area'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';

const fieldNames: Record<string,string> = {name:'Name',description:'Description',categoryId:'Category',gstRatePercent:'Tax rate (%)',isVegetarian:'Vegetarian',isVegan:'Vegan',isSpicy:'Spicy',preparationTimeMinutes:'Preparation time (minutes)',imageUrl:'Image',targetKitchenStationCode:'Kitchen station',basePricePaise:'Base price (paise)',priceOverridePaise:'Outlet price (paise)',isAvailable:'Available',displayOrder:'Display order',kitchenStationOverrideCode:'Outlet kitchen station'};

type Revision = { id: string; menuItemName: string; submittedByStaffId: string;
  submitterName?: string; proposedData: Record<string, unknown>; previousData: Record<string, unknown> };

export function MenuApprovalsView() {
  const { currentUser, refreshRestaurantData } = useApp();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const canReview = currentUser?.permissions?.includes('menu:approve_revisions') || currentUser?.role === 'super_admin';
  async function load() {
    setBusy(true); setError('');
    try { const result = await api.request<{revisions:Revision[]}>('/menu/revisions', {params:{status:'PENDING',limit:100}}); setRevisions(result.revisions); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load approvals'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function review(revision:Revision, decision:'approve'|'reject') {
    setBusy(true); setError('');
    try {
      await api.request(`/menu/revisions/${revision.id}/${decision}`, {method:'POST',body:{reviewNotes:notes[revision.id] || ''}});
      await refreshRestaurantData(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to record review'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <h2 className="text-xl font-bold">Menu approvals</h2>
    <p>Shared catalog changes require a different authorized reviewer. Prices and availability apply to the selected outlet.</p>
    <button disabled={busy} onClick={() => void load()}>Refresh approvals</button>
    {error && <p role="alert">{error}</p>}
    {!busy && !error && !revisions.length && <p>No pending changes.</p>}
    {revisions.map(revision => <article key={revision.id} className="bg-white rounded-xl border p-4 space-y-3">
      <h3 className="font-bold">{revision.menuItemName}</h3><p>Submitted by {revision.submitterName || 'staff member'}</p>
      <table className="w-full text-left"><thead><tr><th>Field</th><th>Current</th><th>Proposed</th></tr></thead>
      <tbody>{Object.entries(revision.proposedData).map(([key,value]) => <tr key={key}><td>{fieldNames[key] || key}</td><td>{String(revision.previousData[key] ?? ' - ')}</td><td className="break-all">{String(value ?? ' - ')}</td></tr>)}</tbody></table>
      {canReview && revision.submittedByStaffId !== currentUser?.id ? <>
        <label>Review notes<input aria-label={`Review notes for ${revision.menuItemName}`} maxLength={1000} value={notes[revision.id] || ''} onChange={e => setNotes({...notes,[revision.id]:e.target.value})}/></label>
        <button disabled={busy} onClick={() => void review(revision,'approve')}>Approve</button>
        <button disabled={busy} onClick={() => void review(revision,'reject')}>Reject</button>
      </> : <p>A different authorized reviewer must approve these changes.</p>}
    </article>)}
  </section>;
}

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  Plus,
  Bed,
  Check,
  RotateCcw,
  ShieldCheck,
  X
} from 'lucide-react';

export const HousekeepingView: React.FC = () => {
  const { rooms, updateRoomStatus, currentRoute, pushRoute } = useApp();

  const [maintenanceTickets, setMaintenanceTickets] = useState([
    { id: 'mt-1', roomNumber: '202', issue: 'AC cooling thermostat calibration needed', priority: 'high', status: 'in-progress' },
    { id: 'mt-2', roomNumber: '304', issue: 'Balcony door slider lock stiff', priority: 'medium', status: 'pending' },
    { id: 'mt-3', roomNumber: '105', issue: 'Bathroom shower mixer knob loose', priority: 'low', status: 'resolved' }
  ]);

  const [showLogIssueModal, setShowLogIssueModal] = useState(false);
  const [issueRoom, setIssueRoom] = useState('101');
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePriority, setIssuePriority] = useState<'low' | 'medium' | 'high'>('medium');

  const dirtyRooms = rooms.filter(r => r.status === 'cleaning');
  const availableRooms = rooms.filter(r => r.status === 'available');
  const occupiedRooms = rooms.filter(r => r.status === 'occupied');

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDesc) return;

    setMaintenanceTickets(prev => [
      {
        id: `mt-${Date.now()}`,
        roomNumber: issueRoom,
        issue: issueDesc,
        priority: issuePriority,
        status: 'pending'
      },
      ...prev
    ]);

    updateRoomStatus(rooms.find(r => r.number === issueRoom)?.id || '', 'maintenance');
    setShowLogIssueModal(false);
    setIssueDesc('');
  };

  const handleResolveIssue = (id: string) => {
    setMaintenanceTickets(prev =>
      prev.map(t => (t.id === id ? { ...t, status: 'resolved' } : t))
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Housekeeping & Facility Maintenance
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Turnaround cleaning cycles, linen sanitization, and room defect repairs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLogIssueModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Wrench className="w-4 h-4" />
            <span>Log Maintenance Defect</span>
          </button>
        </div>
      </div>

      {/* Housekeeping Tasks Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Column 1: Dirty / In Cleaning */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <span className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              In Cleaning Queue ({dirtyRooms.length})
            </span>
          </div>

          <div className="space-y-3">
            {dirtyRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-amber-700/60">
                No rooms currently queued for cleaning.
              </div>
            ) : (
              dirtyRooms.map(room => (
                <div key={room.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-black text-sm text-slate-900">Room {room.number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase">
                      Turnaround
                    </span>
                  </div>
                  <p className="text-slate-600">{room.roomTypeName} • Floor {room.floor}</p>
                  <p className="text-[11px] text-slate-400">Assigned: {room.housekeeperAssigned || 'Housekeeper Maya'}</p>

                  <button
                    onClick={() => updateRoomStatus(room.id, 'available')}
                    className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Pass Inspection & Make Available</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Occupied Rooms (Daily Refresh) */}
        <div className="bg-[#526B4A]/5 border border-[#DDD8C9] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
            <span className="font-bold text-xs uppercase tracking-wider text-[#163024] flex items-center gap-1.5">
              <Bed className="w-4 h-4 text-[#163024]" />
              Occupied In-House ({occupiedRooms.length})
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {occupiedRooms.map(room => (
              <div key={room.id} className="bg-white p-3.5 rounded-xl border border-[#DDD8C9] shadow-xs space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-black text-slate-900">Room {room.number}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#526B4A]/10 text-[#163024] font-bold">
                    Do Not Disturb: Off
                  </span>
                </div>
                <p className="text-slate-700 font-semibold">{room.currentGuestName}</p>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <span>Daily Linen Refresh</span>
                  <span className="text-emerald-600 font-semibold">Completed 10:30 AM</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Facility Maintenance Tickets */}
        <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-rose-200">
            <span className="font-bold text-xs uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-rose-600" />
              Maintenance Logs ({maintenanceTickets.filter(t => t.status !== 'resolved').length})
            </span>
          </div>

          <div className="space-y-3">
            {maintenanceTickets.map(ticket => (
              <div key={ticket.id} className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-black text-slate-900">Room {ticket.roomNumber}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                      ticket.priority === 'high'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ticket.priority} priority
                  </span>
                </div>
                <p className="text-slate-700 leading-tight font-medium">{ticket.issue}</p>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">{ticket.status}</span>
                  {ticket.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolveIssue(ticket.id)}
                      className="text-xs text-[#163024] hover:text-[#526B4A] font-bold"
                    >
                      Resolve & Close →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: LOG MAINTENANCE ISSUE */}
      {showLogIssueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Report Room Defect / Issue</h3>
              <button onClick={() => setShowLogIssueModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Room Number</label>
                <select
                  value={issueRoom}
                  onChange={e => setIssueRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.number}>Room {r.number} ({r.roomTypeName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Defect Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Bathroom exhaust fan noisy, needs greasing or motor replacement."
                  value={issueDesc}
                  onChange={e => setIssueDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Priority</label>
                <div className="flex gap-4 pt-1">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <label key={p} className="flex items-center gap-1.5 cursor-pointer capitalize">
                      <input
                        type="radio"
                        name="priority"
                        checked={issuePriority === p}
                        onChange={() => setIssuePriority(p)}
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogIssueModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm"
                >
                  Dispatch Maintenance Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

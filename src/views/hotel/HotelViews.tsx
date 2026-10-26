import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Room, RoomStatus, Reservation } from '../../types';
import { ROOM_TYPES } from '../../data/mockData';
import {
  Hotel,
  Bed,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Sparkles,
  Key,
  CreditCard,
  UserCheck,
  Phone,
  AlertTriangle,
  X
} from 'lucide-react';

export const HotelViews: React.FC = () => {
  const {
    currentRoute,
    pushRoute,
    rooms,
    reservations,
    updateRoomStatus,
    addReservation,
    checkInGuest,
    checkOutGuest
  } = useApp();

  const subpath = currentRoute.replace('/hotel/', '').replace('/reception/', '').split('/')[0] || 'dashboard';

  // State for Modals
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  // New Booking Form State
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState('Deluxe King');
  const [checkInDate, setCheckInDate] = useState('2026-09-04');
  const [checkOutDate, setCheckOutDate] = useState('2026-09-06');
  const [numGuests, setNumGuests] = useState(2);
  const [advancePaid, setAdvancePaid] = useState('5000');

  // Check-In Selection
  const [checkInReservation, setCheckInReservation] = useState<Reservation | null>(null);
  const [assignedRoomNumber, setAssignedRoomNumber] = useState('101');
  const [idProofType, setIdProofType] = useState('Aadhaar Card');
  const [idProofNumber, setIdProofNumber] = useState('9821-4321-7789');

  // Check-Out Selection
  const [selectedRoomForCheckout, setSelectedRoomForCheckout] = useState<Room | null>(null);

  // Filter for Room Grid
  const [roomFilterStatus, setRoomFilterStatus] = useState<string>('all');
  const [roomFilterFloor, setRoomFilterFloor] = useState<string>('all');

  const occupiedCount = rooms.filter(r => r.status === 'occupied').length;
  const availableCount = rooms.filter(r => r.status === 'available').length;
  const cleaningCount = rooms.filter(r => r.status === 'cleaning').length;
  const maintenanceCount = rooms.filter(r => r.status === 'maintenance').length;
  const occupancyPercent = Math.round((occupiedCount / rooms.length) * 100);

  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestPhone) return;

    addReservation({
      guestName,
      guestPhone,
      guestEmail: `${guestName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      roomTypeId: ROOM_TYPES.find(rt => rt.name === selectedRoomType)?.id || 'rt-1',
      roomTypeName: selectedRoomType,
      checkInDate,
      checkOutDate,
      numberOfGuests: numGuests,
      advancePayment: parseFloat(advancePaid) || 0,
      totalAmount: (ROOM_TYPES.find(rt => rt.name === selectedRoomType)?.basePrice || 4500) * 2,
      specialRequests: 'High floor room requested.'
    });

    setShowNewBookingModal(false);
    setGuestName('');
    setGuestPhone('');
  };

  const handleConfirmCheckIn = () => {
    if (!checkInReservation) return;
    checkInGuest(checkInReservation.id, assignedRoomNumber);
    setShowCheckInModal(false);
  };

  const handleConfirmCheckOut = () => {
    if (!selectedRoomForCheckout) return;
    checkOutGuest(selectedRoomForCheckout.id);
    setShowCheckOutModal(false);
  };

  const filteredRooms = rooms.filter(r => {
    const matchesStatus = roomFilterStatus === 'all' || r.status === roomFilterStatus;
    const matchesFloor = roomFilterFloor === 'all' || r.floor.toString() === roomFilterFloor;
    return matchesStatus && matchesFloor;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { label: 'Hotel Console', path: '/hotel/dashboard' },
          { label: 'Rooms & Occupancy', path: '/hotel/rooms' },
          { label: 'Room Categories', path: '/hotel/room-types' },
          { label: 'Reservations Book', path: '/hotel/reservations', badge: reservations.filter(r => r.status === 'confirmed').length },
          { label: 'Guest Directory', path: '/hotel/guests' },
          { label: 'Express Check-In', path: '/hotel/check-in' },
          { label: 'Express Check-Out', path: '/hotel/check-out' },
          { label: 'Hospitality Analytics', path: '/hotel/reports' }
        ].map(tab => {
          const isActive = currentRoute === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => pushRoute(tab.path)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white text-[#163024]' : 'bg-[#526B4A]/10 text-[#163024]'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. HOTEL OVERVIEW DASHBOARD */}
      {(subpath === 'dashboard' || currentRoute === '/hotel' || currentRoute === '/reception') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Hospitality & Room Operations Console
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Front desk coordination, guest folios, keycard issuance, and housekeeping status.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewBookingModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-xl text-xs font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Reservation</span>
              </button>
              <button
                onClick={() => pushRoute('/hotel/check-in')}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                <Key className="w-4 h-4" />
                <span>Express Check-In</span>
              </button>
            </div>
          </div>

          {/* Occupancy Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Occupancy Rate</span>
              <div className="text-2xl font-black text-[#163024] font-mono">{occupancyPercent}%</div>
              <span className="text-[10px] text-slate-400">{occupiedCount} of {rooms.length} rooms</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Available Ready</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">{availableCount}</div>
              <span className="text-[10px] text-slate-400">Sanitized & Inspected</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Housekeeping</span>
              <div className="text-2xl font-black text-amber-600 font-mono">{cleaningCount}</div>
              <span className="text-[10px] text-slate-400">In Cleaning Queue</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Maintenance</span>
              <div className="text-2xl font-black text-rose-600 font-mono">{maintenanceCount}</div>
              <span className="text-[10px] text-slate-400">Engineering Work</span>
            </div>
          </div>

          {/* Room Grid Quick Glance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Room Floor Map</h3>
              <button
                onClick={() => pushRoute('/hotel/rooms')}
                className="text-xs text-[#163024] font-semibold hover:underline"
              >
                Detailed Room Grid →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {rooms.map(room => (
                <div
                  key={room.id}
                  onClick={() => {
                    if (room.status === 'occupied') {
                      setSelectedRoomForCheckout(room);
                      setShowCheckOutModal(true);
                    } else if (room.status === 'available') {
                      pushRoute('/hotel/check-in');
                    }
                  }}
                  className={`p-3 rounded-xl border cursor-pointer select-none transition-all ${
                    room.status === 'occupied'
                      ? 'bg-[#526B4A]/10 border-[#526B4A]/30 text-[#163024] shadow-xs'
                      : room.status === 'cleaning'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : room.status === 'maintenance'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-base">{room.number}</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-white">
                      {room.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">{room.roomTypeName}</p>
                  {room.currentGuestName && (
                    <p className="text-[10px] text-[#526B4A] font-semibold truncate mt-0.5">
                      {room.currentGuestName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. ROOMS GRID & MANAGEMENT */}
      {subpath === 'rooms' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hotel Inventory & Room Grid</h2>
              <p className="text-xs text-slate-500">Live operational status, room features, and housekeeping state.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={roomFilterStatus}
                onChange={e => setRoomFilterStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available (Vacant Clean)</option>
                <option value="occupied">Occupied</option>
                <option value="cleaning">Cleaning</option>
                <option value="maintenance">Maintenance</option>
              </select>

              <select
                value={roomFilterFloor}
                onChange={e => setRoomFilterFloor(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="all">All Floors</option>
                <option value="1">1st Floor</option>
                <option value="2">2nd Floor</option>
                <option value="3">3rd Floor</option>
                <option value="4">4th Floor (VIP)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map(room => (
              <div
                key={room.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xl text-slate-900">Room {room.number}</span>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">Floor {room.floor}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        room.status === 'occupied'
                          ? 'bg-[#526B4A]/10 text-[#163024]'
                          : room.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : room.status === 'cleaning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-700 mt-1">{room.roomTypeName}</p>
                  <p className="text-[11px] text-slate-400 font-mono">₹{room.pricePerNight} / night</p>

                  {room.currentGuestName ? (
                    <div className="mt-3 p-2.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{room.currentGuestName}</span>
                        <span className="text-[10px] text-[#526B4A] font-semibold font-mono">Folio #RF-90</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>Check-In: {room.checkInDate}</span>
                        <span>Check-Out: {room.checkOutDate}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-xl text-xs text-slate-500">
                      Cleaned by: {room.housekeeperAssigned || 'Housekeeping Team'}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {room.status === 'occupied' ? (
                    <button
                      onClick={() => {
                        setSelectedRoomForCheckout(room);
                        setShowCheckOutModal(true);
                      }}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Checkout Guest Folio
                    </button>
                  ) : room.status === 'cleaning' ? (
                    <button
                      onClick={() => updateRoomStatus(room.id, 'available')}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Mark Cleaned & Available
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        pushRoute('/hotel/check-in');
                      }}
                      className="w-full py-1.5 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-lg text-xs font-bold transition-colors"
                    >
                      Check-In Guest
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RESERVATIONS BOOK */}
      {subpath === 'reservations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Advance Reservations Registry</h3>
              <p className="text-xs text-slate-500">Future guest arrivals, room locks, and advance deposits.</p>
            </div>
            <button
              onClick={() => setShowNewBookingModal(true)}
              className="px-3.5 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Reservation</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Booking ID</th>
                    <th className="p-3.5">Guest Details</th>
                    <th className="p-3.5">Room Category</th>
                    <th className="p-3.5">Arrival - Departure</th>
                    <th className="p-3.5">Guests</th>
                    <th className="p-3.5">Advance Deposit</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-slate-900">{res.bookingNumber}</td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{res.guestName}</p>
                        <span className="text-[11px] text-slate-400 font-mono">{res.guestPhone}</span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">{res.roomTypeName}</td>
                      <td className="p-3.5 font-mono text-slate-600">
                        {res.checkInDate} → {res.checkOutDate}
                      </td>
                      <td className="p-3.5">{res.numberOfGuests} Guests</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-700">₹{res.advancePayment}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#526B4A]/10 text-[#163024] border border-[#526B4A]/30">
                          {res.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {res.status === 'confirmed' && (
                          <button
                            onClick={() => {
                              setCheckInReservation(res);
                              setShowCheckInModal(true);
                            }}
                            className="px-3 py-1 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-lg text-xs font-bold transition-colors"
                          >
                            Express Check-In
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXPRESS CHECK-IN DESK */}
      {subpath === 'check-in' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 max-w-2xl mx-auto">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#163024]" />
              Front Desk Express Guest Check-In
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify guest identity, assign room key card, and activate folio.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Guest Reservation</label>
              <select
                onChange={e => {
                  const r = reservations.find(res => res.id === e.target.value);
                  if (r) setCheckInReservation(r);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              >
                <option value="">-- Choose confirmed reservation --</option>
                {reservations.filter(r => r.status === 'confirmed').map(r => (
                  <option key={r.id} value={r.id}>
                    {r.bookingNumber} - {r.guestName} ({r.roomTypeName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Available Room</label>
                <select
                  value={assignedRoomNumber}
                  onChange={e => setAssignedRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
                >
                  {rooms.filter(r => r.status === 'available').map(r => (
                    <option key={r.id} value={r.number}>
                      Room {r.number} ({r.roomTypeName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ID Proof Type</label>
                <select
                  value={idProofType}
                  onChange={e => setIdProofType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="Aadhaar Card">Aadhaar Card (India)</option>
                  <option value="Passport">Passport</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ID Document Number</label>
              <input
                type="text"
                value={idProofNumber}
                onChange={e => setIdProofNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmCheckIn}
              disabled={!checkInReservation}
              className="w-full py-3 bg-[#163024] hover:bg-[#163024]/90 disabled:opacity-50 text-[#F7F4EC] rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>Issue Digital Keycard & Check In Guest</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. EXPRESS CHECK-OUT DESK */}
      {subpath === 'check-out' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 max-w-2xl mx-auto">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#163024]" />
              Express Guest Check-Out & Folio Settlement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review room charges, restaurant bills, minibar, and settle final balance.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Occupied Room</label>
              <select
                onChange={e => {
                  const rm = rooms.find(r => r.id === e.target.value);
                  if (rm) setSelectedRoomForCheckout(rm);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              >
                <option value="">-- Choose occupied room --</option>
                {rooms.filter(r => r.status === 'occupied').map(r => (
                  <option key={r.id} value={r.id}>
                    Room {r.number} - {r.currentGuestName} ({r.roomTypeName})
                  </option>
                ))}
              </select>
            </div>

            {selectedRoomForCheckout && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Guest Name:</span>
                  <span className="font-bold text-slate-900">{selectedRoomForCheckout.currentGuestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Room Charges (2 Nights):</span>
                  <span className="font-mono font-bold">₹{selectedRoomForCheckout.pricePerNight * 2}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">In-Room Dining:</span>
                  <span className="font-mono font-bold">₹1,850</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 text-sm">
                  <span>Net Due:</span>
                  <span className="font-mono text-[#163024]">₹{(((selectedRoomForCheckout.pricePerNight ?? 4500) * 2) + 1850).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmCheckOut}
              disabled={!selectedRoomForCheckout}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Settle Folio, Release Room & Trigger Cleaning</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. GUEST DIRECTORY & FOLIO PAYMENTS */}
      {(subpath === 'guests' || subpath === 'payments' || subpath === 'reports') && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {subpath === 'payments' ? 'Guest Folio Ledger & Room Billing' : 'Resident Guest Profiles & Verification'}
              </h3>
              <p className="text-xs text-slate-500">
                {subpath === 'payments' ? 'Live settlement status for in-house and arriving guests.' : 'Active in-house guests, identification proofs, and stay duration.'}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Real-Time</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.filter(r => r.status === 'occupied').map(room => (
              <div key={room.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">{room.currentGuestName}</span>
                  <span className="px-2 py-0.5 rounded bg-[#526B4A]/10 text-[#163024] font-mono font-bold text-[10px]">
                    Room {room.number}
                  </span>
                </div>
                <p className="text-slate-500">Phone: +91 98201 12345</p>
                <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-200">
                  <span>Stay: {room.checkInDate} to {room.checkOutDate}</span>
                  <span className="text-emerald-700 font-semibold">
                    {subpath === 'payments' ? 'Advance Settle' : 'Verified ID'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. ROOM TYPES & CATEGORIES CATALOG */}
      {subpath === 'room-types' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Room Categories & Tariff Slabs</h3>
              <p className="text-xs text-slate-500">Configured luxury tiers, standard amenities, and pricing rates.</p>
            </div>
            <button
              onClick={() => setShowNewBookingModal(true)}
              className="px-3.5 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-xl text-xs font-bold shadow-sm"
            >
              + Book Category
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ROOM_TYPES.map(rt => (
              <div key={rt.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{rt.name}</h4>
                    <span className="text-xs text-slate-500">Max {rt.maxOccupancy} Guests</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-[#163024] font-mono text-lg">₹{(rt.basePrice ?? 0).toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-slate-400">/ night</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{rt.description}</p>
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Amenities Included</span>
                  <div className="flex flex-wrap gap-1.5">
                    {rt.amenities.map(a => (
                      <span key={a} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NEW RESERVATION */}
      {showNewBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Create Hotel Reservation</h3>
              <button onClick={() => setShowNewBookingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Primary Guest Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikramaditya Singhania"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91 9876543210"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Check-In Date</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={e => setCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Check-Out Date</label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={e => setCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Category</label>
                  <select
                    value={selectedRoomType}
                    onChange={e => setSelectedRoomType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    {ROOM_TYPES.map(rt => (
                      <option key={rt.id} value={rt.name}>{rt.name} (₹{rt.basePrice})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Advance Deposit (₹)</label>
                  <input
                    type="number"
                    value={advancePaid}
                    onChange={e => setAdvancePaid(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewBookingModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] font-bold rounded-xl shadow-sm"
                >
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

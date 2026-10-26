import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bed,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  Plus,
  Truck,
  Users,
  AlertCircle,
  X
} from 'lucide-react';

export const RoomServiceView: React.FC = () => {
  const { orders, rooms, updateOrderStatus, pushRoute, addOrder, menuItems, currentRoute } = useApp();

  const subpath = currentRoute.replace('/room-service/', '').split('/')[0] || 'dashboard';

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('102');
  const [selectedDishId, setSelectedDishId] = useState(menuItems[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [specialNote, setSpecialNote] = useState('Extra cutlery, hot service');

  const allRoomOrders = orders.filter(o => o.type === 'room-service' || Boolean(o.roomNumber));

  const filteredOrders = allRoomOrders.filter(order => {
    if (subpath === 'delivery') return order.status === 'ready' || order.status === 'preparing';
    if (subpath === 'completed') return order.status === 'completed';
    return true;
  });

  const handleCreateRoomOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const dish = menuItems.find(m => m.id === selectedDishId);
    if (!dish) return;

    const matchedRoom = rooms.find(r => r.number === selectedRoom);

    addOrder({
      type: 'room-service',
      roomNumber: selectedRoom,
      guestName: matchedRoom?.currentGuestName || `Guest Room ${selectedRoom}`,
      items: [
        {
          id: `roi-${Date.now()}`,
          menuItemId: dish.id,
          name: dish.name,
          price: dish.price,
          quantity: quantity,
          isVeg: dish.isVeg,
          status: 'pending'
        }
      ],
      notes: specialNote
    });

    setShowOrderModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { label: 'Room Service Hub', path: '/room-service/dashboard' },
          { label: 'Room Orders Queue', path: '/room-service/orders', badge: allRoomOrders.filter(o => o.status !== 'completed').length },
          { label: 'Butler Delivery', path: '/room-service/delivery' },
          { label: 'Fulfilled Orders', path: '/room-service/completed' }
        ].map(tab => {
          const isActive = currentRoute === tab.path || (tab.path === '/room-service/dashboard' && currentRoute === '/room-service');
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Bed className="w-5 h-5 text-[#163024]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              In-Room Dining & Butler Dispatch
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deliver hot cuisine, beverages, and hospitality amenities directly to guest suites.
          </p>
        </div>
        <button
          onClick={() => setShowOrderModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-xl text-xs font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Punch In-Room Order</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
            <Bed className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">No active in-room dining orders right now.</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="font-black font-mono text-base text-slate-900">
                    Room {order.roomNumber || '302'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      order.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-[#526B4A]/10 text-[#163024] border border-[#526B4A]/30'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-700 mt-1">{order.guestName}</p>

                <div className="mt-3 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  {order.items.map(i => (
                    <div key={i.id} className="flex justify-between">
                      <span className="text-slate-700">{i.name}</span>
                      <span className="font-mono font-bold text-slate-900">x{i.quantity}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                    <span>Folio Charge:</span>
                    <span className="font-mono text-[#163024]">₹{order.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                {order.status !== 'completed' ? (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    className="w-full py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Butler Delivery</span>
                  </button>
                ) : (
                  <div className="w-full py-1 text-center text-xs font-semibold text-slate-400">
                    Delivered to Room
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Direct In-Room Dining Punch Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Punch In-Room Dining Ticket</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoomOrder} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Guest Room</label>
                <select
                  value={selectedRoom}
                  onChange={e => setSelectedRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.number}>
                      Room {r.number} ({r.currentGuestName || 'Vacant / Guest Request'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Food & Beverage Dish</label>
                <select
                  value={selectedDishId}
                  onChange={e => setSelectedDishId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  {menuItems.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — ₹{m.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Type</label>
                  <div className="py-2 text-slate-700 font-semibold">Trolley Butler Service</div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Special Butler Instructions</label>
                <input
                  type="text"
                  value={specialNote}
                  onChange={e => setSpecialNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#163024] hover:bg-[#163024]/90 text-[#F7F4EC] font-bold rounded-xl shadow-sm"
                >
                  Dispatch to Kitchen & Butler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ROOM_TYPES } from '../../data/mockData';
import { CustomerQRMenu } from './CustomerQRMenu';
import {
  UtensilsCrossed,
  Bed,
  CheckCircle2,
  Sparkles,
  Calendar,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const CustomerPortalView: React.FC = () => {
  const {
    currentRoute,
    pushRoute,
    addReservation
  } = useApp();

  const isRoomBooking = currentRoute.includes('room-booking');

  // Room Booking State
  const [bookCheckIn, setBookCheckIn] = useState('2026-09-10');
  const [bookCheckOut, setBookCheckOut] = useState('2026-09-12');
  const [bookRoomType, setBookRoomType] = useState('Executive Suite');
  const [bookGuestName, setBookGuestName] = useState('Rohan Sen');
  const [bookPhone, setBookPhone] = useState('+91 98300 55441');
  const [bookSuccess, setBookSuccess] = useState(false);

  const handleConfirmRoomBooking = (e: React.FormEvent) => {
    e.preventDefault();
    addReservation({
      id: `res-${Date.now()}`,
      bookingReference: `PALI-RM-${Math.floor(1000 + Math.random() * 9000)}`,
      roomId: 'rm-101',
      roomNumber: '101',
      roomType: bookRoomType as any,
      guestId: 'gst-1',
      guestName: bookGuestName,
      guestPhone: bookPhone,
      status: 'confirmed',
      checkInDate: bookCheckIn,
      checkOutDate: bookCheckOut,
      numberOfGuests: 2,
      advancePayment: 5000,
      totalAmount: 17000
    });
    setBookSuccess(true);
  };

  return (
    <div className={`w-full max-w-full overflow-x-hidden mx-auto ${isRoomBooking ? 'max-w-2xl p-2 sm:p-4' : 'w-full p-0 flex flex-col min-h-[100dvh]'}`}>
      {/* Top guest portal utility bar (reserved for room booking) */}
      {isRoomBooking && (
        <div className="flex items-center justify-between pb-2.5 px-2 text-xs text-[#687067]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#526B4A]" />
            <span className="font-semibold text-[#163024]">Pali Guest Experience</span>
          </div>
          <button
            type="button"
            onClick={() => pushRoute('/login')}
            className="hover:text-[#163024] font-medium transition-colors cursor-pointer text-[11px]"
          >
            Staff Console Login →
          </button>
        </div>
      )}

      {!isRoomBooking ? (
        <CustomerQRMenu />
      ) : (
        <div className="space-y-5 pb-16">
          {/* Customer Mode Header Switcher for Room Booking */}
          <div className="bg-[#163024] text-[#f7f4ec] p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xl border border-[#244737]">
            <div className="flex items-center gap-2.5">
              <div className="bg-white px-2.5 py-1 rounded-xl shadow-xs border border-[#DDD8C9] flex items-center">
                <img
                  src="/palilogo.png"
                  alt="Pali Resort & Club • Pali Village"
                  className="h-7 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[11px] text-[#dfc78f] font-sans font-medium hidden sm:block">
                Digital Guest Hospitality Portal
              </p>
            </div>

            <button
              onClick={() => pushRoute('/customer/qr-ordering')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all flex items-center gap-1.5 bg-[#c5a86a] text-[#163024] shadow-xs"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Dining QR Menu</span>
            </button>
          </div>

          <div className="bg-[#fcfbf7] rounded-3xl border border-[#e8e1cf] overflow-hidden shadow-xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-[#e8e1cf] pb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#c5a86a] font-sans block">
                Sanctuary Accommodation
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#163024] mt-1">Book Your Luxury Stay</h2>
              <p className="text-xs text-stone-600 font-sans">
                Select your check-in dates, retreat suite category, and confirm instant reservation.
              </p>
            </div>

            {bookSuccess ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#163024]">Reservation Confirmed!</h3>
                <p className="text-xs text-stone-600 font-sans">
                  Booking reference dispatched to {bookPhone}. We look forward to hosting you at Pali Resort & Club!
                </p>
                <button
                  onClick={() => setBookSuccess(false)}
                  className="px-5 py-2.5 bg-[#163024] text-[#f7f4ec] rounded-xl text-xs font-bold font-sans uppercase tracking-wider shadow-md"
                >
                  Book Another Suite
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmRoomBooking} className="space-y-4 text-xs font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Check-In Date</label>
                    <input
                      type="date"
                      value={bookCheckIn}
                      onChange={e => setBookCheckIn(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#e8e1cf] focus:border-[#163024] rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Check-Out Date</label>
                    <input
                      type="date"
                      value={bookCheckOut}
                      onChange={e => setBookCheckOut(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#e8e1cf] focus:border-[#163024] rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Select Room Suite</label>
                  <div className="grid grid-cols-1 gap-2">
                    {ROOM_TYPES.map(rt => (
                      <div
                        key={rt.id}
                        onClick={() => setBookRoomType(rt.name)}
                        className={`p-3.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                          bookRoomType === rt.name
                            ? 'border-[#163024] bg-[#163024]/5 ring-1 ring-[#163024] font-semibold'
                            : 'border-[#e8e1cf] bg-white hover:border-[#c5a86a]'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-stone-900">{rt.name}</p>
                          <p className="text-[10px] text-stone-500">
                            Max {rt.maxOccupancy} Guests • {rt.amenities.join(', ')}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-sm text-[#163024]">₹{rt.basePrice}/night</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Guest Full Name</label>
                    <input
                      type="text"
                      required
                      value={bookGuestName}
                      onChange={e => setBookGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#e8e1cf] focus:border-[#163024] rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Mobile Contact Number</label>
                    <input
                      type="text"
                      required
                      value={bookPhone}
                      onChange={e => setBookPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#e8e1cf] focus:border-[#163024] rounded-xl font-mono outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#163024] hover:bg-[#12261d] text-[#f7f4ec] rounded-xl font-bold shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[#c5a86a]/40 transition-all cursor-pointer"
                >
                  <span>Confirm Resort Reservation (Advance ₹5,000)</span>
                  <ArrowRight className="w-4 h-4 text-[#c5a86a]" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

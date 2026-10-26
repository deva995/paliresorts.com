import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  LogOut,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';

export const WaiterProfileView: React.FC = () => {
  const { currentUser, logout, activeRestaurant } = useApp();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-[#DDD8C9] shadow-xs overflow-hidden">
        {/* Banner */}
        <div className="bg-[#163024] p-6 text-[#F7F4EC] relative">
          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#C5A86A] shadow-md"
            />
            <div>
              <h2 className="font-serif font-bold text-xl text-[#F7F4EC]">
                {currentUser.name}
              </h2>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#C5A86A] text-[#163024]">
                {currentUser.role === 'WAITER_MANAGER' ? 'CAPTAIN' : 'WAITER'}
              </span>
              <p className="text-xs text-[#DDD8C9] mt-1 font-serif">
                Pali Resort & Club • Nature's Gateway
              </p>
            </div>
          </div>
        </div>

        {/* Profile Details List */}
        <div className="p-6 space-y-4 text-xs">
          <div className="space-y-3 bg-[#F7F4EC] p-4 rounded-xl border border-[#DDD8C9]">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <User className="w-4 h-4 text-[#526B4A]" />
                Waiter Name:
              </span>
              <span className="font-bold text-[#163024]">{currentUser.name}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#526B4A]" />
                Role:
              </span>
              <span className="font-bold text-[#163024]">WAITER</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#526B4A]" />
                Restaurant:
              </span>
              <span className="font-bold text-[#163024]">Pali Resort & Club</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#526B4A]" />
                Assigned Section / Station:
              </span>
              <span className="font-bold text-[#163024]">Main Dining & Terrace Garden</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#526B4A]" />
                Assigned Tables:
              </span>
              <span className="font-bold text-[#163024]">
                {currentUser.assignedTables?.join(', ') || 'T-01, T-02, T-03, T-04, T-05'}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#526B4A]" />
                Shift:
              </span>
              <span className="font-bold text-[#163024]">Evening Dinner Service (4 PM - 12 AM)</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#526B4A]" />
                Email:
              </span>
              <span className="font-mono text-[#1D241F] font-semibold">{currentUser.email}</span>
            </div>

            {currentUser.phone && (
              <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
                <span className="text-[#687067] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#526B4A]" />
                  Mobile:
                </span>
                <span className="font-mono text-[#1D241F] font-semibold">{currentUser.phone}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[#687067] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#526B4A]" />
                Station Status:
              </span>
              <span className="font-semibold text-[#526B4A] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#526B4A] animate-pulse" />
                Active Shift • Rest-1 Scoped
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-[#DDD8C9] text-[11px] text-[#687067] leading-relaxed">
            <strong className="text-[#163024]">Security Isolation Notice:</strong> Operational access follows your current outlet membership and server permissions.
          </div>

          {/* Logout button */}
          <div className="pt-2">
            <button
              onClick={() => logout()}
              className="w-full py-3 bg-[#C53030] hover:bg-[#a82828] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

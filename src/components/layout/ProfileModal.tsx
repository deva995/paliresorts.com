import { getRoleLabel } from '../../utils/rbac';
import React from 'react';
import { useApp } from '../../context/AppContext';
import { User, LogOut, X, Building2, Mail, Phone, ShieldCheck, CheckCircle2, Compass } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, effectiveRole, logout, activeRestaurant, openTour } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white rounded-2xl max-w-md w-full border border-[#DDD8C9] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header banner */}
        <div className="bg-[#163024] text-[#F7F4EC] p-6 relative">
          <button
            onClick={onClose}
            aria-label="Close profile modal"
            className="absolute top-4 right-4 p-1 rounded-lg text-[#DDD8C9] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#C5A86A] shadow-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-serif font-bold text-lg text-[#F7F4EC]">
                  {currentUser.name}
                </h3>
              </div>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#C5A86A] text-[#163024]">
                {effectiveRole.replace('_', ' ')}
              </span>
              <p className="text-[11px] text-[#DDD8C9] mt-1 font-serif">
                Pali Resort & Club • Nature's Gateway
              </p>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6 space-y-4 text-xs">
          <div className="space-y-3 bg-[#F7F4EC] p-4 rounded-xl border border-[#DDD8C9]">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#526B4A]" />
                Assigned Restaurant:
              </span>
              <span className="font-bold text-[#163024]">
                Pali Resort & Club
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#526B4A]" />
                Operational Role:
              </span>
              <span className="font-bold text-[#163024]">
                {getRoleLabel(currentUser.role)}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
              <span className="text-[#687067] flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#526B4A]" />
                Email Address:
              </span>
              <span className="font-mono text-[#1D241F] font-semibold">
                {currentUser.email}
              </span>
            </div>

            {currentUser.phone && (
              <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
                <span className="text-[#687067] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#526B4A]" />
                  Contact Mobile:
                </span>
                <span className="font-mono text-[#1D241F] font-semibold">
                  {currentUser.phone}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[#687067] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#526B4A]" />
                Account Status:
              </span>
              <span className="font-semibold text-[#526B4A] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#526B4A] animate-pulse" />
                Active Session
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-[#DDD8C9] text-[11px] text-[#687067] leading-relaxed">
            <strong className="text-[#163024]">Role Assignment Notice:</strong> Security privileges are defined at the account credential level. Role modification is strictly disabled during active sessions.
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-[#F7F4EC] text-[#1D241F] border border-[#DDD8C9] rounded-xl font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              id="btn-profile-logout"
              onClick={() => {
                onClose();
                logout();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-[#C53030] hover:bg-[#a82828] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
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

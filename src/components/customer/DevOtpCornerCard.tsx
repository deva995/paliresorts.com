import React from 'react';
import { X, KeyRound } from 'lucide-react';

interface DevOtpCornerCardProps {
  otp: string;
  onClose: () => void;
}

export const DevOtpCornerCard: React.FC<DevOtpCornerCardProps> = ({ otp, onClose }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex items-center gap-3.5 bg-[#163024]/95 backdrop-blur-md border border-[#C5A86A]/50 text-[#F7F4EC] rounded-2xl px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="w-8 h-8 rounded-xl bg-[#C5A86A]/20 border border-[#C5A86A]/40 flex items-center justify-center shrink-0">
        <KeyRound className="w-4 h-4 text-[#C5A86A]" />
      </div>
      <div>
        <div className="text-[10px] font-bold tracking-wider text-[#C5A86A] uppercase">
          OTP
        </div>
        <div className="text-2xl font-mono font-extrabold tracking-widest text-white leading-tight">
          {otp}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close OTP card"
        className="ml-1 p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

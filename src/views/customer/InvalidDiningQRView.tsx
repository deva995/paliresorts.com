import React from 'react';
import { QrCode, AlertTriangle, RefreshCw } from 'lucide-react';

interface InvalidDiningQRViewProps {
  errorReason?: string;
  onScanAgain?: () => void;
}

export const InvalidDiningQRView: React.FC<InvalidDiningQRViewProps> = ({
  errorReason = 'This QR code is not valid for dining.',
  onScanAgain,
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 font-sans">
      <div className="bg-[#fcfbf7] rounded-3xl border border-[#DDD8C9] shadow-2xl p-6 sm:p-8 text-center space-y-6">
        
        {/* Brand Header */}
        <div className="border-b border-[#DDD8C9] pb-4">
          <div className="bg-white p-3 rounded-2xl shadow-xs border border-[#DDD8C9] inline-block mx-auto max-w-[240px]">
            <img
              src="/palilogo.png"
              alt="Pali Resort & Club • Pali Village"
              className="h-14 sm:h-16 w-auto object-contain mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Warning Icon Badge */}
        <div className="w-20 h-20 mx-auto rounded-2xl bg-[#163024]/5 border-2 border-dashed border-[#526B4A]/30 flex items-center justify-center relative">
          <QrCode className="w-10 h-10 text-[#526B4A]" />
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-md">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Invalid QR Title & Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-serif text-[#163024] tracking-tight">
            INVALID DINING QR
          </h1>
          <p className="text-sm font-semibold text-[#1D241F]">
            {errorReason}
          </p>
          <p className="text-xs text-[#687067] leading-relaxed">
            The scanned QR code is either missing, expired, or does not resolve to an authorized dining table at Pali Resort & Club. Please scan the official physical QR standee on your dining table.
          </p>
        </div>

        {/* Scan Again Action */}
        <div className="pt-2 space-y-3">
          <button
            id="btn-scan-qr-again"
            onClick={() => {
              if (onScanAgain) onScanAgain();
            }}
            className="w-full py-3.5 px-5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#C5A86A]" />
            <span>RETRY / RESCAN QR</span>
          </button>

          <p className="text-[11px] text-[#687067] font-medium">
            Need assistance? Please inform your table captain or restaurant staff.
          </p>
        </div>

      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { Utensils, RefreshCw, Clock } from 'lucide-react';

interface TableNotOpenViewProps {
  tableNumber?: string;
  outletName?: string;
  onRetry: () => void;
  onOpenTable?: () => Promise<void> | void;
}

export const TableNotOpenView: React.FC<TableNotOpenViewProps> = ({
  tableNumber,
  outletName,
  onRetry,
  onOpenTable,
}) => {
  const [isOpening, setIsOpening] = React.useState(false);
  const onRetryRef = useRef(onRetry);
  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  // Automatically poll every 5 seconds to check if table has been seated/opened
  useEffect(() => {
    const timer = setInterval(() => {
      onRetryRef.current();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenClick = async () => {
    if (!onOpenTable || isOpening) return;
    setIsOpening(true);
    try {
      await onOpenTable();
    } finally {
      setIsOpening(false);
    }
  };

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

        {/* Waiting Icon Badge */}
        <div className="w-20 h-20 mx-auto rounded-2xl bg-[#163024]/5 border-2 border-dashed border-[#526B4A]/30 flex items-center justify-center relative">
          <Utensils className="w-10 h-10 text-[#526B4A]" />
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-md">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Table & Status Title */}
        <div className="space-y-2">
          {tableNumber && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#163024]/5 border border-[#163024]/10 text-xs font-semibold text-[#163024]">
              <span>Table {tableNumber}</span>
              {outletName && <span>• {outletName}</span>}
            </div>
          )}
          <h1 className="text-2xl font-bold font-serif text-[#163024] tracking-tight">
            TABLE NOT OPEN YET
          </h1>
          <p className="text-sm font-semibold text-[#1D241F]">
            Your table isn't open yet. Please ask your steward to seat you.
          </p>
          <p className="text-xs text-[#687067] leading-relaxed">
            Once your steward opens your dining session, this page will automatically refresh so you can view the menu and place your order.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-3">
          {onOpenTable && (
            <button
              id="btn-open-table-guest"
              onClick={handleOpenClick}
              disabled={isOpening}
              className="w-full py-3.5 px-5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Utensils className="w-4 h-4 text-[#C5A86A]" />
              <span>{isOpening ? 'OPENING TABLE...' : 'OPEN TABLE & START ORDERING'}</span>
            </button>
          )}

          <button
            id="btn-check-table-again"
            onClick={onRetry}
            className="w-full py-3 px-5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#526B4A]" />
            <span>CHECK AGAIN</span>
          </button>

          <p className="text-[11px] text-[#687067] font-medium">
            Checking automatically every 5 seconds...
          </p>
        </div>

      </div>
    </div>
  );
};

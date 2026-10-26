import React from 'react';
import { AggregatedProductionItem } from '../../types';
import { X, Clock, Layers, User, Hash, Utensils, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ProductionTraceModalProps {
  item: AggregatedProductionItem;
  onClose: () => void;
}

export const ProductionTraceModal: React.FC<ProductionTraceModalProps> = ({ item, onClose }) => {
  return (
    <div
      id="production-trace-modal"
      className="fixed inset-0 z-50 bg-[#163024]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-[#DDD8C9] shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#DDD8C9] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#163024] text-[#F7F4EC] text-[11px] font-black uppercase tracking-wider">
                {item.serviceType === 'takeaway' ? 'Take Away' : 'Dine In'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#526B4A]/15 text-[#526B4A] text-[11px] font-bold">
                {item.stationName}
              </span>
              <span className="text-xs font-mono font-bold text-[#687067]">
                Portion: {item.portion || 'Regular'}
              </span>
            </div>
            <h3 className="text-xl font-serif font-black text-[#163024]">
              {item.menuItemName}
            </h3>
            <p className="text-xs text-[#687067]">
              Backend Order Traceability • Aggregated {item.totalActive} active portion{item.totalActive > 1 ? 's' : ''} across {item.orderRefs.length} order{item.orderRefs.length > 1 ? 's' : ''}
            </p>
          </div>

          <button
            id="btn-close-trace"
            onClick={onClose}
            className="p-2 rounded-xl text-[#687067] hover:text-[#163024] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aggregated Totals Banner */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-[#F7F4EC] rounded-2xl border border-[#DDD8C9] text-center font-mono">
          <div className="p-2 rounded-xl bg-white border border-[#C5A86A]/40">
            <span className="text-[10px] text-[#687067] font-sans font-bold uppercase block">Pending</span>
            <span className="text-xl font-black text-[#C5A86A]">{item.quantityPending}</span>
          </div>
          <div className="p-2 rounded-xl bg-white border border-[#526B4A]/40">
            <span className="text-[10px] text-[#687067] font-sans font-bold uppercase block">Preparing</span>
            <span className="text-xl font-black text-[#526B4A]">{item.quantityPreparing}</span>
          </div>
          <div className="p-2 rounded-xl bg-white border border-[#163024]/40">
            <span className="text-[10px] text-[#687067] font-sans font-bold uppercase block">Ready</span>
            <span className="text-xl font-black text-[#163024]">{item.quantityReady}</span>
          </div>
        </div>

        {/* Underlying Order Records (Traceability List - Section 6 & 30) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#163024]">
            <span>Underlying Linked Orders ({item.orderRefs.length})</span>
            <span className="text-[10px] text-[#526B4A] font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Order-level links intact
            </span>
          </div>

          {item.orderRefs.map((ref, idx) => (
            <div
              key={ref.orderItemId || idx}
              className="p-4 rounded-2xl bg-white border border-[#DDD8C9] space-y-2 hover:border-[#163024]/40 transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#163024] text-[#F7F4EC] text-xs font-mono font-black">
                    {ref.orderNumber || `#${ref.orderId}`}
                  </span>
                  <span className="text-xs font-bold text-[#163024]">
                    {ref.serviceType === 'takeaway'
                      ? 'Take Away (Counter Pickup)'
                      : ref.tableNumber
                      ? `Table ${ref.tableNumber}`
                      : ref.roomNumber || 'Dine-In'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                    Pending: {ref.quantityPending}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                    Prep: {ref.quantityPreparing}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-900 border border-green-300">
                    Ready: {ref.quantityReady}
                  </span>
                </div>
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/60">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-[#526B4A]" />
                  <span>Guest: <strong>{ref.customerName || 'Walk-In'}</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <Utensils className="w-3 h-3 text-[#526B4A]" />
                  <span>Server: <strong>{ref.waiterName || 'Staff'}</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#526B4A]" />
                  <span>Punched: <strong>{ref.createdAt}</strong></span>
                </div>
              </div>

              {/* Special Instructions or Allergens */}
              {ref.specialInstructions && (
                <div className="text-[11px] bg-[#F7F4EC] p-2 rounded-xl text-[#163024] font-medium flex items-center gap-1.5 border border-[#DDD8C9]">
                  <AlertTriangle className="w-3 h-3 text-[#C5A86A] shrink-0" />
                  <span>Notes: {ref.specialInstructions}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#DDD8C9] flex items-center justify-between text-xs">
          <span className="text-[#687067]">
            Deterministic FIFO allocation applies when preparing or marking ready.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#163024] hover:bg-[#244737] text-[#F7F4EC] font-bold transition-colors cursor-pointer"
          >
            Close Trace
          </button>
        </div>
      </div>
    </div>
  );
};

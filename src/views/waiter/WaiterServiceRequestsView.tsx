import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BellRing,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Plus,
  RotateCcw,
  Sparkles,
  Eye,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface WaiterServiceRequestsViewProps {
  onSelectTableByNumber: (tableNumber: string) => void;
  onPunchOrderForTable: (tableNumber: string) => void;
}

export const WaiterServiceRequestsView: React.FC<WaiterServiceRequestsViewProps> = ({
  onSelectTableByNumber,
  onPunchOrderForTable
}) => {
  const { waiterRequests, resolveWaiterRequest, tables, restaurantSyncError, refreshRestaurantData } = useApp();

  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    return waiterRequests.filter(req => {
      if (filter === 'pending' && req.status !== 'pending') return false;
      if (filter === 'resolved' && req.status !== 'resolved') return false;
      return true;
    });
  }, [waiterRequests, filter]);

  const handleResolve = async (reqId: string, reqType: string, tableNum: string) => {
    const result=await resolveWaiterRequest(reqId);
    if(!result.success) {setActionNotice(result.error || 'Service request update failed.');return;}
    setActionNotice(`Request "${reqType}" for Table ${tableNum} marked resolved.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-base text-[#163024] font-serif">
            Guest Table Service Calls
          </h3>
          <p className="text-xs text-[#687067]">
            Real-time notifications sent from guests via table QR or digital assistants.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {(['pending', 'resolved', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'bg-[#F7F4EC] hover:bg-[#DDD8C9]/40 text-[#1D241F] border border-[#DDD8C9]'
              }`}
            >
              {tab} ({waiterRequests.filter(r => tab === 'all' || r.status === tab).length})
            </button>
          ))}
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-[#2D5A3D] text-white text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#C5A86A]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Requests List */}
      {restaurantSyncError ? (
        <div className="bg-rose-50/60 p-12 rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h4 className="font-bold text-sm text-rose-900">Failed to load service requests</h4>
          <p className="text-xs text-rose-700 max-w-sm mx-auto">
            {restaurantSyncError}
          </p>
          <button
            onClick={() => refreshRestaurantData()}
            className="mt-2 px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Retry Loading Requests</span>
          </button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#DDD8C9] text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-[#526B4A] mx-auto" />
          <h4 className="font-bold text-sm text-[#163024]">All Clear!</h4>
          <p className="text-xs text-[#687067]">
            No pending service requests currently in the queue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const isPending = req.status === 'pending';
            const table = tables.find(t => t.number === req.tableNumber || t.id === req.tableId);

            return (
              <div
                key={req.id}
                className={`bg-white border rounded-2xl p-4 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isPending
                    ? 'border-[#B45309]/40 bg-[#B45309]/5'
                    : 'border-[#DDD8C9]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#163024] text-[#F7F4EC] flex items-center justify-center font-serif font-bold text-sm shrink-0">
                    {req.tableNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#163024]">
                        Table {req.tableNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isPending
                            ? 'bg-[#B45309] text-white animate-pulse'
                            : 'bg-[#526B4A]/20 text-[#526B4A]'
                        }`}
                      >
                        {req.requestType}
                      </span>
                      <span className="text-[10px] text-[#687067]">
                        {table?.section || 'Dining Room'}
                      </span>
                    </div>

                    {req.notes && (
                      <p className="text-xs text-[#1D241F] mt-1 font-medium">
                        "{req.notes}"
                      </p>
                    )}

                    <span className="text-[10px] text-[#687067] flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-[#C5A86A]" />
                      Requested at {req.requestedAt || 'Just now'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onSelectTableByNumber(req.tableNumber)}
                    className="px-3 py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#526B4A]" />
                    <span>Table</span>
                  </button>

                  <button
                    onClick={() => onPunchOrderForTable(req.tableNumber)}
                    className="px-3 py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#526B4A]" />
                    <span>+ Order</span>
                  </button>

                  {isPending && (
                    <button
                      onClick={() => handleResolve(req.id, req.requestType, req.tableNumber)}
                      className="px-4 py-1.5 bg-[#2D5A3D] hover:bg-[#234730] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

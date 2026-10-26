import React, { useRef, useState } from 'react';
import { KitchenTicket, KitchenTicketStatus } from '../../types';
import {
  Clock,
  Flame,
  Check,
  Play,
  Sparkles,
  Truck,
  RotateCcw,
  XCircle,
  ShieldAlert,
  ChefHat,
  CheckSquare,
  Square,
  Wine,
  CookingPot,
  Coffee,
  Beer,
  Layers,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';

interface TicketCardProps {
  ticket: KitchenTicket;
  companionTickets?: KitchenTicket[];
  elapsedMinutes: number;
  onAdvanceStatus: (ticket: KitchenTicket) => Promise<{ success: boolean; error?: string } | void> | void;
  onToggleItem: (ticketId: string, itemId: string, currentDone: boolean) => Promise<{ success: boolean; error?: string } | void> | void;
  onRecall: (ticketId: string) => void;
  onCancel: (ticket: KitchenTicket) => void;
  isTvMode?: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  companionTickets = [],
  elapsedMinutes,
  onAdvanceStatus,
  onToggleItem,
  onRecall,
  onCancel,
  isTvMode = false
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const actionPending = useRef(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [pendingRetry, setPendingRetry] = useState<(() => Promise<void>) | null>(null);
  const isDelayed = ticket.status !== 'completed' && elapsedMinutes >= 15;
  const isUrgent = ticket.priority === 'urgent' || isDelayed;
  const isReady = ticket.status === 'ready';
  const isPreparing = ticket.status === 'preparing';
  const isAccepted = ticket.status === 'accepted';
  const isNew = ticket.status === 'new';
  const isCompleted = ticket.status === 'completed';

  // Station specific badge
  const getStationInfo = () => {
    switch (ticket.stationType) {
      case 'bar':
        return { label: 'Bar & Cellar', icon: Wine, tagColor: 'bg-[#C5A86A]/20 text-[#163024]' };
      case 'beverages':
        return { label: 'Beverages', icon: Coffee, tagColor: 'bg-[#526B4A]/20 text-[#163024]' };
      case 'drinks':
        return { label: 'Drinks Station', icon: Beer, tagColor: 'bg-[#C5A86A]/20 text-[#163024]' };
      case 'cooking':
      default:
        return { label: 'Cooking Line', icon: CookingPot, tagColor: 'bg-[#163024]/10 text-[#163024]' };
    }
  };

  const stationInfo = getStationInfo();
  const StationIcon = stationInfo.icon;

  // Next action badge
  const getActionConfig = () => {
    switch (ticket.status) {
      case 'new':
        return {
          label: 'Accept Order',
          icon: Check,
          color: 'bg-[#C5A86A] hover:bg-[#b39556] text-[#163024] font-black shadow-xs'
        };
      case 'accepted':
        return {
          label: ticket.stationType === 'bar' ? 'Start Mixing' : 'Start Cooking',
          icon: Play,
          color: 'bg-[#526B4A] hover:bg-[#43573c] text-white font-bold shadow-xs'
        };
      case 'preparing':
        return {
          label: 'Mark Ready for Service',
          icon: Sparkles,
          color: 'bg-[#163024] hover:bg-[#204533] text-[#F7F4EC] font-black border border-[#C5A86A]/40 shadow-md'
        };
      case 'ready':
        return {
          label: 'Bump / Handover',
          icon: Truck,
          color: 'bg-[#526B4A] hover:bg-[#3f5338] text-white font-black'
        };
      default:
        return null;
    }
  };

  const action = getActionConfig();

  const handleAdvanceClick = async () => {
    if (actionPending.current) return;
    actionPending.current = true;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await onAdvanceStatus(ticket);
      if (res && typeof res === 'object' && res.success === false) {
        setErrorMessage(res.error || 'Failed to update ticket status on server');
        setPendingRetry(() => handleAdvanceClick);
      } else {
        setPendingRetry(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update ticket status on server');
      setPendingRetry(() => handleAdvanceClick);
    } finally {
      actionPending.current = false;
      setIsUpdating(false);
    }
  };

  const handleToggleItemClick = async (itemId: string, isItemDone: boolean) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await onToggleItem(ticket.id, itemId, !isItemDone);
      if (res && typeof res === 'object' && res.success === false) {
        setErrorMessage(res.error || 'Failed to update item status on server');
        setPendingRetry(() => () => handleToggleItemClick(itemId, isItemDone));
      } else {
        setPendingRetry(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update item status on server');
      setPendingRetry(() => () => handleToggleItemClick(itemId, isItemDone));
    } finally {
      actionPending.current = false;
      setIsUpdating(false);
    }
  };

  // Color theme based strictly on Pali Resort branding (No Blue!)
  const cardBorder = isDelayed
    ? 'border-[#C53030] ring-2 ring-[#C53030]/40 shadow-lg'
    : isUrgent
    ? 'border-[#C5A86A] ring-2 ring-[#C5A86A]/40'
    : isReady
    ? 'border-[#526B4A] ring-2 ring-[#526B4A]/30 bg-[#F7F4EC]/40'
    : isPreparing
    ? 'border-[#163024]/40 bg-white'
    : isAccepted
    ? 'border-[#DDD8C9] bg-white'
    : isNew
    ? 'border-[#C5A86A] ring-1 ring-[#C5A86A]/40 bg-[#F7F4EC]/20'
    : 'border-[#DDD8C9] opacity-85';

  return (
    <div
      id={`kds-card-${ticket.id}`}
      className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md h-full min-w-0 ${cardBorder} ${
        isTvMode ? 'text-base' : 'text-xs'
      }`}
    >
      {/* Server Error Alert Banner with Retry */}
      {errorMessage && (
        <div
          id={`ticket-error-${ticket.id}`}
          className="bg-rose-50 border-b-2 border-rose-400 px-3 py-2 flex items-center justify-between gap-2 text-rose-900"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-[11px] font-bold truncate" title={errorMessage}>
              {errorMessage}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {pendingRetry && (
              <button
                type="button"
                id={`btn-retry-${ticket.id}`}
                onClick={() => pendingRetry()}
                disabled={isUpdating}
                className="px-2 py-0.5 bg-[#163024] hover:bg-[#0f2219] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3 h-3 text-[#C5A86A] ${isUpdating ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => { setErrorMessage(null); setPendingRetry(null); }}
              className="p-1 text-rose-600 hover:text-rose-900 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Bar */}
      <div
        className={`p-3.5 border-b ${
          isDelayed
            ? 'bg-rose-50/90 border-[#C53030]/30 text-rose-950'
            : isUrgent
            ? 'bg-amber-50/90 border-[#C5A86A]/40 text-amber-950'
            : isReady
            ? 'bg-[#163024]/10 border-[#526B4A]/30 text-[#163024]'
            : isPreparing
            ? 'bg-[#F7F4EC] border-[#DDD8C9] text-[#163024]'
            : isAccepted
            ? 'bg-[#F7F4EC]/70 border-[#DDD8C9] text-[#163024]'
            : isNew
            ? 'bg-[#F7F4EC] border-[#C5A86A]/40 text-[#163024]'
            : 'bg-stone-50 border-[#DDD8C9] text-stone-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            {/* Top row badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-mono font-black tracking-tight ${
                  isTvMode ? 'text-lg' : 'text-sm'
                } text-[#163024]`}
              >
                {ticket.orderNumber || `#${ticket.id}`}
              </span>

              {/* Station Tag */}
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border border-[#DDD8C9] ${stationInfo.tagColor}`}
              >
                <StationIcon className="w-3 h-3" />
                {stationInfo.label}
              </span>

              {/* Delay Pill */}
              {isDelayed && (
                <span className="px-2 py-0.5 rounded bg-[#C53030] text-white text-[9px] font-black uppercase flex items-center gap-1 animate-pulse">
                  <Flame className="w-3 h-3" />
                  DELAY {elapsedMinutes}m
                </span>
              )}

              {ticket.priority === 'urgent' && !isDelayed && (
                <span className="px-2 py-0.5 rounded bg-[#C53030] text-white text-[9px] font-black uppercase">
                  VIP / URGENT
                </span>
              )}

              {ticket.orderType && (
                <span className="px-1.5 py-0.5 rounded bg-white text-[#163024] border border-[#DDD8C9] text-[9px] font-bold uppercase">
                  {ticket.orderType}
                </span>
              )}
            </div>

            {/* Destination / Table */}
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`font-black text-[#163024] tracking-tight ${
                  isTvMode ? 'text-2xl' : 'text-base'
                }`}
              >
                {ticket.tableNumber ? `Table ${ticket.tableNumber}` : ticket.destination || 'Room / Counter'}
              </span>
              {ticket.station && (
                <span className="text-[10px] font-semibold text-[#526B4A]">
                  • {ticket.station}
                </span>
              )}
            </div>

            {/* Server / Guest */}
            <div className="text-[10px] text-[#687067] flex items-center gap-2 mt-0.5">
              {ticket.waiterName && (
                <span>
                  Waiter: <strong className="text-[#163024]">{ticket.waiterName}</strong>
                </span>
              )}
              {ticket.guestName && (
                <span>
                  • Guest: <strong className="text-[#163024]">{ticket.guestName}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Status pill & Timer */}
          <div className="text-right shrink-0">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs inline-block ${
                isReady
                  ? 'bg-[#163024] text-[#F7F4EC] border border-[#C5A86A]'
                  : isPreparing
                  ? 'bg-[#526B4A] text-white'
                  : isAccepted
                  ? 'bg-[#DDD8C9] text-[#163024]'
                  : isNew
                  ? 'bg-[#C5A86A] text-[#163024]'
                  : 'bg-stone-300 text-stone-800'
              }`}
            >
              {ticket.status === 'completed' ? 'Delivered' : ticket.status}
            </span>

            <div
              className={`text-xs font-mono mt-1 flex items-center gap-1 justify-end font-bold ${
                isDelayed
                  ? 'text-[#C53030] font-black animate-pulse'
                  : elapsedMinutes >= 10
                  ? 'text-amber-700'
                  : 'text-[#687067]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{elapsedMinutes}m elapsed</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Allergen Alert Banner */}
      {ticket.allergens && ticket.allergens.length > 0 && (
        <div className="bg-rose-50 border-b border-[#C53030]/20 px-3.5 py-1.5 flex items-center gap-1.5 flex-wrap">
          <ShieldAlert className="w-3.5 h-3.5 text-[#C53030] shrink-0" />
          <span className="text-[10px] font-black text-[#C53030] tracking-wider uppercase">
            ALLERGEN ALERT:
          </span>
          {ticket.allergens.map((alg, aIdx) => (
            <span
              key={aIdx}
              className="px-1.5 py-0.5 rounded bg-[#C53030] text-white text-[9px] font-black uppercase"
            >
              {alg}
            </span>
          ))}
        </div>
      )}

      {/* 3. Special Instructions / Chef Notes */}
      {ticket.specialInstructions && (
        <div className="bg-[#F7F4EC] border-b border-[#DDD8C9] px-3.5 py-2 flex items-start gap-2">
          <ChefHat className="w-4 h-4 text-[#C5A86A] shrink-0 mt-0.5" />
          <div className="text-[11px] text-[#163024] leading-tight">
            <strong className="font-bold text-[#163024]">Kitchen Note: </strong>
            <span>{ticket.specialInstructions}</span>
          </div>
        </div>
      )}

      {/* 4. Companion Stations Info (For Mixed Orders - Section 24 & 26) */}
      {companionTickets.length > 0 && (
        <div className="bg-[#F7F4EC]/60 border-b border-[#DDD8C9] px-3.5 py-1.5 text-[10px] flex items-center gap-1.5 flex-wrap">
          <Layers className="w-3 h-3 text-[#526B4A] shrink-0" />
          <span className="font-bold text-[#163024]">Multi-Station Order:</span>
          {companionTickets.map(comp => (
            <span
              key={comp.id}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${
                comp.status === 'ready'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                  : comp.status === 'preparing'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-stone-50 text-stone-600 border-stone-200'
              }`}
            >
              {comp.stationType || comp.station}: {comp.status} ({comp.items.length} items)
            </span>
          ))}
        </div>
      )}

      {/* 5. Items Checklist */}
      <div
        className={`p-3.5 space-y-2 flex-1 overflow-y-auto ${
          isTvMode ? 'max-h-96' : 'max-h-60'
        }`}
      >
        {ticket.items.map((item, idx) => {
          const isItemDone = item.completed || item.status === 'ready';
          return (
            <div
              key={item.id || idx}
              className={`flex items-start justify-between py-1.5 px-2.5 rounded-xl cursor-pointer transition-all border ${
                isItemDone
                  ? 'bg-stone-100 border-stone-200 line-through text-stone-400'
                  : 'bg-[#F7F4EC]/40 hover:bg-[#F7F4EC] border-transparent hover:border-[#DDD8C9] text-[#163024]'
              }`}
              title="Click to check off prepared item"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  aria-label={`Toggle preparation of ${item.name}`}
                  disabled={isUpdating || isCompleted || item.status === "cancelled"}
                  onClick={() => void handleToggleItemClick(item.id, isItemDone)}
                  className="mt-0.5 text-[#526B4A] shrink-0"
                >
                  {isItemDone ? (
                    <CheckSquare className="w-4 h-4 text-[#526B4A]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#DDD8C9] hover:text-[#163024]" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                      title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                    />
                    <span
                      className={`font-bold truncate ${
                        isTvMode ? 'text-base' : 'text-xs'
                      } ${isItemDone ? 'text-stone-400' : 'text-[#163024]'}`}
                    >
                      {item.name}
                    </span>
                    {item.portion && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-white text-[#526B4A] border border-[#DDD8C9]">
                        {item.portion}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-[10px] text-amber-800 font-medium italic mt-0.5 ml-3.5 break-words">
                      📝 {item.notes}
                    </p>
                  )}
                </div>
              </div>

              <span
                className={`font-black font-mono px-2 py-0.5 rounded ml-2 shrink-0 ${
                  isTvMode ? 'text-sm' : 'text-xs'
                } ${
                  isItemDone
                    ? 'bg-stone-200 text-stone-500'
                    : 'bg-[#163024] text-[#F7F4EC] shadow-2xs'
                }`}
              >
                x{item.quantity}
              </span>
            </div>
          );
        })}
      </div>

      {/* 6. Footer Controls */}
      <div className="p-3 bg-[#F7F4EC] border-t border-[#DDD8C9] flex items-center justify-between gap-2">
        {action && !isCompleted ? (
          <button
            id={`btn-advance-${ticket.id}`}
            onClick={handleAdvanceClick}
            disabled={isUpdating}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isTvMode ? 'text-sm py-3' : 'text-xs'
            } ${action.color} ${isUpdating ? 'opacity-75 cursor-wait' : ''}`}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-current" />
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <action.icon className="w-4 h-4" />
                <span>{action.label}</span>
              </>
            )}
          </button>
        ) : isCompleted ? (
          <span className="text-xs font-bold text-[#526B4A] flex items-center gap-1">
            <Check className="w-4 h-4 text-emerald-600" />
            Order Plated & Delivered
          </span>
        ) : null}

        {/* Recall and Cancel Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isCompleted && ticket.status !== 'new' && (
            <button
              id={`btn-recall-${ticket.id}`}
              disabled
              title="Ticket rollback is unavailable. Use item preparation controls before handover."
              className="p-2 text-[#526B4A] hover:text-[#163024] hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#DDD8C9]"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {!isCompleted && (
            <button
              id={`btn-cancel-${ticket.id}`}
              disabled={isUpdating}
              onClick={() => onCancel(ticket)}
              title="Cancel Ticket"
              className="p-2 text-[#687067] hover:text-[#C53030] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

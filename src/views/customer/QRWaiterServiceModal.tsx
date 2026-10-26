import React, { useState } from 'react';
import { Bell, Droplets, Receipt, Utensils, Sparkles, X, CheckCircle2, GlassWater } from 'lucide-react';
import { api } from '../../api/client';

interface QRWaiterServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  guestName: string;
}

export const QRWaiterServiceModal: React.FC<QRWaiterServiceModalProps> = ({
  isOpen,
  onClose,
  tableNumber,
  guestName,
}) => {
  const [selectedType, setSelectedType] = useState<string>('CALL_WAITER');
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requestError,setRequestError]=useState<string | null>(null);
  const [activeRequests, setActiveRequests] = useState<Array<{
    id: string;
    requestType: string;
    status: string;
    createdAt: string;
    acknowledgedByName?: string | null;
  }>>([]);

  const loadActiveRequests = async () => {
    try {
      const res = await api.guestListServiceRequests();
      setActiveRequests(res.items || []);
    } catch (err: any) {
      setRequestError(err?.message || 'Unable to load your service requests. Please retry.');
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      loadActiveRequests();
    }
  }, [isOpen]);

  if (!isOpen) return null;


  const serviceOptions = [
    {
      id: 'CALL_WAITER',
      title: 'Call Captain',
      description: 'Your table captain will arrive at your table momentarily',
      icon: Bell,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      id: 'WATER',
      title: 'Water Refill',
      description: 'Chilled or regular R.O. purified drinking water',
      icon: Droplets,
      color: 'text-sky-700 bg-sky-50 border-sky-200',
    },
    {
      id: 'CUTLERY',
      title: 'Cutlery & Napkins',
      description: 'Additional plates, spoons, forks or sanitizing wipes',
      icon: Utensils,
      color: 'text-stone-700 bg-stone-50 border-stone-200',
    },
    {
      id: 'CLEANING',
      title: 'Table Cleaning',
      description: 'Clean table surface or clear empty plates and glasses',
      icon: Sparkles,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'BILL',
      title: 'Bill & Settlement',
      description: 'Review invoice & pay via UPI, Card, Cash or Room charge',
      icon: Receipt,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
  ];

  const handleSendRequest = async () => {
    if(isSubmitting) return;
    setRequestError(null);setIsSubmitting(true);
    const chosenOption = serviceOptions.find(o => o.id === selectedType);
    const fullNote = customNote.trim()
      ? `${chosenOption?.title}: ${customNote}`
      : chosenOption?.title || 'Hospitality Assistance';

    try {
      await api.guestCreateServiceRequest(selectedType as any);
      setSuccessMessage(`Captain notified for Table ${tableNumber}! Service request dispatched to server.`);
      await loadActiveRequests();
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMessage(null);
        setCustomNote('');
        onClose();
      }, 1600);
    } catch (e:any) {setRequestError(e.detail || e.message || 'Unable to send service request.');setIsSubmitting(false);}

  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div className="bg-[#fcfbf7] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e1cf] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom duration-200">
        
        {requestError && <p role="alert" className="text-red-700 p-4">{requestError}</p>}
        {/* Header with Forest Green Accent */}
        <div className="bg-[#1b382b] text-[#f7f4ec] px-5 py-4 flex items-center justify-between border-b border-[#2b4d3c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a]/40 flex items-center justify-center text-[#dfc78f]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold tracking-wide">Resort Guest Assistance</h3>
              <p className="text-[11px] text-[#dfc78f] font-sans">
                Table {tableNumber} • Dedicated Dining Service
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {successMessage ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 bg-[#1b382b] text-[#c5a86a] rounded-full mx-auto flex items-center justify-center shadow-md animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-lg font-bold text-[#1b382b]">Service Dispatched</h4>
              <p className="text-xs text-stone-600 max-w-xs mx-auto leading-relaxed">
                {successMessage}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-stone-600 leading-relaxed font-sans">
                Select your required hospitality service and our steward will attend to your table immediately.
              </p>

              {/* Service Options List */}
              <div className="space-y-2">
                {serviceOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = selectedType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedType(opt.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 ${
                        isSelected
                          ? 'border-[#1b382b] bg-[#1b382b]/5 ring-1 ring-[#1b382b] shadow-xs'
                          : 'border-[#e8e1cf] bg-white hover:border-[#c5a86a]/60'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${opt.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-sans font-semibold text-xs text-stone-900">{opt.title}</h4>
                          {isSelected && (
                            <span className="text-[10px] uppercase font-bold text-[#1b382b] tracking-wider bg-[#1b382b]/10 px-2 py-0.5 rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{opt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Instructions Input */}
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5 font-sans">
                  Special Notes for Captain (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra spicy mint dip, lime wedges, warm water..."
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#e8e1cf] focus:border-[#1b382b] rounded-xl text-xs text-stone-800 outline-none transition-colors"
                />
              </div>

              {/* Active Table Requests from Server */}
              {activeRequests.length > 0 && (
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Active Requests for Table {tableNumber}
                  </span>
                  <div className="space-y-1.5">
                    {activeRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-stone-200">
                        <span className="font-semibold text-stone-800">
                          {req.requestType.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === 'ACKNOWLEDGED'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : req.status === 'RESOLVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {req.status === 'ACKNOWLEDGED' && req.acknowledgedByName
                            ? `Attending: ${req.acknowledgedByName}`
                            : req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Button */}
              <button
                type="button"
                onClick={handleSendRequest}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#1b382b] hover:bg-[#152e23] active:scale-[0.99] text-[#f7f4ec] font-sans font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 border border-[#c5a86a]/40 transition-all cursor-pointer disabled:opacity-60"
              >
                <Bell className="w-4 h-4 text-[#c5a86a]" />
                <span>{isSubmitting ? 'Paging Service Staff...' : 'Call Table Captain Now'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

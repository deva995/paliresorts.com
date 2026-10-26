import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api, generateIdempotencyKey } from '../../api/client';
import { convertOutletMenuResponse } from '../../api/menuAdapter';
import { rupeesToPaise } from '../../utils/currency';
import type { RestaurantTable, MenuItem, SettlementRequest } from '../../types';
import {
  CreditCard,
  Receipt,
  Search,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Printer,
  RefreshCw,
  Store,
  DollarSign,
  Coffee,
  Check,
  X,
  Tag,
  ShieldAlert
} from 'lucide-react';

const money = (value: number) => `INR ${(Number(value) / 100).toFixed(2)}`;

export const CashierViews: React.FC = () => {
  const { activeRestaurantId, currentUser, settlementRequests, fetchSettlementRequests } = useApp();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const outlet = currentUser.role === 'SUPER_ADMIN' ? activeRestaurantId : (currentUser.restaurantId || activeRestaurantId);

  // Billing state
  const [bills, setBills] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [served, setServed] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [tableId, setTableId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});

  // Payment form state
  const [cash, setCash] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [discount, setDiscount] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDescription, setReasonDescription] = useState('');
  const [refund, setRefund] = useState('');
  const [register, setRegister] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actionBusy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const busy = actionBusy || loading;
  const running = useRef(false);
  const keys = useRef(new Map<string, string>());
  const generation = useRef(0);
  const selection = useRef(0);

  const key = (identity: string) => {
    if (!keys.current.has(identity)) keys.current.set(identity, generateIdempotencyKey());
    return keys.current.get(identity)!;
  };

  async function load() {
    const version = ++generation.current;
    setLoading(true);
    const paths = [
      `/outlets/${outlet}/bills?limit=100`,
      `/outlets/${outlet}/orders?limit=100`,
      `/outlets/${outlet}/discount-reasons`,
      `/outlets/${outlet}/payments?limit=100`,
      `/outlets/${outlet}/tables`,
      `/outlets/${outlet}/menu`
    ];
    const reads = [
      ['bill:view', 'billing'],
      ['order:view', 'orders'],
      ['bill:view', 'billing'],
      ['bill:view', 'billing'],
      ['table:view', 'floor'],
      ['menu:view', 'menu']
    ];
    const allowed = reads.map(
      ([permission, module]) =>
        currentUser.role === 'SUPER_ADMIN' ||
        (((currentUser.permissions || []).includes(permission)) && currentUser.moduleAccess?.[module]?.canView === true)
    );

    try {
      const results = await Promise.allSettled(
        paths.map((path, index) => (allowed[index] ? api.request(path) : Promise.resolve(null)))
      );
      if (version !== generation.current) return;
      const data = results.map((result) => (result.status === 'fulfilled' ? result.value : null));

      if (data[0]) setBills(data[0].bills || []);
      if (data[1]) {
        setServed(
          (data[1].orders || data[1].items || []).filter(
            (o: any) =>
              o.orderSource === 'COUNTER_POS' &&
              ['READY', 'SERVED'].includes(o.status) &&
              !o.items?.some((i: any) =>
                (data[0]?.bills || []).some((b: any) => b.status !== 'VOIDED' && b.items?.some((bi: any) => bi.orderItemId === i.id))
              )
          )
        );
      }
      if (data[2]) setReasons(data[2]);
      if (data[3]) setRegister(data[3]);
      if (data[4]) {
        setTables(
          (data[4].tables || data[4].items || []).map((t: any) => ({
            id: t.id,
            number: t.tableNumber,
            restaurantId: t.outletId,
            capacity: t.capacity,
            status: t.status?.toLowerCase(),
            section: t.zoneName || '',
            activeSessionId: t.activeSessionId || t.activeSession?.id
          }))
        );
      }
      if (data[5]) setMenuItems(convertOutletMenuResponse(data[5]).items);

      // Also refresh live settlement requests from Phase 2/3
      if (fetchSettlementRequests) {
        fetchSettlementRequests().catch(() => {});
      }

      const failures = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [['Saved invoices', 'Counter orders', 'Discount reasons', 'Payment register', 'Checkout tables', 'Counter menu'][index] + ': ' + (result.reason.detail || result.reason.message || 'Could not refresh.')]
          : []
      );
      if (failures.length) setError(failures.join(' '));
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }

  async function selectBill(id: string) {
    const version = ++selection.current;
    const epoch = generation.current;
    const [value, pays, queue] = await Promise.all([
      api.request(`/bills/${id}`),
      api.request(`/bills/${id}/payments`),
      api.request(`/bills/${id}/discount-requests`)
    ]);
    if (version !== selection.current || epoch !== generation.current) return;
    setBill(value);
    setPayments(pays);
    setRequests(queue);
    setCash('');
    setDiscount('');
    setReasonId('');
    setConfirmed(false);
    setPreview(null);
  }

  async function action(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e: any) {
      setError(e.detail || e.message || 'Operation failed.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    setBill(null);
    setPreview(null);
    setTableId('');
    setCart({});
    setBills([]);
    setServed([]);
    setTables([]);
    setMenuItems([]);
    setReasons([]);
    setRegister(null);
    setPayments([]);
    setRequests([]);
    setError('');
    load().catch((e) => setError(e.message));
    return () => {
      generation.current++;
      selection.current++;
    };
  }, [outlet]);

  const table = tables.find((t) => t.id === tableId && t.restaurantId === outlet);
  const discountPaise = rupeesToPaise(discount);
  const cashPaise = rupeesToPaise(cash);
  const refundPaise = rupeesToPaise(refund);
  const discountValid = discountPaise !== null && discountPaise > 0 && discountPaise <= Number(bill?.subtotalPaise) && notes.trim().length > 0;
  const can = (permission: string) => currentUser.role === 'SUPER_ADMIN' || (currentUser.permissions || []).includes(permission);

  // Active pending settlement requests from waiters
  const pendingRequests = useMemo(() => {
    return (settlementRequests || []).filter((r: SettlementRequest) => r.status === 'PENDING' || r.status === 'ACCEPTED');
  }, [settlementRequests]);

  // Change calculation
  const changeDuePaise = useMemo(() => {
    if (!bill || cashPaise === null || cashPaise <= 0) return 0;
    return Math.max(0, cashPaise - Number(bill.balancePaise));
  }, [bill, cashPaise]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 font-sans text-slate-800">
      {/* 80mm Thermal Receipt Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .persisted-receipt, .persisted-receipt * {
            visibility: visible;
          }
          .persisted-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .persisted-receipt button,
          .persisted-receipt input,
          .persisted-receipt select,
          .persisted-receipt label,
          .persisted-receipt .print-hidden {
            display: none !important;
          }
          .persisted-receipt .thermal-header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .persisted-receipt .thermal-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .persisted-receipt .thermal-table th,
          .persisted-receipt .thermal-table td {
            padding: 2px 0;
          }
          .persisted-receipt .thermal-totals {
            border-top: 1px dashed #000;
            padding-top: 6px;
            margin-top: 6px;
          }
          .persisted-receipt .thermal-watermark {
            display: block !important;
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            margin: 6px 0;
            border: 1px solid #000;
            padding: 2px;
          }
        }
      `}</style>

      {/* Cashier POS Header */}
      <header className="sticky top-0 z-30 border-b border-[#DDD8C9] bg-[#163024] px-4 py-3 text-white shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C5A86A] text-[#163024] font-bold shadow-xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#F7F4EC]">Cashier & Billing</h1>
                <span className="rounded-full bg-[#C5A86A]/20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-[#C5A86A]">
                  Terminal #01
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                Outlet: <span className="font-semibold text-white">{outlet}</span> · Pali Resort & Club
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {pendingRequests.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 font-semibold text-amber-200 border border-amber-400/30 animate-pulse">
                <BellRing className="h-3.5 w-3.5 text-amber-300" />
                <span>{pendingRequests.length} Settlement Request{pendingRequests.length > 1 ? 's' : ''}</span>
              </div>
            )}

            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await load();
                  if (bill) await selectBill(bill.id);
                })
              }
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium text-[#F7F4EC] hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              <span>Refresh saved records</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Loading and Feedback Indicators */}
        {loading && <p role="status" className="text-xs font-semibold text-slate-500">Loading saved checkout records...</p>}

        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {message && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{message}</div>
            <button onClick={() => setMessage('')} className="text-emerald-400 hover:text-emerald-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <p className="p-3 bg-amber-50 text-xs rounded-xl border border-amber-200 text-amber-900 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
          <span>Online payments: BLOCKED — CLIENT API REQUIRED. Nonzero service charges are blocked pending accounting policy.</span>
        </p>

        {/* Real Metrics Banner */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Pending Requests</span>
              <BellRing className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">{pendingRequests.length}</div>
            <div className="text-[11px] text-slate-500">From floor staff</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Open Tables</span>
              <Store className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {tables.filter((t) => t.restaurantId === outlet && (t.status === 'occupied' || t.status === 'billed')).length}
            </div>
            <div className="text-[11px] text-slate-500">Occupied or billed</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Awaiting Payment</span>
              <Receipt className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {bills.filter((b) => b.status === 'DRAFT' || b.balancePaise > 0).length}
            </div>
            <div className="text-[11px] text-slate-500">Unsettled invoices</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Today's Collections</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {register ? money(register.totalAmountPaise) : 'INR 0.00'}
            </div>
            <div className="text-[11px] text-slate-500">Net recorded collections</div>
          </div>
        </div>

        {/* Dual-Column Split Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Operations, Table Checkout, Counter, Saved Bills (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            {/* Section 0: Live Waiter Settlement Requests Inbox */}
            {pendingRequests.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <BellRing className="h-4 w-4 text-amber-500" />
                    <span>Pending settlement requests</span>
                  </h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {pendingRequests.length} Active
                  </span>
                </div>

                <div className="space-y-2">
                  {pendingRequests.map((req: SettlementRequest) => (
                    <div
                      key={req.id}
                      className="rounded-lg border border-amber-200 bg-white p-3 shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[#163024] px-1.5 py-0.5 font-bold text-xs text-white">
                              {req.tableNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {req.invoiceNumber || 'Draft Bill'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            By <strong className="text-slate-700">{req.requestedByStaffName}</strong> · Preference:{' '}
                            <span className="font-semibold text-[#163024]">{req.paymentMethodPreference}</span>
                          </p>
                        </div>
                        <div className="text-right font-bold text-xs text-slate-900">
                          {money(req.grandTotalPaise)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              if (req.status === 'PENDING') {
                                await api.request(`/settlement-requests/${req.id}/status`, {
                                  method: 'POST',
                                  body: { status: 'ACCEPTED' }
                                });
                              }
                              if (req.billId) {
                                await selectBill(req.billId);
                              } else {
                                const existing = await api.request(`/dining-sessions/${req.diningSessionId}/bills`);
                                const active = existing.find((b: any) => b.status !== 'VOIDED');
                                if (active) {
                                  await selectBill(active.id);
                                } else if (can('bill:generate')) {
                                  const saved = await api.request(`/dining-sessions/${req.diningSessionId}/bills`, {
                                    method: 'POST',
                                    body: {},
                                    idempotencyKey: key(`generate:${req.diningSessionId}`)
                                  });
                                  await selectBill(saved.id);
                                  await load();
                                } else {
                                  throw new Error('Bill generation requires cashier billing permission.');
                                }
                              }
                              setMessage(`Settlement request for ${req.tableNumber} accepted.`);
                            })
                          }
                          className="flex-1 flex items-center justify-center gap-1 rounded bg-[#163024] py-1 text-xs font-bold text-white hover:bg-[#0f2219] cursor-pointer disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          <span>Accept & Open Bill</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Section 1: Table checkout */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-700" />
                <span>Table checkout</span>
              </h2>
              <label className="text-xs font-semibold text-slate-700 block">
                Table{' '}
                <select
                  aria-label="Checkout table"
                  value={tableId}
                  disabled={busy}
                  onChange={(e) => {
                    setTableId(e.target.value);
                    setPreview(null);
                    setBill(null);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-medium focus:border-[#163024] focus:outline-none"
                >
                  <option value="">Select a table</option>
                  {tables
                    .filter((t) => t.restaurantId === outlet && t.activeSessionId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.number}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={busy || !table?.activeSessionId}
                onClick={() =>
                  action(async () => {
                    const existing = await api.request(`/dining-sessions/${table!.activeSessionId}/bills`);
                    const active = existing.find((b: any) => b.status !== 'VOIDED');
                    if (active) {
                      await selectBill(active.id);
                    } else {
                      setPreview(await api.request(`/dining-sessions/${table!.activeSessionId}/bill-preview`));
                    }
                  })
                }
                className="w-full rounded-lg bg-[#163024] p-2 text-xs font-bold text-white hover:bg-[#0f2219] transition-all cursor-pointer disabled:opacity-50"
              >
                Load table bill
              </button>
              {preview && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-[#163024]">Preview total: {money(preview.grandTotalPaise)}</p>
                  <button
                    disabled={busy || !can('bill:generate')}
                    onClick={() =>
                      action(async () => {
                        const saved = await api.request(`/dining-sessions/${table!.activeSessionId}/bills`, {
                          method: 'POST',
                          body: {},
                          idempotencyKey: key(`generate:${table!.activeSessionId}`)
                        });
                        await selectBill(saved.id);
                        await load();
                        setMessage('Bill saved.');
                      })
                    }
                    className="w-full rounded-lg bg-[#C5A86A] p-2 text-xs font-bold text-[#163024] hover:bg-[#b89a58] transition-all cursor-pointer disabled:opacity-50"
                  >
                    Generate bill
                  </button>
                </div>
              )}
            </section>

            {/* Section 2: Counter orders */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Coffee className="h-4 w-4 text-emerald-700" />
                <span>Counter orders</span>
              </h2>
              <p className="text-xs text-slate-500">Counter orders must be prepared and served before billing.</p>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                {menuItems
                  .filter((m) => m.restaurantId === outlet && m.isAvailable)
                  .map((m) => (
                    <label
                      key={m.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 p-2 text-xs hover:border-slate-300 bg-slate-50/40"
                    >
                      <span className="font-semibold text-slate-800">{m.name}</span>
                      <span className="text-slate-500">{money(Math.round(m.price * 100))}</span>
                      <input
                        aria-label={`Counter quantity ${m.name}`}
                        type="number"
                        min="0"
                        max="99"
                        value={cart[m.id] || 0}
                        disabled={busy}
                        onChange={(e) => setCart({ ...cart, [m.id]: Number(e.target.value) })}
                        className="mt-1 w-full rounded border border-slate-200 bg-white p-1 text-center font-bold text-xs focus:border-[#163024] focus:outline-none"
                      />
                    </label>
                  ))}
              </div>
              <button
                disabled={busy || !can('order:counter_create') || !Object.values(cart).some((q) => Number(q) > 0)}
                onClick={() =>
                  action(async () => {
                    const items = Object.entries(cart)
                      .filter(([, q]) => Number(q) > 0)
                      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
                    const identity = `counter:${JSON.stringify(items)}`;
                    const order = await api.request(`/outlets/${outlet}/counter-orders`, {
                      method: 'POST',
                      body: { items },
                      idempotencyKey: key(identity)
                    });
                    keys.current.delete(identity);
                    setCart({});
                    await load();
                    setMessage(`Counter order ${order.orderNumber} saved and sent to kitchen.`);
                  })
                }
                className="w-full rounded-lg bg-[#163024] p-2 text-xs font-bold text-white hover:bg-[#0f2219] transition-all cursor-pointer disabled:opacity-50"
              >
                Send counter order
              </button>
              {served.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                >
                  <span className="font-semibold text-slate-800">
                    Counter order {order.orderNumber} - {order.status}
                  </span>
                  {order.status === 'READY' ? (
                    <button
                      disabled={busy || !can('order:counter_create')}
                      onClick={() =>
                        action(async () => {
                          await api.request(`/orders/${order.id}/counter-serve`, { method: 'POST', body: {} });
                          await load();
                          setMessage('Counter pickup saved.');
                        })
                      }
                      className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                    >
                      Confirm counter pickup {order.orderNumber}
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          const saved = await api.request(`/orders/${order.id}/bills`, {
                            method: 'POST',
                            body: {},
                            idempotencyKey: key(`counter-bill:${order.id}`)
                          });
                          await selectBill(saved.id);
                          await load();
                        })
                      }
                      className="rounded bg-[#163024] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#0f2219]"
                    >
                      Bill counter order {order.orderNumber}
                    </button>
                  )}
                </div>
              ))}
            </section>

            {/* Section 3: Configure discount reason (Manager / Admin) */}
            {['SUPER_ADMIN', 'RESTAURANT_OWNER'].includes(currentUser.role) && (
              <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-700" />
                  <span>Configure discount reason</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Use verified business reason codes. All discount requests require notes.
                </p>
                <label className="text-xs font-semibold text-slate-700 block">
                  Code{' '}
                  <input
                    aria-label="New discount reason code"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded border border-slate-200 bg-slate-50 p-1.5 text-xs uppercase focus:bg-white focus:outline-none"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 block">
                  Description{' '}
                  <input
                    aria-label="New discount reason description"
                    value={reasonDescription}
                    onChange={(e) => setReasonDescription(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 bg-slate-50 p-1.5 text-xs focus:bg-white focus:outline-none"
                  />
                </label>
                <button
                  disabled={busy || reasonCode.length < 2 || reasonDescription.trim().length < 3}
                  onClick={() =>
                    action(async () => {
                      await api.request(`/outlets/${outlet}/discount-reasons`, {
                        method: 'POST',
                        body: { code: reasonCode, description: reasonDescription }
                      });
                      await load();
                      setReasonCode('');
                      setReasonDescription('');
                      setMessage('Business discount reason saved.');
                    })
                  }
                  className="w-full rounded-lg bg-[#163024] p-2 text-xs font-bold text-white hover:bg-[#0f2219] transition-all cursor-pointer disabled:opacity-50"
                >
                  Save discount reason
                </button>
              </section>
            )}

            {/* Section 4: Saved bills */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-700" />
                <span>Saved bills</span>
              </h2>
              <p className="text-xs text-slate-500">
                Latest 100 invoices. Select an invoice to resume checkout or view its receipt.
              </p>
              <select
                aria-label="Saved invoice"
                disabled={busy}
                value={bill?.id || ''}
                onChange={(e) => e.target.value && action(() => selectBill(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-medium focus:border-[#163024] focus:outline-none"
              >
                <option value="">Select invoice</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.invoiceNumber} — {b.status} — {money(b.balancePaise)} balance
                  </option>
                ))}
              </select>
            </section>

            {/* Section 5: Payment register */}
            {register && (
              <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-xs">
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-700" />
                  <span>Payment register</span>
                </h2>
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 text-xs space-y-1">
                  <p className="font-semibold text-emerald-950">
                    Net collections for today's payment cohort, after processed refunds:{' '}
                    <strong className="text-emerald-800">{money(register.totalAmountPaise)}</strong>
                  </p>
                  <p className="text-slate-600">
                    Cash: <strong className="text-slate-900">{money(register.totalsByMethod?.CASH || 0)}</strong>
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Shift closing is unavailable until a persisted cash-drawer workflow is implemented.
                </p>
              </section>
            )}
          </div>

          {/* Right Column: Active Bill Receipt & Settlement Controls (7 cols) */}
          <div className="lg:col-span-7">
            {bill ? (
              <section
                className="persisted-receipt bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs"
                aria-label="Saved bill receipt"
              >
                {/* 80mm Thermal Print Watermark / Duplicate Label */}
                <div className="hidden thermal-watermark">
                  *** {bill.status === 'SETTLED' ? 'DUPLICATE COPY' : 'CUSTOMER RECEIPT'} ***
                </div>

                <div className="thermal-header text-center">
                  <h2 className="font-bold text-base tracking-wider uppercase text-slate-900">Invoice {bill.invoiceNumber}</h2>
                  <p className="text-xs text-slate-600 font-semibold">Status: {bill.status}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs thermal-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-1">Item</th>
                        <th className="pb-1 text-center">Qty</th>
                        <th className="pb-1 text-right">Saved price</th>
                        <th className="pb-1 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bill.items?.map((i: any) => (
                        <tr key={i.id} className="text-slate-700">
                          <td className="py-1.5 font-medium">{i.itemName}</td>
                          <td className="py-1.5 text-center">{i.quantity}</td>
                          <td className="py-1.5 text-right text-slate-500">{money(i.unitPricePaise)}</td>
                          <td className="py-1.5 text-right font-semibold text-slate-900">{money(i.totalPricePaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="thermal-totals rounded-lg bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-100">
                  <p className="text-slate-600">
                    Subtotal: {money(bill.subtotalPaise)} · Discount: {money(bill.discountPaise)} · CGST:{' '}
                    {money(bill.cgstPaise)} · SGST: {money(bill.sgstPaise)} · Rounding: {money(bill.roundingPaise)}
                  </p>
                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between font-bold text-sm text-slate-900">
                    <p data-testid="bill-total">Total: {money(bill.grandTotalPaise)}</p>
                    <p data-testid="bill-balance" className={bill.balancePaise > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                      Balance: {money(bill.balancePaise)}
                    </p>
                  </div>
                </div>

                {['DRAFT', 'APPROVED'].includes(bill.status) && bill.paidPaise === 0 && (
                  <div className="print-hidden rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs font-medium text-slate-700">
                        Discount in rupees{' '}
                        <input
                          aria-label="Discount amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          disabled={busy}
                          className="mt-1 w-full rounded border border-slate-200 bg-white p-1.5 text-xs focus:outline-none"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Reason{' '}
                        <select
                          aria-label="Discount reason"
                          value={reasonId}
                          onChange={(e) => setReasonId(e.target.value)}
                          disabled={busy}
                          className="mt-1 w-full rounded border border-slate-200 bg-white p-1.5 text-xs focus:outline-none"
                        >
                          <option value="">Select reason</option>
                          {reasons.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.description}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      disabled={busy || !can('bill:apply_discount') || !reasonId || !discountValid}
                      onClick={() =>
                        action(async () => {
                          await api.request(`/bills/${bill.id}/discount-requests`, {
                            method: 'POST',
                            body: { amountPaise: discountPaise, reasonCodeId: reasonId, notes }
                          });
                          await selectBill(bill.id);
                          setMessage('Discount requested. An independent checker must review it.');
                        })
                      }
                      className="rounded bg-[#163024] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0f2219] transition-all cursor-pointer disabled:opacity-50"
                    >
                      Request discount
                    </button>

                    {requests
                      .filter((r) => r.status === 'PENDING')
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-2 text-xs"
                        >
                          <span className="font-semibold text-amber-900">Pending discount {money(r.amountPaise)}</span>
                          {can('bill:approve_discount') && r.requestedByStaffId !== currentUser.id && (
                            <div className="flex gap-1.5">
                              {['APPROVED', 'REJECTED'].map((decision) => (
                                <button
                                  key={decision}
                                  disabled={busy || notes.trim().length < 3}
                                  onClick={() =>
                                    action(async () => {
                                      await api.request(`/bills/${bill.id}/discount-requests/${r.id}/review`, {
                                        method: 'POST',
                                        body: { decision, reason: notes }
                                      });
                                      await selectBill(bill.id);
                                    })
                                  }
                                  className={`rounded px-2 py-0.5 font-bold text-[11px] ${
                                    decision === 'APPROVED'
                                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                      : 'bg-red-700 text-white hover:bg-red-800'
                                  }`}
                                >
                                  {decision === 'APPROVED' ? 'Approve discount' : 'Reject discount'}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                    {requests
                      .filter((r) => r.status === 'APPROVED')
                      .map((r) => (
                        <button
                          key={r.id}
                          disabled={busy || !can('bill:apply_discount')}
                          onClick={() =>
                            action(async () => {
                              await api.request(`/bills/${bill.id}/discount`, {
                                method: 'POST',
                                body: { approvalRequestId: r.id }
                              });
                              await selectBill(bill.id);
                              await load();
                              setMessage('Approved discount saved.');
                            })
                          }
                          className="w-full rounded bg-emerald-700 p-2 text-xs font-bold text-white hover:bg-emerald-800 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Apply approved discount {money(r.amountPaise)}
                        </button>
                      ))}

                    <div>
                      <button
                        disabled={busy || !can('bill:void') || notes.trim().length < 3}
                        onClick={() =>
                          action(async () => {
                            await api.request(`/bills/${bill.id}/void`, {
                              method: 'POST',
                              body: { reason: notes }
                            });
                            await selectBill(bill.id);
                            await load();
                            setMessage('Bill voided. History retained.');
                          })
                        }
                        className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Void unpaid bill
                      </button>
                    </div>
                  </div>
                )}

                <label className="text-xs font-medium text-slate-700 block">
                  Billing notes / refund reason{' '}
                  <input
                    aria-label="Billing notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={busy}
                    placeholder="Notes for discount, voiding, or cash recording..."
                    className="mt-1 w-full rounded border border-slate-200 bg-slate-50 p-2 text-xs focus:bg-white focus:outline-none"
                  />
                </label>

                {bill.balancePaise > 0 && bill.status !== 'VOIDED' && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-emerald-700" />
                        <span>Record Cash Received</span>
                      </span>
                      {changeDuePaise > 0 && (
                        <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                          Change Due: {money(changeDuePaise)}
                        </span>
                      )}
                    </div>

                    <label className="text-xs font-semibold text-slate-700 block">
                      Cash received in rupees{' '}
                      <input
                        aria-label="Cash received"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={cash}
                        disabled={busy}
                        onChange={(e) => setCash(e.target.value)}
                        placeholder="0.00"
                        className="mt-1 w-full rounded border border-slate-200 bg-white p-2.5 text-sm font-bold text-slate-900 focus:border-[#163024] focus:outline-none"
                      />
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        aria-label="Confirm cash received"
                        type="checkbox"
                        checked={confirmed}
                        disabled={busy}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#163024] focus:ring-[#163024]"
                      />
                      <span>I have received this cash.</span>
                    </label>

                    <button
                      disabled={
                        busy ||
                        !confirmed ||
                        cashPaise === null ||
                        cashPaise <= 0 ||
                        (!can('payment:process') && !can('bill:settle'))
                      }
                      onClick={() =>
                        action(async () => {
                          const amountPaise = cashPaise!;
                          const identity = `cash:${bill.id}:${amountPaise}`;
                          const payment = await api.request(`/bills/${bill.id}/payments`, {
                            method: 'POST',
                            body: {
                              paymentMethod: 'CASH',
                              amountPaise,
                              notes: 'Cash received and confirmed by authorized cashier.'
                            },
                            idempotencyKey: key(identity)
                          });
                          if (payment.status !== 'CAPTURED' || !payment.id) {
                            throw new Error('The server did not confirm a captured cash payment.');
                          }
                          setCash('');
                          setConfirmed(false);
                          await selectBill(bill.id);
                          await load();
                          keys.current.delete(identity);
                          setMessage(
                            `Cash payment saved. Change returned: ${money(payment.changeReturnedPaise || 0)}.`
                          );
                        })
                      }
                      className="w-full rounded-lg bg-[#163024] p-3 text-xs font-bold text-white hover:bg-[#0f2219] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      Record cash received
                    </button>
                  </div>
                )}

                {bill.grandTotalPaise === 0 &&
                  bill.balancePaise === 0 &&
                  ['DRAFT', 'APPROVED'].includes(bill.status) && (
                    <button
                      disabled={busy || !can('bill:settle') || notes.trim().length < 3}
                      onClick={() =>
                        action(async () => {
                          await api.request(`/bills/${bill.id}/close-zero-balance`, {
                            method: 'POST',
                            body: { reason: notes }
                          });
                          await selectBill(bill.id);
                          await load();
                          setMessage('Zero-total bill closed. No payment or revenue was recorded.');
                        })
                      }
                      className="w-full rounded-lg bg-emerald-700 p-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Close zero-total bill without payment
                    </button>
                  )}

                <div className="space-y-2 border-t pt-3">
                  <h3 className="font-bold text-xs text-slate-800">Persisted payment history</h3>
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">Payment {p.id}</span>
                        <span className="text-slate-500">
                          {' '}
                          · {p.paymentMethod} · {p.status} · {money(p.amountPaise)}
                        </span>
                      </div>
                      {can('payment:refund') &&
                        ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(p.status) &&
                        p.paymentMethod === 'CASH' && (
                          <button
                            disabled={
                              busy ||
                              refundPaise === null ||
                              refundPaise <= 0 ||
                              refundPaise > p.amountPaise ||
                              notes.trim().length < 3
                            }
                            onClick={() =>
                              action(async () => {
                                const identity = `refund:${p.id}:${refund}:${notes}`;
                                await api.request(`/payments/${p.id}/refunds`, {
                                  method: 'POST',
                                  body: { amountPaise: refundPaise, reason: notes },
                                  idempotencyKey: key(identity)
                                });
                                keys.current.delete(identity);
                                await selectBill(bill.id);
                                await load();
                                setRefund('');
                                setMessage('Cash refund recorded. History preserved.');
                              })
                            }
                            className="rounded bg-red-700 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-red-800 cursor-pointer disabled:opacity-50"
                          >
                            Record cash refund for {p.id}
                          </button>
                        )}
                    </div>
                  ))}
                  {can('payment:refund') && (
                    <label className="text-xs font-medium text-slate-700 block pt-1">
                      Cash refund in rupees{' '}
                      <input
                        aria-label="Cash refund amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={refund}
                        onChange={(e) => setRefund(e.target.value)}
                        placeholder="0.00"
                        className="mt-1 w-full rounded border border-slate-200 bg-slate-50 p-1.5 text-xs focus:bg-white focus:outline-none"
                      />
                    </label>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    disabled={busy}
                    onClick={() => window.print()}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-xs transition-all cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print persisted invoice / receipt</span>
                  </button>

                  <p className="text-[11px] text-slate-500 text-center">
                    A paid receipt requires SETTLED status and zero balance. Partial payments retain the balance.
                    Dining sessions close only after completed orders and full settlement.
                  </p>
                </div>
              </section>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                <Receipt className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <h3 className="font-bold text-slate-700">No Bill Selected</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Select a table from Table Checkout, choose an invoice from Saved Bills, or accept an incoming
                  waiter request to inspect items, apply discounts, and record payment.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

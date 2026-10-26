// Guest ordering credentials are tab/session scoped. Never use localStorage or log this state.
export interface QrNavigation {
  c: string | null;
  s: string | null;
  table: string | null;
  restaurant: string | null;
  binding?: { tableId: string; outletId: string; tableNumber: string };
}
type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = 'pali_qr_context';
const qrKeys = ['c','s','table','tableNumber','t','restaurant','restaurantId','r'];
const empty = (): QrNavigation => ({ c:null, s:null, table:null, restaurant:null });
const samePair = (a: QrNavigation, b: QrNavigation) => a.c === b.c && a.s === b.s && a.table === b.table && a.restaurant === b.restaurant;

export class GuestQrContextStore {
  private memory: QrNavigation | undefined;
  constructor(private storage: () => SessionStore | undefined) {}
  read(): QrNavigation {
    if (this.memory) return this.memory;
    try {
      const saved = JSON.parse(this.storage()?.getItem(key) || 'null');
      if (saved && ['c','s','table','restaurant'].every(field => saved[field] === null || typeof saved[field] === 'string')
        && (!saved.binding || ['tableId','outletId','tableNumber'].every(field => typeof saved.binding[field] === 'string'))) {
        this.memory = saved;
        return saved;
      }
    } catch { /* Unavailable or malformed session storage fails closed. */ }
    return empty();
  }
  private save(next: QrNavigation): QrNavigation {
    this.memory = next;
    try {
      const storage = this.storage();
      // One record is authoritative; legacy c/s keys are mirrors, never independently combined.
      storage?.setItem(key, JSON.stringify(next));
      const mirrors: Array<[string,string|null]> = [['pali_qr_c',next.c],['pali_qr_s',next.s],['pali_qr_table',next.table],['pali_qr_restaurant',next.restaurant]];
      for (const [name,value] of mirrors) {
        if (value) storage?.setItem(name,value); else storage?.removeItem(name);
      }
    } catch {
      // Quota/write failures must not leave a previous table resumable after refresh.
      try {const storage=this.storage();for(const name of [key,'pali_qr_c','pali_qr_s','pali_qr_table','pali_qr_restaurant'])storage?.removeItem(name);}catch {}
    }
    return next;
  }
  capture(route: string): QrNavigation {
    const url = new URL(route, 'https://qr.invalid');
    // Hash routing is authoritative when present; unrelated outer queries cannot hide its credentials.
    const query = url.hash.startsWith('#/') ? url.hash.split('?')[1] || '' : url.search;
    const params = new URLSearchParams(query);
    const previous = this.read();
    if (!qrKeys.some(name => params.has(name))) return previous;
    const c = params.getAll('c').length === 1 ? params.get('c')?.trim() || null : null;
    const s = c && params.getAll('s').length === 1 ? params.get('s')?.trim() || null : null;
    const next: QrNavigation = { c, s, table:params.get('table') || params.get('tableNumber') || params.get('t'), restaurant:params.get('restaurant') || params.get('restaurantId') || params.get('r') };
    // An explicit c-only/public link always removes ordering authority, even for the same c.
    if (samePair(previous,next)) next.binding = previous.binding;
    return this.save(next);
  }
  bind(snapshot: QrNavigation, table: { tableId:string; outletId:string; tableNumber:string }): boolean {
    if (!samePair(this.read(),snapshot)) return false; // Ignore a late response from an older scan.
    this.save({ ...snapshot, binding:{tableId:table.tableId,outletId:table.outletId,tableNumber:table.tableNumber} });
    return true;
  }
  canRestore(): boolean {
    try { const saved=JSON.parse(this.storage()?.getItem(key)||'null');return !!saved && samePair(this.read(),saved); } catch { return false; }
  }
  credentials(tableId?: string, outletId?: string): {qrPublicCode:string;qrSecretToken:string} | null {
    const current=this.read();
    if (!current.c || !current.s || !tableId || !outletId || current.binding?.tableId !== tableId || current.binding?.outletId !== outletId) return null;
    return {qrPublicCode:current.c,qrSecretToken:current.s};
  }
}
export const guestQrContext = new GuestQrContextStore(() => {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; } catch { return undefined; }
});

/** Remove credentials and scope hints together so refresh resumes the bound session record.
 * If storage is unavailable, refreshing requires a new scan instead of reviving another table. */
export function scrubOrderingQrUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const hashRoute = url.hash.startsWith('#/') ? url.hash.slice(1) : null;
  const hashUrl = hashRoute ? new URL(hashRoute,url.origin) : null;
  if (!url.searchParams.has('s') && !hashUrl?.searchParams.has('s')) return;
  for (const name of qrKeys) { url.searchParams.delete(name); hashUrl?.searchParams.delete(name); }
  if(!guestQrContext.canRestore() && guestQrContext.read().c) (hashUrl || url).searchParams.set('c',guestQrContext.read().c!);
  if (hashUrl) url.hash = '#' + hashUrl.pathname + hashUrl.search;
  window.history.replaceState(window.history.state,'',url.pathname + url.search + url.hash);
}

/** Fragment credentials are not sent in the initial HTTP URL or referrer. */
export function createSecureOrderingQrUrl(origin: string, credentials: {qrPublicCode:string;qrSecretToken:string}): string {
  const url=new URL('/',origin);
  url.hash='/customer/qr-ordering?'+new URLSearchParams({c:credentials.qrPublicCode,s:credentials.qrSecretToken}).toString();
  return url.toString();
}
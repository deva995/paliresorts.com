import type { KitchenTicket } from '../types';

export type KitchenStationFilter = 'all' | 'tandoor' | 'curry' | 'chinese' | 'pantry' | 'bar';

export function getTicketStation(t: KitchenTicket): 'tandoor' | 'curry' | 'chinese' | 'pantry' | 'bar' | 'unknown' {
  const code = (t.stationCode || '').toUpperCase();
  if (code === 'TANDOOR') return 'tandoor';
  if (code === 'CURRY') return 'curry';
  if (code === 'CHINESE') return 'chinese';
  if (code === 'PANTRY') return 'pantry';
  if (code === 'BAR') return 'bar';

  const name = (t.station || '').toLowerCase();
  if (name.includes('tandoor') || name.includes('grill') || name.includes('clay oven')) return 'tandoor';
  if (name.includes('curry') || name.includes('gravy')) return 'curry';
  if (name.includes('chinese') || name.includes('wok')) return 'chinese';
  if (name.includes('pantry') || name.includes('dessert') || name.includes('cold')) return 'pantry';
  if (name.includes('bar') || name.includes('drink') || name.includes('cellar') || name.includes('cocktail') || name.includes('beverage')) return 'bar';

  if (t.stationType === 'bar' || t.stationType === 'beverages' || t.stationType === 'drinks') return 'bar';
  return 'unknown';
}

export function isTicketVisibleForRole(t: KitchenTicket, role: string): boolean {
  const station = getTicketStation(t);
  if (role === 'KITCHEN_COOKING') {
    // Hot stations only: Tandoor, Curry, Chinese
    return station === 'tandoor' || station === 'curry' || station === 'chinese';
  }
  if (role === 'KITCHEN_BAR' || role === 'BEVERAGES' || role === 'DRINKS') {
    // Beverage tickets only: Bar
    return station === 'bar';
  }
  return true;
}

export function matchesKitchenStation(ticket: KitchenTicket, station: string): boolean {
  if (station === 'all') return true;
  const actual = getTicketStation(ticket);
  if (['bar', 'beverages', 'drinks'].includes(station)) return actual === 'bar';
  if (station === 'cooking') return actual !== 'bar' && actual !== 'unknown';
  return actual === station;
}

/** The sidebar and station screens count the same outlet/role-visible active queue. */
export function countActiveStationTickets(tickets: KitchenTicket[], outletId: string | undefined, role: string, station = 'all'): number {
  if (!outletId) return 0;
  return tickets.filter(ticket => ticket.restaurantId === outletId && ticket.status !== 'completed' && ticket.status !== 'cancelled'
    && isTicketVisibleForRole(ticket, role) && matchesKitchenStation(ticket, station)).length;
}
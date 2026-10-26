/**
 * Authoritative Currency Conversion Utilities
 * Pali Resort & Club Operations Platform
 * 
 * Invariant: All financial transactions, item prices, bills, taxes, and payments
 * MUST be stored and manipulated in integer paise (1 INR = 100 paise).
 * Rupee <-> paise conversion is strictly centralized here.
 */

/**
 * Converts a rupee amount (number or string representation) to integer paise.
 * Uses Math.round to avoid IEEE 754 floating point precision inaccuracies.
 */
export function rupeesToPaise(rupees: number | string): number {
  const parsed = typeof rupees === 'string' ? parseFloat(rupees.trim()) : rupees;
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid rupee value: cannot convert "${rupees}" to paise`);
  }
  return Math.round(parsed * 100);
}

/**
 * Converts an integer paise amount to rupees with 2 decimal precision.
 */
export function paiseToRupees(paise: number | string): number {
  const parsed = typeof paise === 'string' ? parseInt(paise.trim(), 10) : paise;
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid paise value: cannot convert "${paise}" to rupees`);
  }
  return Number((parsed / 100).toFixed(2));
}

/**
 * Formats integer paise into a standard INR string (e.g. 42000 -> "420.00").
 */
export function formatRupees(paise: number | string): string {
  const val = paiseToRupees(paise);
  return val.toFixed(2);
}

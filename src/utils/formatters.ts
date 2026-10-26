/**
 * Centralized formatting utilities
 * Null-safe presentation helpers for currency, phone, timestamps, and order statuses.
 */

/**
 * Converts integer paise to Indian Rupee string: e.g. 45000 paise -> ₹450.00 or ₹450
 */
export function formatPaiseToRupees(paise?: number | null, options?: { showDecimal?: boolean }): string {
  if (paise == null || isNaN(paise)) {
    return '₹0';
  }
  const rupees = paise / 100;
  const showDec = options?.showDecimal ?? (paise % 100 !== 0);
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: showDec ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format currency given rupees (float/integer): e.g. 450 -> ₹450
 */
export function formatRupees(amount?: number | null): string {
  if (amount == null || isNaN(amount)) {
    return '₹0';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Masks Indian mobile numbers preserving only the last 4 digits.
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || phone.trim() === '') {
    return '+91 ******4521';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `+91 ******${last4}`;
  }
  return '+91 ******4521';
}

/**
 * Formats ISO timestamp to human friendly localized time string.
 */
export function formatTimeAgo(isoDateStr?: string | null): string {
  if (!isoDateStr) return 'just now';
  try {
    const d = new Date(isoDateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

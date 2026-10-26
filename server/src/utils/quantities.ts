import { BadRequestError } from './errors.js';

/**
 * Deterministic fixed-point quantity arithmetic utility for PostgreSQL NUMERIC(12,3).
 * Represents inventory quantities in thousandths (1 unit = 1000 milli-units / thousandths)
 * using JavaScript BigInt to completely eliminate floating-point drift.
 */

/**
 * Parses a decimal number or string into integer thousandths (BigInt).
 * Strictly validates that fractional precision does not exceed 3 decimal places.
 */
export function parseQuantityToThousandths(val: string | number | bigint): bigint {
  if (typeof val === 'bigint') {
    return val;
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new BadRequestError('Invalid numeric quantity: value must be finite');
    }
    // Convert to fixed string representation to avoid float notation artifacts
    // Round small JS float errors if needed or stringify cleanly
    val = val.toString();
  }

  const str = val.trim();
  if (!str) {
    throw new BadRequestError('Quantity string cannot be empty');
  }

  // Matches optional sign, digits, optional decimal point and digits
  const match = str.match(/^([+-])?(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new BadRequestError(`Malformed numeric quantity: '${str}'`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const integerPart = match[2];
  const fractionalPart = match[3] || '';

  if (fractionalPart.length > 3) {
    throw new BadRequestError(
      `Quantity precision exceeds maximum allowed 3 decimal places (received '${str}', max precision e.g. 1.250)`
    );
  }

  // Pad fractional part to 3 digits (e.g. '5' -> '500', '25' -> '250', '' -> '000')
  const paddedFraction = fractionalPart.padEnd(3, '0');

  const totalThousandths = BigInt(integerPart) * 1000n + BigInt(paddedFraction);
  return sign * totalThousandths;
}

/**
 * Formats BigInt thousandths into standard PostgreSQL NUMERIC(12,3) string (e.g. "2.500", "-1.234").
 */
export function formatThousandthsToQuantity(thousandths: bigint): string {
  const isNegative = thousandths < 0n;
  const absVal = isNegative ? -thousandths : thousandths;

  const intPart = absVal / 1000n;
  const fracPart = (absVal % 1000n).toString().padStart(3, '0');

  const prefix = isNegative ? '-' : '';
  return `${prefix}${intPart.toString()}.${fracPart}`;
}

/**
 * Converts BigInt thousandths to standard JavaScript number for API JSON responses.
 */
export function formatThousandthsToNumber(thousandths: bigint): number {
  return Number(thousandths) / 1000;
}

/**
 * Normalizes any quantity input (number or string) into canonical 3-decimal string representation.
 */
export function normalizeQuantityString(val: string | number | bigint): string {
  return formatThousandthsToQuantity(parseQuantityToThousandths(val));
}

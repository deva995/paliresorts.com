import { createHash } from 'crypto';

/**
 * Recursively sorts object keys to guarantee deterministic JSON serialization.
 * Handles nested objects, arrays, primitives, and null/undefined.
 */
export function canonicalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val !== 'object') {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(val as Record<string, unknown>).sort();

  for (const key of keys) {
    // Exclude volatile authentication or transient tracking keys from request hashing
    if (['authorization', 'x-request-id', 'idempotency-key', 'timestamp'].includes(key.toLowerCase())) {
      continue;
    }
    sortedObj[key] = canonicalizeValue((val as Record<string, unknown>)[key]);
  }

  return sortedObj;
}

/**
 * Serializes a value into a canonical, key-sorted JSON string.
 */
export function canonicalJsonStringify(val: unknown): string {
  const canonical = canonicalizeValue(val);
  return JSON.stringify(canonical);
}

/**
 * Computes a deterministic SHA-256 hex hash from a payload.
 * Identical logical payloads produce identical hashes regardless of object key order.
 */
export function computeRequestHash(payload: unknown): string {
  const jsonStr = canonicalJsonStringify(payload);
  return createHash('sha256').update(jsonStr).digest('hex');
}

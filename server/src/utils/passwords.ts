import crypto from 'node:crypto';
import { BadRequestError } from './errors.js';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

// Pre-computed dummy hash to equalize timing when an account is not found
const DUMMY_SALT = '0123456789abcdef0123456789abcdef';
const DUMMY_KEY = crypto
  .scryptSync('dummy_password_constant', DUMMY_SALT, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  })
  .toString('hex');
const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${DUMMY_SALT}$${DUMMY_KEY}`;

/**
 * Validates that the password meets minimum security requirements (at least 8 chars).
 */
export function validatePasswordRequirements(password: unknown): { valid: boolean; reason?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

/**
 * Asserts that the password meets minimum security requirements or throws BadRequestError.
 */
export function validatePasswordStrength(password: unknown): asserts password is string {
  const result = validatePasswordRequirements(password);
  if (!result.valid) {
    throw new BadRequestError(result.reason || 'Password must be at least 8 characters long');
  }
}

/**
 * Hashes a plaintext password using Node.js scrypt with a 16-byte cryptographically secure salt.
 * Output format: scrypt$N$r$p$salt$hash (16-byte salt, 64-byte key)
 */
export function hashPassword(password: string): string {
  validatePasswordStrength(password);

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in timing-safe manner.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (isNaN(N) || isNaN(r) || isNaN(p) || !salt || !expectedHex) {
    return false;
  }

  try {
    const derivedKey = crypto.scryptSync(password, salt, expectedHex.length / 2, { N, r, p });
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    if (derivedKey.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Runs a dummy scrypt verification so response times do not leak whether an account exists.
 */
export function runDummyPasswordVerification(password: string): void {
  try {
    verifyPassword(password || 'dummy', DUMMY_HASH);
  } catch {
    // ignore
  }
}

export const verifyPasswordConstantTimeDummy = runDummyPasswordVerification;

/**
 * Generates a 32-byte cryptographically secure session token base64url string.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Computes the SHA-256 hex hash of a session token for database lookup.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

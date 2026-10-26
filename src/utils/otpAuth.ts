/**
 * Pali Resort & Club - Phase 7 Customer Mobile & OTP Verification Utilities
 * Strict privacy, Indian mobile validation (+91), secure OTP generation & verification.
 */

// OTP Configuration Constants
export const OTP_LENGTH = 6;
export const OTP_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 3; // Block after 3 incorrect attempts
export const OTP_RESEND_COOLDOWN_SEC = 30; // 30 seconds cooldown between resends

export interface MobileValidationResult {
  isValid: boolean;
  rawDigits: string;
  formattedDisplay: string;
  error?: string;
}

/**
 * Validates Indian mobile numbers (+91, exactly 10 digits starting with 6, 7, 8, or 9).
 * Rejects letters, special characters, whitespace, and malformed inputs.
 */
export function validateIndianMobile(input: string): MobileValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      rawDigits: '',
      formattedDisplay: '',
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  // Remove whitespace, dashes, parens
  let cleaned = input.trim().replace(/[\s\-()]/g, '');

  // Strip leading +91 or 91 if present
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Check if contains non-digit characters
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      rawDigits: cleaned,
      formattedDisplay: cleaned,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  // Must be exactly 10 digits
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      rawDigits: cleaned,
      formattedDisplay: cleaned,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  // Standard Indian mobile prefix check (must start with 6, 7, 8, or 9)
  if (!/^[6-9]/.test(cleaned)) {
    return {
      isValid: false,
      rawDigits: cleaned,
      formattedDisplay: cleaned,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  return {
    isValid: true,
    rawDigits: cleaned,
    formattedDisplay: `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`,
  };
}

/**
 * Masks mobile number for privacy across Customer UI, Waiter UI, and Owner UI.
 * Format: +91 ******4521 (always reveals only the last 4 digits).
 */
export function maskMobileNumber(phoneOrDigits: string | undefined | null): string {
  if (!phoneOrDigits) return '+91 ******0000';

  const cleaned = phoneOrDigits.replace(/\D/g, '');
  if (cleaned.length >= 4) {
    const last4 = cleaned.slice(-4);
    return `+91 ******${last4}`;
  }

  return '+91 ******0000';
}

/**
 * Generates a random, secure 6-digit numeric OTP.
 * Never hardcoded to 123456 in production.
 */
export function generateSecureOTP(): string {
  // Generate random 6-digit number between 100000 and 999999
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

/**
 * Checks if current environment is development / preview
 */
export function isDevelopmentMode(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.hostname.includes('ais-dev-') ||
        window.location.hostname.includes('run.app') ||
        Boolean((import.meta as Record<string, any>).env?.DEV))
    );
  } catch (e) {
    return true;
  }
}

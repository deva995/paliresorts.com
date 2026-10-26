const SENSITIVE_KEY_REGEX = /^(authorization|cookie|set-cookie|token|access_token|refresh_token|jwt|password|secret|api_key|otp|pin|pin_hash|auth_code|card_number|card_num|cvv|cvc|pan)$/i;

// Match Indian phone numbers: +91 9876543210, 919876543210, 09876543210, or 10 digits starting with 6-9
const PHONE_NUMBER_REGEX = /(?:\+?91[\s-]?)?[6-9]\d{9}/g;

// Match Bearer token strings
const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

/**
 * Mask a phone number to retain only the last 4 digits: XXXXXX4321
 */
export function maskPhoneNumber(phoneStr: string): string {
  return phoneStr.replace(PHONE_NUMBER_REGEX, (match) => {
    const digits = match.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `XXXXXX${last4}`;
  });
}

/**
 * Redact sensitive headers, tokens, OTPs, and phone numbers from logs or error outputs.
 */
export function sanitizeLogValue(val: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH_EXCEEDED]';
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    let sanitized = val.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]');
    sanitized = maskPhoneNumber(sanitized);
    return sanitized;
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeLogValue(item, depth + 1));
  }

  if (typeof val === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, propVal] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeLogValue(propVal, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return String(val);
}

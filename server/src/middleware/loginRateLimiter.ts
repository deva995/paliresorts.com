import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../utils/errors.js';

interface IpRateRecord {
  timestamps: number[];
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 15; // IP abuse ceiling; per-account password failures still lock at 5

const defaultIpAttempts = new Map<string, IpRateRecord>();

export function resetLoginRateLimits(): void {
  defaultIpAttempts.clear();
}

/**
 * Creates an in-memory IP rate limiter middleware for staff login endpoints.
 * Honors client IP resolved via Express "trust proxy".
 */
export function createLoginRateLimiter(options?: { windowMs?: number; maxAttempts?: number }, ipMap = new Map<string,IpRateRecord>()) {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').trim();
    const now = Date.now();

    // Prune idle IP records, including on a long-lived process.
    for (const [ip, entry] of ipMap) {
      if (entry.timestamps.every(ts => now - ts >= windowMs)) ipMap.delete(ip);
    }
    const record = ipMap.get(clientIp) || { timestamps: [] };

    // Filter out timestamps outside sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxAttempts) {
      const unlockAt = record.timestamps[0] + windowMs;
      const retrySeconds = Math.max(1, Math.ceil((unlockAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySeconds));
      res.setHeader('X-Login-Unlock-At', new Date(unlockAt).toISOString());
      return next(new RateLimitError(retrySeconds));
    }

    // Reserve in-flight attempts so concurrent requests cannot evade the ceiling.
    record.timestamps.push(now);
    res.once('finish', () => {
      if (res.statusCode < 400) {
        const index = record.timestamps.indexOf(now);
        if (index >= 0) record.timestamps.splice(index, 1);
      }
    });
    ipMap.set(clientIp, record);

    next();
  };
}

/**
 * Default singleton login IP rate limiter
 */
export const loginIpRateLimiter = createLoginRateLimiter(undefined,defaultIpAttempts);

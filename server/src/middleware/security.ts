import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { RateLimitError, ForbiddenError } from '../utils/errors.js';

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  });
}

/**
 * Strict CORS origin verification matching frontend staging & production domains.
 */
export function createCorsMiddleware(allowedOriginsStr: string) {
  const allowedOrigins = allowedOriginsStr
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return cors({
    origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow non-browser server-to-server requests or curl/health probes with no origin
      if (!requestOrigin) {
        return callback(null, true);
      }

      const normalizedOrigin = requestOrigin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      if (
        process.env.NODE_ENV !== 'production' &&
        (/^https:\/\/[a-z0-9-]+-52340332463\.[a-z0-9-]+\.run\.app$/i.test(normalizedOrigin) ||
          /^https:\/\/ais-[a-z0-9-]+\.run\.app$/i.test(normalizedOrigin))
      ) {
        return callback(null, true);
      }

      callback(new ForbiddenError(`Origin '${requestOrigin}' is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID', 'X-Correlation-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After', 'X-Login-Unlock-At'],
    credentials: true,
    maxAge: 86400 // 24 hours preflight cache
  });
}

interface ClientRateLimitBucket {
  count: number;
  resetTime: number;
}

/**
 * In-memory global rate limiter respecting Cloud Run proxy IP headers (req.ip).
 */
export function createRateLimiter(windowMs: number, maxRequests: number) {
  const hits = new Map<string, ClientRateLimitBucket>();

  // Cleanup expired buckets every minute to avoid memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of hits.entries()) {
      if (now > bucket.resetTime) {
        hits.delete(ip);
      }
    }
  }, 60000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Exclude healthcheck probes from rate limiting
    if (req.path === '/health' || req.path === '/health/ready') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = hits.get(ip);

    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 0, resetTime: now + windowMs };
      hits.set(ip, bucket);
    }

    bucket.count += 1;

    // In development or local testing, elevate rate limit to prevent false-positive 429s on frontend polling
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveMaxRequests = isDev ? Math.max(maxRequests, 3000) : maxRequests;

    const remaining = Math.max(0, effectiveMaxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', effectiveMaxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetTime / 1000).toString());

    if (bucket.count > effectiveMaxRequests) {
      res.setHeader('Retry-After', resetSeconds.toString());
      return next(new RateLimitError(resetSeconds));
    }

    next();
  };
}

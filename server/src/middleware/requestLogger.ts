import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { sanitizeLogValue } from '../utils/sanitizer.js';

export function createRequestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Skip verbose logging for high-frequency internal health probes
    if (req.path === '/health' || req.path === '/health/ready') {
      return next();
    }

    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const statusCode = res.statusCode;

      const logContext = {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        query: sanitizeLogValue(req.query)
      };

      if (statusCode >= 500) {
        logger.error(`HTTP ${req.method} ${req.path} failed with ${statusCode}`, logContext);
      } else if (statusCode >= 400) {
        logger.warn(`HTTP ${req.method} ${req.path} returned ${statusCode}`, logContext);
      } else {
        logger.info(`HTTP ${req.method} ${req.path} completed`, logContext);
      }
    });

    next();
  };
}

import { Request, Response, NextFunction } from 'express';
import { AppError, ProblemDetails } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let envConfig;
  try {
    envConfig = getEnv();
  } catch {
    envConfig = { NODE_ENV: 'production' };
  }

  const isProduction = envConfig.NODE_ENV === 'production';

  // 1. Differentiate known operational errors from unhandled internal exceptions
  if (err instanceof AppError && err.isOperational) {
    const problem = err.toProblemDetails(req.originalUrl);

    logger.warn(`Operational error: ${err.message}`, {
      requestId,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      path: req.originalUrl,
      invalidParams: err.invalidParams
    });

    res.status(err.statusCode).json(problem);
    return;
  }

  // Handle entity too large from body parser
  if ((err as any).type === 'entity.too.large' || (err as any).status === 413) {
    res.status(413).json({
      type: 'https://pali-resort.internal/errors/payload-too-large',
      title: 'Payload Too Large',
      status: 413,
      detail: 'Request payload exceeds maximum allowed size limit',
      code: 'PAYLOAD_TOO_LARGE',
      instance: req.originalUrl
    });
    return;
  }

  // 2. Unhandled error (programmer bug, DB syntax error, network failure)
  // Log the full technical error internally for developers
  logger.error(`Unhandled server exception: ${err.message}`, {
    requestId,
    name: err.name,
    stack: err.stack,
    path: req.originalUrl
  });

  // 3. Formulate strict, non-leaking RFC 7807 response for the client
  const problem: ProblemDetails = {
    type: 'https://pali-resort.internal/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail: isProduction
      ? 'An unexpected error occurred. Please contact resort operations support.'
      : err.message,
    code: 'INTERNAL_SERVER_ERROR',
    instance: req.originalUrl
  };

  res.status(500).json(problem);
}

export function notFoundHandler(req: Request, res: Response): void {
  const problem: ProblemDetails = {
    type: 'https://pali-resort.internal/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
    instance: req.originalUrl
  };

  res.status(404).json(problem);
}

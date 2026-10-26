export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly invalidParams?: Array<{ name: string; reason: string }>;

  constructor(
    statusCode: number,
    message: string,
    errorCode = 'INTERNAL_ERROR',
    isOperational = true,
    invalidParams?: Array<{ name: string; reason: string }>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.invalidParams = invalidParams;
    Error.captureStackTrace(this, this.constructor);
  }

  toProblemDetails(instancePath?: string): ProblemDetails {
    return {
      type: `https://pali-resort.internal/errors/${this.errorCode.toLowerCase().replace(/_/g, '-')}`,
      title: this.name.replace(/([A-Z])/g, ' $1').trim(),
      status: this.statusCode,
      detail: this.message,
      code: this.errorCode,
      ...(instancePath ? { instance: instancePath } : {}),
      ...(this.invalidParams ? { invalidParams: this.invalidParams } : {})
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, invalidParams?: Array<{ name: string; reason: string }>) {
    super(400, message, 'BAD_REQUEST', true, invalidParams);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied for requested resource or outlet scope') {
    super(403, message, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT', true);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, invalidParams?: Array<{ name: string; reason: string }>) {
    super(422, message, 'UNPROCESSABLE_ENTITY', true, invalidParams);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSecondsOrMessage: number | string = 60) {
    const message =
      typeof retryAfterSecondsOrMessage === 'number'
        ? `Too many requests. Please retry in ${retryAfterSecondsOrMessage} seconds.`
        : retryAfterSecondsOrMessage;
    super(429, message, 'RATE_LIMIT_EXCEEDED', true);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'A database error occurred') {
    super(500, message, 'DATABASE_ERROR', true);
  }
}

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../utils/errors.js';

export interface ValidationSchemas {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}

/**
 * Validates request params, query strings, and body payloads against Zod schemas.
 * Throws BadRequestError with structured invalidParams for RFC 7807 problem details.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const invalidParams = err.errors.map((e) => ({
          name: e.path.join('.'),
          reason: e.message
        }));
        return next(new BadRequestError('Request validation failed', invalidParams));
      }
      next(err);
    }
  };
}

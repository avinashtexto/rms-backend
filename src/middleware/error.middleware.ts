import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCode } from '../lib/error-codes';

export interface AppError extends Error {
  statusCode?: number;
  code?: ErrorCode;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('API Error:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    });
  }

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || ErrorCode.INTERNAL_SERVER_ERROR;

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred'
    }
  });
};

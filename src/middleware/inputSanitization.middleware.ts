import { Request, Response, NextFunction } from 'express';
import { body, validationResult, param, query } from 'express-validator';

// Generic validation middleware
export const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      });
    }
    next();
  };
};

// SQL injection prevention - sanitize string inputs
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          sanitized[key] = sanitizeString(obj[key]);
        } else if (Array.isArray(obj[key])) {
          sanitized[key] = obj[key].map(sanitizeString);
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// XSS prevention middleware
export const preventXSS = (req: Request, res: Response, next: NextFunction) => {
  const xssPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  
  const checkForXSS = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return xssPattern.test(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some(checkForXSS);
    }
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkForXSS);
    }
    return false;
  };

  if (checkForXSS(req.body) || checkForXSS(req.query) || checkForXSS(req.params)) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Potentially malicious content detected'
    });
  }

  next();
};

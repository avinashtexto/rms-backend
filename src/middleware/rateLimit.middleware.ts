import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../lib/redis.js';

// Create rate limiters for different endpoints
const authLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'auth_limit',
  points: 5, // 5 requests
  duration: 60, // per 60 seconds
  blockDuration: 60, // block for 60 seconds
});

const apiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'api_limit',
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
  blockDuration: 60, // block for 60 seconds
});

const uploadLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'upload_limit',
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
  blockDuration: 120, // block for 2 minutes
});

export const rateLimitAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    await authLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: secs
    });
  }
};

export const rateLimitApi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    await apiLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
      retryAfter: secs
    });
  }
};

export const rateLimitUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    await uploadLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload attempts. Please try again later.',
      retryAfter: secs
    });
  }
};

// User-specific rate limiter
const userLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'user_limit',
  points: 200, // 200 requests
  duration: 60, // per 60 seconds
  blockDuration: 60,
});

export const rateLimitUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return next(); // Skip if no user (auth middleware will handle)
    }
    await userLimiter.consume(userId);
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'User rate limit exceeded. Please slow down.',
      retryAfter: secs
    });
  }
};

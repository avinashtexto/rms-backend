import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../lib/redis.js';

// Endpoint-specific rate limiters
const endpointLimiters = new Map<string, RateLimiterRedis>();

const defaultEndpointLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'endpoint_limit',
  points: 50, // 50 requests per minute per endpoint
  duration: 60,
  blockDuration: 30,
});

function getEndpointLimiter(endpoint: string): RateLimiterRedis {
  if (!endpointLimiters.has(endpoint)) {
    endpointLimiters.set(endpoint, defaultEndpointLimiter);
  }
  return endpointLimiters.get(endpoint)!;
}

export const rateLimitByEndpoint = (maxRequests?: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const endpoint = req.path;
      const key = `${req.ip}:${endpoint}`;
      
      const limiter = getEndpointLimiter(endpoint);
      
      if (maxRequests) {
        // Custom limit for this endpoint
        await limiter.consume(key, maxRequests);
      } else {
        await limiter.consume(key);
      }
      
      next();
    } catch (rejRes: any) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Endpoint rate limit exceeded.',
        retryAfter: secs
      });
    }
  };
};

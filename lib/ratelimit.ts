import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis only if env variables are present
// Fallback to a mock redis if not present so local dev doesn't crash
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken 
  ? new Redis({ url: redisUrl, token: redisToken })
  : {
      sadd: async () => 1,
      eval: async () => [1, Date.now() + 60000]
    } as any;

// Default ratelimit: 10 requests per 60 seconds per IP using sliding window
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
});

// Specific limiters for different routes
export const inviteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: '@upstash/ratelimit/invite',
});

export const deleteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  analytics: true,
  prefix: '@upstash/ratelimit/delete',
});

export function getRealIP(request: Request): string {
  // Use x-forwarded-for header if available
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  // Use real-ip header if available
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  // Fallback
  return '127.0.0.1';
}

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis only if env variables are present
// Fallback to a mock redis if not present so local dev doesn't crash
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const isRedisConfigured = redisUrl && redisToken && redisUrl.startsWith('http');

const redis = isRedisConfigured 
  ? new Redis({ url: redisUrl as string, token: redisToken as string })
  : null;

// Mock Ratelimit class if no Redis is configured (e.g., local dev)
class MockRatelimit {
  async limit(identifier: string) {
    return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
  }
}

// Default ratelimit: 10 requests per 60 seconds per IP using sliding window
export const ratelimit = isRedisConfigured && redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
}) : new MockRatelimit();

// Specific limiters for different routes
export const inviteRatelimit = isRedisConfigured && redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: '@upstash/ratelimit/invite',
}) : new MockRatelimit();

export const deleteRatelimit = isRedisConfigured && redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  analytics: true,
  prefix: '@upstash/ratelimit/delete',
}) : new MockRatelimit();

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

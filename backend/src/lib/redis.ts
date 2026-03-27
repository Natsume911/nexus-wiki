import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying
        return Math.min(times * 200, 5000);
      },
    });

    redis.on('error', (err) => {
      console.error('[redis] connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[redis] connected');
    });

    redis.connect().catch((err) => {
      console.error('[redis] initial connect failed:', err.message);
    });
  }

  return redis;
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

import { env } from './env.js';

export function getRedisConnection(): { host: string; port: number } {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10) || 6379,
  };
}

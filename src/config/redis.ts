import { env } from './env.js';

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
}

export function getRedisConnection(): RedisConnectionConfig {
  const url = new URL(env.REDIS_URL);
  const config: RedisConnectionConfig = {
    host: url.hostname,
    port: parseInt(url.port, 10) || 6379,
  };

  if (url.password) {
    config.password = url.password;
  }

  return config;
}

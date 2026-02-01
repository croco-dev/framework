import { z } from 'zod';

export const redisConfig = {
  server: {
    REDIS_URL: z.string().url(),
    REDIS_TOKEN: z.string().optional(),
  },
  client: {},
  shared: {},
};

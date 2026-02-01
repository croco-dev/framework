import { z } from 'zod';

export const databaseConfig = {
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {},
  shared: {},
};

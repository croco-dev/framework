import { z } from "zod";

export const storageConfig = {
  server: {
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_URL_BASE: z.string().url().optional(),
  },
  client: {},
  shared: {},
};

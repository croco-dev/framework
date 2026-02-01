import { createEnv } from '@t3-oss/env-core';
import { appConfig } from './presets/app';
import { databaseConfig } from './presets/database';
import { redisConfig } from './presets/redis';
import { storageConfig } from './presets/storage';

export const env = createEnv({
  server: {
    ...appConfig.server,
    ...databaseConfig.server,
    ...redisConfig.server,
    ...storageConfig.server,
  },
  clientPrefix: 'NEXT_PUBLIC_',
  client: {
    ...appConfig.client,
    ...databaseConfig.client,
    ...redisConfig.client,
    ...storageConfig.client,
  },
  shared: {
    ...appConfig.shared,
    ...databaseConfig.shared,
    ...redisConfig.shared,
    ...storageConfig.shared,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});

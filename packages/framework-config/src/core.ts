import { createEnv } from "@t3-oss/env-core";

import { InvalidBooleanEnvProblem } from "./libs/problems/ConfigProblems";
import { appConfig } from "./presets/app";
import { databaseConfig } from "./presets/database";
import { redisConfig } from "./presets/redis";
import { storageConfig } from "./presets/storage";

function parseOptionalBooleanEnv(envName: string): boolean {
  const rawValue = process.env[envName];

  if (rawValue === undefined) {
    return false;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes") {
    return true;
  }

  if (normalizedValue === "false" || normalizedValue === "0" || normalizedValue === "no") {
    return false;
  }

  throw new InvalidBooleanEnvProblem(envName, rawValue);
}

export const env = createEnv({
  server: {
    ...appConfig.server,
    ...databaseConfig.server,
    ...redisConfig.server,
    ...storageConfig.server,
  },
  clientPrefix: "NEXT_PUBLIC_",
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
  skipValidation: parseOptionalBooleanEnv("SKIP_ENV_VALIDATION"),
});

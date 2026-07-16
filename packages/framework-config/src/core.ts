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

const skipValidation = parseOptionalBooleanEnv("SKIP_ENV_VALIDATION");

function createRuntimeEnv() {
  return createEnv({
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
    skipValidation,
  });
}

type RuntimeEnv = ReturnType<typeof createRuntimeEnv>;

const runtimeEnvTarget = {} as RuntimeEnv;
let resolvedRuntimeEnv: RuntimeEnv | undefined;
let runtimeEnvInitialized = false;

function getResolvedRuntimeEnv(): RuntimeEnv {
  resolvedRuntimeEnv ??= createRuntimeEnv();
  return resolvedRuntimeEnv;
}

function getRuntimeEnvTarget(): RuntimeEnv {
  if (!runtimeEnvInitialized) {
    const resolvedEnv = getResolvedRuntimeEnv();
    Reflect.setPrototypeOf(runtimeEnvTarget, Reflect.getPrototypeOf(resolvedEnv));
    Object.defineProperties(runtimeEnvTarget, Object.getOwnPropertyDescriptors(resolvedEnv));
    runtimeEnvInitialized = true;
  }

  return runtimeEnvTarget;
}

function synchronizeRuntimeEnvTarget(): RuntimeEnv {
  const target = getRuntimeEnvTarget();
  const resolvedEnv = getResolvedRuntimeEnv();
  const resolvedKeys = new Set(Reflect.ownKeys(resolvedEnv));

  for (const property of Reflect.ownKeys(target)) {
    if (!resolvedKeys.has(property)) {
      Reflect.deleteProperty(target, property);
    }
  }

  Object.defineProperties(target, Object.getOwnPropertyDescriptors(resolvedEnv));
  return target;
}

export const env = new Proxy(runtimeEnvTarget, {
  get: (_target, property) => {
    getRuntimeEnvTarget();
    const resolvedEnv = getResolvedRuntimeEnv();
    return Reflect.get(resolvedEnv, property, resolvedEnv);
  },
  set: (_target, property, value) => {
    const resolvedEnv = getResolvedRuntimeEnv();
    if (!Reflect.set(resolvedEnv, property, value, resolvedEnv)) {
      return false;
    }

    synchronizeRuntimeEnvTarget();
    return true;
  },
  has: (_target, property) => {
    getRuntimeEnvTarget();
    return Reflect.has(getResolvedRuntimeEnv(), property);
  },
  ownKeys: () => {
    synchronizeRuntimeEnvTarget();
    return Reflect.ownKeys(getResolvedRuntimeEnv());
  },
  getOwnPropertyDescriptor: (_target, property) =>
    Reflect.getOwnPropertyDescriptor(synchronizeRuntimeEnvTarget(), property),
  defineProperty: (_target, property, attributes) => {
    const target = getRuntimeEnvTarget();
    return (
      Reflect.defineProperty(getResolvedRuntimeEnv(), property, attributes) &&
      Reflect.defineProperty(target, property, attributes)
    );
  },
  deleteProperty: (_target, property) => {
    const target = getRuntimeEnvTarget();
    return (
      Reflect.deleteProperty(getResolvedRuntimeEnv(), property) &&
      Reflect.deleteProperty(target, property)
    );
  },
  getPrototypeOf: () => {
    getRuntimeEnvTarget();
    return Reflect.getPrototypeOf(getResolvedRuntimeEnv());
  },
  setPrototypeOf: (_target, prototype) => {
    const target = getRuntimeEnvTarget();
    return (
      Reflect.setPrototypeOf(getResolvedRuntimeEnv(), prototype) &&
      Reflect.setPrototypeOf(target, prototype)
    );
  },
  isExtensible: () => Reflect.isExtensible(getRuntimeEnvTarget()),
  preventExtensions: () => {
    const target = getRuntimeEnvTarget();
    return Reflect.preventExtensions(getResolvedRuntimeEnv()) && Reflect.preventExtensions(target);
  },
});

import { createEnv } from "@t3-oss/env-core";

import type { StandardSchemaDictionary } from "@t3-oss/env-core";

import {
  ConfigValidationProblem,
  InvalidBooleanEnvProblem,
  RuntimeEnvPresetBoundaryProblem,
} from "./libs/problems/ConfigProblems";
import { configDiagnostic } from "./libs/configDiagnostics";
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

export type RuntimeEnvPreset = {
  readonly server: StandardSchemaDictionary;
  readonly client: StandardSchemaDictionary;
  readonly shared: StandardSchemaDictionary;
};

export type DefineRuntimeEnvOptions<
  TPresets extends readonly RuntimeEnvPreset[],
  TPrefix extends string = "NEXT_PUBLIC_",
> = {
  readonly presets: number extends TPresets["length"]
    ? never
    : TPresets & RuntimeEnvBoundaryValidation<TPresets, NoInfer<TPrefix>>;
} & ([TPrefix] extends ["NEXT_PUBLIC_"]
  ? { readonly clientPrefix?: TPrefix }
  : { readonly clientPrefix: TPrefix extends "" ? never : TPrefix });

type RuntimeEnvSection = keyof RuntimeEnvPreset;

type Simplify<T> = { [TKey in keyof T]: T[TKey] };

type PossiblyUndefinedKeys<T> = {
  [TKey in keyof T]: undefined extends T[TKey] ? TKey : never;
}[keyof T];

type UndefinedOptional<T> = Partial<Pick<T, PossiblyUndefinedKeys<T>>> &
  Omit<T, PossiblyUndefinedKeys<T>>;

type MergeRecord<
  TCurrent extends StandardSchemaDictionary,
  TNext extends StandardSchemaDictionary,
> = Omit<TCurrent, keyof TNext> & TNext;

type MergeRuntimeEnvSection<
  TPresets extends readonly RuntimeEnvPreset[],
  TSection extends RuntimeEnvSection,
  TMerged extends StandardSchemaDictionary = StandardSchemaDictionary<NonNullable<unknown>>,
> = number extends TPresets["length"]
  ? TMerged
  : TPresets extends readonly [infer THead, ...infer TTail]
    ? THead extends RuntimeEnvPreset
      ? TTail extends readonly RuntimeEnvPreset[]
        ? MergeRuntimeEnvSection<TTail, TSection, MergeRecord<TMerged, THead[TSection]>>
        : TMerged
      : TMerged
    : TMerged;

type RuntimeEnvSchema<TPresets extends readonly RuntimeEnvPreset[]> = MergeRecord<
  MergeRecord<
    MergeRuntimeEnvSection<TPresets, "server">,
    MergeRuntimeEnvSection<TPresets, "shared">
  >,
  MergeRuntimeEnvSection<TPresets, "client">
>;

type KnownStringKeys<T> =
  string extends Extract<keyof T, string> ? never : Extract<keyof T, string>;

type InvalidServerRuntimeEnvKeys<
  TPresets extends readonly RuntimeEnvPreset[],
  TPrefix extends string,
> = Extract<KnownStringKeys<MergeRuntimeEnvSection<TPresets, "server">>, `${TPrefix}${string}`>;

type InvalidClientRuntimeEnvKeys<
  TPresets extends readonly RuntimeEnvPreset[],
  TPrefix extends string,
> = Exclude<KnownStringKeys<MergeRuntimeEnvSection<TPresets, "client">>, `${TPrefix}${string}`>;

type RuntimeEnvBoundaryValidation<
  TPresets extends readonly RuntimeEnvPreset[],
  TPrefix extends string,
> = string extends TPrefix
  ? unknown
  : [
        InvalidServerRuntimeEnvKeys<TPresets, TPrefix>,
        InvalidClientRuntimeEnvKeys<TPresets, TPrefix>,
      ] extends [never, never]
    ? unknown
    : never;

export type RuntimeEnv<TPresets extends readonly RuntimeEnvPreset[]> = Readonly<
  UndefinedOptional<Simplify<StandardSchemaDictionary.InferOutput<RuntimeEnvSchema<TPresets>>>>
>;

function mergeRuntimeEnvSection<
  const TPresets extends readonly RuntimeEnvPreset[],
  TSection extends RuntimeEnvSection,
>(presets: TPresets, section: TSection): MergeRuntimeEnvSection<TPresets, TSection> {
  return Object.assign({}, ...presets.map((preset) => preset[section])) as MergeRuntimeEnvSection<
    TPresets,
    TSection
  >;
}

function assertRuntimeEnvPresetBoundaries(
  presets: readonly RuntimeEnvPreset[],
  clientPrefix: string,
): void {
  for (const preset of presets) {
    for (const envName of Object.keys(preset.server)) {
      if (envName.startsWith(clientPrefix)) {
        throw new RuntimeEnvPresetBoundaryProblem("server", envName, clientPrefix);
      }
    }

    for (const envName of Object.keys(preset.client)) {
      if (!envName.startsWith(clientPrefix)) {
        throw new RuntimeEnvPresetBoundaryProblem("client", envName, clientPrefix);
      }
    }
  }
}

export function defineRuntimeEnv<
  const TPresets extends readonly RuntimeEnvPreset[],
  const TPrefix extends string = "NEXT_PUBLIC_",
>({
  presets,
  clientPrefix: configuredClientPrefix,
}: DefineRuntimeEnvOptions<TPresets, TPrefix>): RuntimeEnv<TPresets> {
  const clientPrefix = configuredClientPrefix ?? "NEXT_PUBLIC_";
  if (clientPrefix.length === 0) {
    throw new ConfigValidationProblem(["clientPrefix must not be empty"]);
  }
  assertRuntimeEnvPresetBoundaries(presets, clientPrefix);

  const runtimeInput = { ...process.env };
  const runtimeEnv = createEnv({
    server: mergeRuntimeEnvSection(presets, "server"),
    clientPrefix,
    client: mergeRuntimeEnvSection(presets, "client"),
    shared: mergeRuntimeEnvSection(presets, "shared"),
    runtimeEnv: runtimeInput,
    onValidationError: (issues) => {
      throw new ConfigValidationProblem(
        issues.map((issue) => {
          const first = issue.path?.[0];
          const key = typeof first === "object" ? first.key : first;
          const path = typeof key === "string" ? key : "<root>";
          const missing = typeof key === "string" && runtimeInput[key] === undefined;
          return configDiagnostic(path, issue, missing);
        }),
      );
    },
    emptyStringAsUndefined: true,
    skipValidation: parseOptionalBooleanEnv("SKIP_ENV_VALIDATION"),
  });

  return runtimeEnv as RuntimeEnv<TPresets>;
}

function createLazyRuntimeEnv<TEnv extends object>(resolve: () => TEnv): TEnv {
  const target = {} as TEnv;
  let resolvedEnv: TEnv | undefined;
  let initialized = false;

  function getResolvedEnv(): TEnv {
    resolvedEnv ??= resolve();
    return resolvedEnv;
  }

  function getTarget(): TEnv {
    if (!initialized) {
      const env = getResolvedEnv();
      Reflect.setPrototypeOf(target, Reflect.getPrototypeOf(env));
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(env));
      initialized = true;
    }

    return target;
  }

  function synchronizeTarget(): TEnv {
    const initializedTarget = getTarget();
    const env = getResolvedEnv();
    const resolvedKeys = new Set(Reflect.ownKeys(env));

    for (const property of Reflect.ownKeys(initializedTarget)) {
      if (!resolvedKeys.has(property)) {
        Reflect.deleteProperty(initializedTarget, property);
      }
    }

    Object.defineProperties(initializedTarget, Object.getOwnPropertyDescriptors(env));
    return initializedTarget;
  }

  return new Proxy(target, {
    get: (_target, property) => {
      getTarget();
      const env = getResolvedEnv();
      return Reflect.get(env, property, env);
    },
    set: (_target, property, value) => {
      const env = getResolvedEnv();
      if (!Reflect.set(env, property, value, env)) {
        return false;
      }

      synchronizeTarget();
      return true;
    },
    has: (_target, property) => {
      getTarget();
      return Reflect.has(getResolvedEnv(), property);
    },
    ownKeys: () => {
      synchronizeTarget();
      return Reflect.ownKeys(getResolvedEnv());
    },
    getOwnPropertyDescriptor: (_target, property) =>
      Reflect.getOwnPropertyDescriptor(synchronizeTarget(), property),
    defineProperty: (_target, property, attributes) => {
      const initializedTarget = getTarget();
      return (
        Reflect.defineProperty(getResolvedEnv(), property, attributes) &&
        Reflect.defineProperty(initializedTarget, property, attributes)
      );
    },
    deleteProperty: (_target, property) => {
      const initializedTarget = getTarget();
      return (
        Reflect.deleteProperty(getResolvedEnv(), property) &&
        Reflect.deleteProperty(initializedTarget, property)
      );
    },
    getPrototypeOf: () => {
      getTarget();
      return Reflect.getPrototypeOf(getResolvedEnv());
    },
    setPrototypeOf: (_target, prototype) => {
      const initializedTarget = getTarget();
      return (
        Reflect.setPrototypeOf(getResolvedEnv(), prototype) &&
        Reflect.setPrototypeOf(initializedTarget, prototype)
      );
    },
    isExtensible: () => Reflect.isExtensible(getTarget()),
    preventExtensions: () => {
      const initializedTarget = getTarget();
      return (
        Reflect.preventExtensions(getResolvedEnv()) && Reflect.preventExtensions(initializedTarget)
      );
    },
  });
}

const defaultRuntimeEnvPresets = [appConfig] as const;

export const fullRuntimeEnvPresets = [
  appConfig,
  databaseConfig,
  redisConfig,
  storageConfig,
] as const;

export const env = createLazyRuntimeEnv(() =>
  defineRuntimeEnv({ presets: defaultRuntimeEnvPresets }),
);

export const fullEnv = createLazyRuntimeEnv(() =>
  defineRuntimeEnv({ presets: fullRuntimeEnvPresets }),
);

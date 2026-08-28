import { IdPrefix, type PrefixedId } from "./IdPrefix";
import { DuplicateIdPrefixProblem } from "./problems/GidProblems";

type Values<T> = T[keyof T];

type IsUnion<T, U = T> = T extends U ? ([U] extends [T] ? false : true) : never;

type LiteralString<T extends string> = string extends T
  ? never
  : IsUnion<T> extends false
    ? T
    : never;

type AssertNoDuplicateValues<T extends Record<string, string>> = {
  [K in keyof T]: T[K] extends Values<{
    [K2 in Exclude<keyof T, K>]: LiteralString<T[K2]>;
  }>
    ? never
    : T[K];
};

export type IdPrefixInstance<TPrefix extends string> = {
  generate(): PrefixedId<TPrefix>;
  validate(id: unknown): id is PrefixedId<TPrefix>;
  getPrefix(): TPrefix;
  getExpectedLength(): number;
};

export type IdOf<TEntry extends IdPrefixInstance<string>> =
  TEntry extends IdPrefixInstance<infer TPrefix> ? PrefixedId<TPrefix> : never;

export type IdPrefixRegistry<T extends Record<string, string>> = {
  [K in keyof T]: IdPrefixInstance<T[K]>;
};

export function defineIdPrefixes<const T extends Record<string, string>>(
  config: T & AssertNoDuplicateValues<T>,
): IdPrefixRegistry<T> {
  const registry = {} as IdPrefixRegistry<T>;
  const prefixKeys = new Map<string, string>();

  for (const key of Object.keys(config) as Array<keyof T>) {
    const prefix = config[key];
    const keyName = key as string;
    const firstKey = prefixKeys.get(prefix);

    if (firstKey !== undefined) {
      throw new DuplicateIdPrefixProblem(prefix, firstKey, keyName);
    }

    prefixKeys.set(prefix, keyName);
    const instance = new IdPrefix(prefix);

    (registry as Record<string, unknown>)[keyName] = {
      generate: instance.generate,
      validate: instance.validate,
      getPrefix: () => instance.getPrefix(),
      getExpectedLength: () => instance.getExpectedLength(),
    };
  }

  return registry;
}

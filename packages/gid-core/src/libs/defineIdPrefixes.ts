import { IdPrefix, type PrefixedId } from "./IdPrefix";

type Values<T> = T[keyof T];

type DuplicateValues<T extends Record<string, string>> = Values<{
  [K in keyof T]: T[K] extends Values<Pick<T, Exclude<keyof T, K>>> ? T[K] : never;
}>;

type AssertNoDuplicateValues<T extends Record<string, string>> = [DuplicateValues<T>] extends [
  never,
]
  ? T
  : { __error: "Duplicate prefix values detected"; duplicates: DuplicateValues<T> };

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

  for (const key of Object.keys(config) as Array<keyof T>) {
    const prefix = config[key];
    const instance = new IdPrefix(prefix);

    (registry as Record<string, unknown>)[key as string] = {
      generate: instance.generate,
      validate: instance.validate,
      getPrefix: () => instance.getPrefix(),
      getExpectedLength: () => instance.getExpectedLength(),
    };
  }

  return registry;
}

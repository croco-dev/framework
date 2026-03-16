import { IdPrefix, type PrefixedId } from './IdPrefix';
import { IdPrefixProblem } from './problems/GidProblems';

type Values<T> = T[keyof T];

type UniqueValues<T extends Record<string, string>> = Values<{
  [K in keyof T]: T[K] extends Values<{ [K2 in Exclude<keyof T, K>]: T[K2] }> ? never : T[K];
}>;

type HasDuplicateValues<T extends Record<string, string>> = UniqueValues<T> extends Values<T> ? false : true;

type AssertNoDuplicateValues<T extends Record<string, string>> =
  HasDuplicateValues<T> extends true ? { __error: 'Duplicate prefix values detected'; duplicates: Values<T> } : T;

export type IdPrefixInstance<TPrefix extends string> = {
  generate(): `${TPrefix}_${string}`;
  validate(id: unknown): id is `${TPrefix}_${string}`;
  getPrefix(): TPrefix;
  getExpectedLength(): number;
  readonly Id: PrefixedId<TPrefix>;
};

export type IdPrefixRegistry<T extends Record<string, string>> = {
  [K in keyof T]: IdPrefixInstance<T[K]>;
};

export function defineIdPrefixes<const T extends Record<string, string>>(
  config: T & AssertNoDuplicateValues<T>
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
      get Id() {
        throw new IdPrefixProblem();
      },
    };
  }

  return registry;
}

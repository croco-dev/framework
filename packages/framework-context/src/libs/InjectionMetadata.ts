import type { Constructor } from "./types";
import type { Token } from "./Token";

export type InjectionTokenIdentifier<T = unknown> = Constructor<T> | Token<T> | string | symbol;

export type InjectionMetadata = {
  readonly index?: number;
  readonly many?: boolean;
  readonly optional?: boolean;
  readonly propertyKey?: string | symbol;
  readonly token?: InjectionTokenIdentifier;
};

export type InjectionMetadataInspection =
  | {
      readonly index?: number;
      readonly many: boolean;
      readonly optional: boolean;
      readonly propertyKey?: string | symbol;
      readonly status: "resolved";
      readonly token: InjectionTokenIdentifier;
    }
  | {
      readonly index?: number;
      readonly many: boolean;
      readonly optional: boolean;
      readonly propertyKey?: string | symbol;
      readonly status: "uninspectable";
    };

const injectionMetadata = new WeakMap<object, readonly InjectionMetadata[]>();

export function registerInjectionMetadata(target: object, metadata: InjectionMetadata): void {
  const existing = injectionMetadata.get(target) ?? [];
  const next = existing
    .filter((entry) => entry.index !== metadata.index || entry.propertyKey !== metadata.propertyKey)
    .concat(metadata);

  injectionMetadata.set(target, next);
}

export function inspectInjectionMetadata(target: object): readonly InjectionMetadataInspection[] {
  const entries = injectionMetadata.get(target) ?? [];

  return entries.map((entry): InjectionMetadataInspection => {
    if (entry.token !== undefined) {
      return {
        ...(entry.index === undefined ? {} : { index: entry.index }),
        many: entry.many ?? false,
        optional: entry.optional ?? false,
        ...(entry.propertyKey === undefined ? {} : { propertyKey: entry.propertyKey }),
        status: "resolved",
        token: entry.token,
      };
    }

    return {
      ...(entry.index === undefined ? {} : { index: entry.index }),
      many: entry.many ?? false,
      optional: entry.optional ?? false,
      ...(entry.propertyKey === undefined ? {} : { propertyKey: entry.propertyKey }),
      status: "uninspectable",
    };
  });
}

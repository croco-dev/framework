import type { Token as TypeDIToken } from "typedi";
import type { Constructor } from "./types";
import { MetadataStorage } from "./MetadataStorage";

export type InjectionTokenIdentifier<T = unknown> =
  | Constructor<T>
  | TypeDIToken<T>
  | string
  | symbol;

export type InjectionTokenResolver = () => InjectionTokenIdentifier | undefined;

export type InjectionMetadata = {
  readonly index?: number;
  readonly propertyKey?: string | symbol;
  readonly resolveToken: InjectionTokenResolver;
};

export type InjectionMetadataInspection =
  | {
      readonly index?: number;
      readonly propertyKey?: string | symbol;
      readonly status: "resolved";
      readonly token: InjectionTokenIdentifier;
    }
  | {
      readonly index?: number;
      readonly propertyKey?: string | symbol;
      readonly status: "uninspectable";
    };

const INJECTION_METADATA_KEY = Symbol("component:injection-metadata");

export function registerInjectionMetadata(target: object, metadata: InjectionMetadata): void {
  const existing = MetadataStorage.get<InjectionMetadata[]>(INJECTION_METADATA_KEY, target) ?? [];
  const next = existing
    .filter((entry) => entry.index !== metadata.index || entry.propertyKey !== metadata.propertyKey)
    .concat(metadata);

  MetadataStorage.define(INJECTION_METADATA_KEY, target, next);
}

export function getParameterInjectionToken(
  target: object,
  index: number,
): InjectionTokenIdentifier | undefined {
  const entries = MetadataStorage.get<InjectionMetadata[]>(INJECTION_METADATA_KEY, target) ?? [];
  const entry = entries.find((candidate) => candidate.index === index);
  if (!entry) {
    return undefined;
  }

  try {
    return entry.resolveToken();
  } catch {
    return undefined;
  }
}

export function inspectInjectionMetadata(target: object): readonly InjectionMetadataInspection[] {
  const entries = MetadataStorage.get<InjectionMetadata[]>(INJECTION_METADATA_KEY, target) ?? [];

  return entries.map((entry): InjectionMetadataInspection => {
    try {
      const token = entry.resolveToken();
      if (token === undefined) {
        return {
          ...(entry.index === undefined ? {} : { index: entry.index }),
          ...(entry.propertyKey === undefined ? {} : { propertyKey: entry.propertyKey }),
          status: "uninspectable",
        };
      }

      return {
        ...(entry.index === undefined ? {} : { index: entry.index }),
        ...(entry.propertyKey === undefined ? {} : { propertyKey: entry.propertyKey }),
        status: "resolved",
        token,
      };
    } catch {
      return {
        ...(entry.index === undefined ? {} : { index: entry.index }),
        ...(entry.propertyKey === undefined ? {} : { propertyKey: entry.propertyKey }),
        status: "uninspectable",
      };
    }
  });
}

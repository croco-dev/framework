import { registerInjectionMetadata } from "../InjectionMetadata";
import { Token } from "../Token";
import type { Constructor } from "../types";

type InjectIdentifier = string | symbol | Token<unknown> | ((type?: never) => Constructor<unknown>);

function isStaticInjectionToken(
  typeOrIdentifier: InjectIdentifier | undefined,
): typeOrIdentifier is string | symbol | Token<unknown> {
  if (
    typeof typeOrIdentifier === "string" ||
    typeof typeOrIdentifier === "symbol" ||
    typeOrIdentifier instanceof Token
  ) {
    return true;
  }
  return false;
}

export function Inject(): Function;
export function Inject(typeFn: (type?: never) => Constructor<unknown>): Function;
export function Inject(serviceName?: string): Function;
export function Inject(token: Token<unknown> | symbol): Function;
export function Inject(
  typeOrIdentifier?: InjectIdentifier,
): ParameterDecorator | PropertyDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ): void => {
    registerInjectionMetadata(target, {
      ...(parameterIndex === undefined ? {} : { index: parameterIndex }),
      ...(propertyKey === undefined ? {} : { propertyKey }),
      ...(isStaticInjectionToken(typeOrIdentifier) ? { token: typeOrIdentifier } : {}),
    });
  };
}

export function InjectMany(): Function;
export function InjectMany(typeFn: (type?: never) => Constructor<unknown>): Function;
export function InjectMany(serviceName?: string): Function;
export function InjectMany(token: Token<unknown> | symbol): Function;
export function InjectMany(
  typeOrIdentifier?: InjectIdentifier,
): ParameterDecorator | PropertyDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ): void => {
    registerInjectionMetadata(target, {
      ...(parameterIndex === undefined ? {} : { index: parameterIndex }),
      many: true,
      ...(propertyKey === undefined ? {} : { propertyKey }),
      ...(isStaticInjectionToken(typeOrIdentifier) ? { token: typeOrIdentifier } : {}),
    });
  };
}

export function InjectOptional(): Function;
export function InjectOptional(typeFn: (type?: never) => Constructor<unknown>): Function;
export function InjectOptional(serviceName?: string): Function;
export function InjectOptional(token: Token<unknown> | symbol): Function;
export function InjectOptional(
  typeOrIdentifier?: InjectIdentifier,
): ParameterDecorator | PropertyDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ): void => {
    registerInjectionMetadata(target, {
      ...(parameterIndex === undefined ? {} : { index: parameterIndex }),
      optional: true,
      ...(propertyKey === undefined ? {} : { propertyKey }),
      ...(isStaticInjectionToken(typeOrIdentifier) ? { token: typeOrIdentifier } : {}),
    });
  };
}

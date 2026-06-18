import { Inject as TypeDIInject, Token as TypeDIToken } from "typedi";
import type { InjectionTokenIdentifier } from "../InjectionMetadata";
import type { Constructor } from "../types";
import { registerInjectionMetadata } from "../InjectionMetadata";

type InjectIdentifier = string | TypeDIToken<unknown> | ((type?: never) => Constructor<unknown>);

type TypeDIInjectFn = (
  typeOrIdentifier?: InjectIdentifier,
) => ParameterDecorator | PropertyDecorator;

function createInjectionResolver(
  typeOrIdentifier: InjectIdentifier | undefined,
  target: object,
  propertyKey: string | symbol | undefined,
  parameterIndex: number | undefined,
): () => InjectionTokenIdentifier | undefined {
  if (typeof typeOrIdentifier === "string" || typeOrIdentifier instanceof TypeDIToken) {
    return () => typeOrIdentifier;
  }

  if (typeof typeOrIdentifier === "function") {
    return () => typeOrIdentifier() as InjectionTokenIdentifier;
  }

  if (typeof parameterIndex === "number") {
    return () => {
      const paramTypes = (
        propertyKey === undefined
          ? Reflect.getMetadata("design:paramtypes", target)
          : Reflect.getMetadata("design:paramtypes", target, propertyKey)
      ) as InjectionTokenIdentifier[] | undefined;
      return paramTypes?.[parameterIndex];
    };
  }

  if (propertyKey !== undefined) {
    return () =>
      Reflect.getMetadata("design:type", target, propertyKey) as
        | InjectionTokenIdentifier
        | undefined;
  }

  return () => undefined;
}

export function Inject(): Function;
export function Inject(typeFn: (type?: never) => Constructor<unknown>): Function;
export function Inject(serviceName?: string): Function;
export function Inject(token: TypeDIToken<unknown>): Function;
export function Inject(
  typeOrIdentifier?: InjectIdentifier,
): ParameterDecorator | PropertyDecorator {
  const typediInject = TypeDIInject as TypeDIInjectFn;
  const typediDecorator = typediInject(typeOrIdentifier);

  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ): void => {
    if (typeof parameterIndex === "number") {
      (typediDecorator as ParameterDecorator)(target, propertyKey, parameterIndex);
    } else if (propertyKey !== undefined) {
      (typediDecorator as PropertyDecorator)(target, propertyKey);
    }

    registerInjectionMetadata(target, {
      index: parameterIndex,
      propertyKey,
      resolveToken: createInjectionResolver(typeOrIdentifier, target, propertyKey, parameterIndex),
    });
  };
}

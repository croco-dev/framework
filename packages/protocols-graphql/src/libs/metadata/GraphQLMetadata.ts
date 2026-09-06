import "reflect-metadata";

export function defineGraphQLClassMetadata<T>(
  metadataKey: symbol,
  target: Function,
  value: T,
): void {
  Reflect.defineMetadata(metadataKey, value, target);
}

export function getGraphQLClassMetadata<T>(metadataKey: symbol, target: Function): T | undefined {
  return Reflect.getMetadata(metadataKey, target) as T | undefined;
}

export function defineGraphQLMethodMetadata<T>(
  metadataKey: symbol,
  target: object,
  propertyKey: string | symbol,
  value: T,
): void {
  Reflect.defineMetadata(metadataKey, value, target, propertyKey);
}

export function appendGraphQLMethodMetadata<T>(
  metadataKey: symbol,
  target: object,
  propertyKey: string | symbol,
  values: readonly T[],
): void {
  const existing = getGraphQLMethodMetadata<readonly T[]>(metadataKey, target, propertyKey) ?? [];
  defineGraphQLMethodMetadata(metadataKey, target, propertyKey, [...existing, ...values]);
}

export function appendGraphQLMethodOwnMetadata<T>(
  metadataKey: symbol,
  target: object,
  propertyKey: string | symbol,
  values: readonly T[],
): void {
  const existing =
    getGraphQLMethodOwnMetadata<readonly T[]>(metadataKey, target, propertyKey) ?? [];
  defineGraphQLMethodMetadata(metadataKey, target, propertyKey, [...existing, ...values]);
}

export function getGraphQLMethodMetadata<T>(
  metadataKey: symbol,
  target: object,
  propertyKey: string | symbol,
): T | undefined {
  return Reflect.getMetadata(metadataKey, target, propertyKey) as T | undefined;
}

export function getGraphQLMethodOwnMetadata<T>(
  metadataKey: symbol,
  target: object,
  propertyKey: string | symbol,
): T | undefined {
  return Reflect.getOwnMetadata(metadataKey, target, propertyKey) as T | undefined;
}

import 'reflect-metadata';

export const ENTITLEMENT_REQUIRED_KEY = 'entitlement:required';

export type RequireEntitlementOptions = {
  feature: string;
};

export function RequireEntitlement(options: RequireEntitlementOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, options.feature, target, propertyKey);
    return descriptor;
  };
}

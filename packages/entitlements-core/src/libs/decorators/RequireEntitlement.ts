import "reflect-metadata";
import type { EntitlementRequirement } from "../EntitlementRequirement";
import {
  appendEntitlementRequirement,
  ENTITLEMENT_REQUIRED_KEY,
  ENTITLEMENT_REQUIREMENTS_KEY,
} from "../EntitlementRequirement";

export { ENTITLEMENT_REQUIRED_KEY, ENTITLEMENT_REQUIREMENTS_KEY };
export type RequireEntitlementOptions = EntitlementRequirement;

export function RequireEntitlement(
  options: RequireEntitlementOptions,
): ClassDecorator & MethodDecorator {
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): PropertyDescriptor | undefined => {
    if (propertyKey === undefined) {
      appendEntitlementRequirement(target, options);
      return;
    }

    const metadataTarget = typeof target === "function" ? target : target.constructor;
    appendEntitlementRequirement(metadataTarget, options, propertyKey);
    return descriptor;
  };

  return decorator as ClassDecorator & MethodDecorator;
}

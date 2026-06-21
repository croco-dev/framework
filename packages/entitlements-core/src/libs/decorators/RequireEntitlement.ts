import "reflect-metadata";
import { capturePolicyDecisionSourceLocation } from "@croco/access-core";
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
  const sourceLocation = capturePolicyDecisionSourceLocation();
  const requirement: EntitlementRequirement = {
    ...options,
    ruleId: options.ruleId ?? `entitlement:${options.feature}`,
    ...(sourceLocation ? { sourceLocation } : {}),
  };

  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): PropertyDescriptor | undefined => {
    if (propertyKey === undefined) {
      appendEntitlementRequirement(target, requirement);
      return;
    }

    const metadataTarget = typeof target === "function" ? target : target.constructor;
    appendEntitlementRequirement(metadataTarget, requirement, propertyKey);
    return descriptor;
  };

  return decorator as ClassDecorator & MethodDecorator;
}

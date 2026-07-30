import "reflect-metadata";
import { capturePolicyDecisionSourceLocation } from "@croco/access-core";
import { featureKey } from "../EntitlementDefinition";
import type {
  EntitlementRequirement,
  EntitlementRequirementInput,
} from "../EntitlementRequirement";
import {
  appendEntitlementRequirement,
  ENTITLEMENT_REQUIRED_KEY,
  ENTITLEMENT_REQUIREMENTS_KEY,
} from "../EntitlementRequirement";

export { ENTITLEMENT_REQUIRED_KEY, ENTITLEMENT_REQUIREMENTS_KEY };
export type RequireEntitlementOptions = EntitlementRequirementInput;

export function RequireEntitlement(
  options: RequireEntitlementOptions,
): ClassDecorator & MethodDecorator {
  const sourceLocation = capturePolicyDecisionSourceLocation();
  const normalizedFeature = featureKey(options.feature);
  const requirement: EntitlementRequirement = {
    ...options,
    feature: normalizedFeature,
    ruleId: options.ruleId ?? `entitlement:${normalizedFeature}`,
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

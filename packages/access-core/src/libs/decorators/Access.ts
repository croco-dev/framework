import "reflect-metadata";
import { ACCESS_METADATA_KEY } from "../constants";
import { capturePolicyDecisionSourceLocation } from "../PolicyDecisionTrace.js";
import type { AccessRuleMetadata } from "../types.js";

export function Access(objectType: string, relation: string): MethodDecorator {
  const sourceLocation = capturePolicyDecisionSourceLocation();
  const metadata: AccessRuleMetadata = {
    objectType,
    relation,
    ruleId: `access:${objectType}:${relation}`,
    ...(sourceLocation ? { sourceLocation } : {}),
  };

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(ACCESS_METADATA_KEY, metadata, target.constructor, propertyKey);
    return descriptor;
  };
}

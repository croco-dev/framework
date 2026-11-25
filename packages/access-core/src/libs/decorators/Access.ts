import "reflect-metadata";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { ACCESS_METADATA_KEY } from "../constants";
import { capturePolicyDecisionSourceLocation } from "../PolicyDecisionTrace.js";
import type { AccessRuleMetadata } from "../types.js";

const ACCESS_DECLARED_KEY = Symbol.for("croco:access:declared");

class DuplicateAccessDeclarationProblem extends Problem {
  constructor(propertyKey: string | symbol) {
    super(
      "access-core/duplicate-access-declaration",
      ProblemCategory.InternalServerError,
      `Declare @Access only once on method ${String(propertyKey)}`,
    );
  }
}

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
    if (Reflect.hasOwnMetadata(ACCESS_DECLARED_KEY, target, propertyKey)) {
      throw new DuplicateAccessDeclarationProblem(propertyKey);
    }

    Reflect.defineMetadata(ACCESS_DECLARED_KEY, true, target, propertyKey);
    Reflect.defineMetadata(ACCESS_METADATA_KEY, metadata, target.constructor, propertyKey);
    return descriptor;
  };
}

import "reflect-metadata";
import type { PolicyDecisionSourceLocation } from "@croco/access-core";
import { EntitlementRequirementProblem } from "./problems/EntitlementProblems";

export const ENTITLEMENT_REQUIRED_KEY = "entitlement:required";
export const ENTITLEMENT_REQUIREMENTS_KEY = Symbol.for("croco:entitlements:requirements");

export type EntitlementResourceRequirement = {
  readonly type: string;
  readonly id?: string;
  readonly idParam?: string;
};

export type EntitlementRequirement = {
  readonly feature: string;
  readonly description?: string;
  readonly resource?: EntitlementResourceRequirement;
  readonly ruleId?: string;
  readonly sourceLocation?: PolicyDecisionSourceLocation;
};

export type EntitlementRequirementMetadata = EntitlementRequirement;

export function defineEntitlementRequirement(
  requirement: EntitlementRequirement,
): EntitlementRequirement {
  assertValidEntitlementRequirement(requirement);

  return {
    feature: requirement.feature,
    ...(requirement.description ? { description: requirement.description } : {}),
    ...(requirement.resource
      ? { resource: normalizeResourceRequirement(requirement.resource) }
      : {}),
    ruleId: requirement.ruleId ?? `entitlement:${requirement.feature}`,
    ...(requirement.sourceLocation ? { sourceLocation: requirement.sourceLocation } : {}),
  };
}

export function appendEntitlementRequirement(
  target: object,
  requirement: EntitlementRequirement,
  propertyKey?: string | symbol,
): void {
  const normalized = defineEntitlementRequirement(requirement);
  const existing = getOwnEntitlementRequirements(target, propertyKey);

  if (propertyKey === undefined) {
    Reflect.defineMetadata(ENTITLEMENT_REQUIREMENTS_KEY, [...existing, normalized], target);
    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, normalized.feature, target);
    return;
  }

  Reflect.defineMetadata(
    ENTITLEMENT_REQUIREMENTS_KEY,
    [...existing, normalized],
    target,
    propertyKey,
  );
  Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, normalized.feature, target, propertyKey);
}

export function getEntitlementRequirements(
  controllerTarget: unknown,
  handler: string | symbol,
): readonly EntitlementRequirement[] {
  if (!isMetadataTarget(controllerTarget)) {
    return [];
  }

  const classTarget =
    typeof controllerTarget === "function" ? controllerTarget : controllerTarget.constructor;
  const prototypeTarget =
    typeof controllerTarget === "function" ? controllerTarget.prototype : controllerTarget;

  return [
    ...readEntitlementRequirements(classTarget),
    ...readEntitlementRequirements(prototypeTarget),
    ...readEntitlementRequirements(classTarget, handler),
    ...readEntitlementRequirements(prototypeTarget, handler),
  ];
}

function getOwnEntitlementRequirements(
  target: object,
  propertyKey?: string | symbol,
): readonly EntitlementRequirement[] {
  const value =
    propertyKey === undefined
      ? Reflect.getOwnMetadata(ENTITLEMENT_REQUIREMENTS_KEY, target)
      : Reflect.getOwnMetadata(ENTITLEMENT_REQUIREMENTS_KEY, target, propertyKey);

  return normalizeRequirementList(value);
}

function readEntitlementRequirements(
  target: object,
  propertyKey?: string | symbol,
): readonly EntitlementRequirement[] {
  const current =
    propertyKey === undefined
      ? Reflect.getMetadata(ENTITLEMENT_REQUIREMENTS_KEY, target)
      : Reflect.getMetadata(ENTITLEMENT_REQUIREMENTS_KEY, target, propertyKey);
  const requirements = normalizeRequirementList(current);

  if (requirements.length > 0) {
    return requirements;
  }

  const legacy =
    propertyKey === undefined
      ? Reflect.getMetadata(ENTITLEMENT_REQUIRED_KEY, target)
      : Reflect.getMetadata(ENTITLEMENT_REQUIRED_KEY, target, propertyKey);

  return typeof legacy === "string" && legacy.length > 0
    ? [defineEntitlementRequirement({ feature: legacy })]
    : [];
}

function normalizeRequirementList(value: unknown): readonly EntitlementRequirement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isEntitlementRequirement).map(defineEntitlementRequirement);
}

function isEntitlementRequirement(value: unknown): value is EntitlementRequirement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    readonly feature?: unknown;
    readonly resource?: unknown;
  };

  return (
    typeof candidate.feature === "string" &&
    candidate.feature.length > 0 &&
    (candidate.resource === undefined || isEntitlementResourceRequirement(candidate.resource))
  );
}

function assertValidEntitlementRequirement(requirement: EntitlementRequirement): void {
  if (typeof requirement.feature !== "string" || requirement.feature.length === 0) {
    throw new EntitlementRequirementProblem("Entitlement requirement feature must not be empty.");
  }

  if (requirement.resource) {
    normalizeResourceRequirement(requirement.resource);
  }
}

function normalizeResourceRequirement(
  resource: EntitlementResourceRequirement,
): EntitlementResourceRequirement {
  if (typeof resource.type !== "string" || resource.type.length === 0) {
    throw new EntitlementRequirementProblem(
      "Entitlement resource requirement type must not be empty.",
    );
  }

  if (resource.id !== undefined && (typeof resource.id !== "string" || resource.id.length === 0)) {
    throw new EntitlementRequirementProblem(
      "Entitlement resource requirement id must not be empty.",
    );
  }

  if (
    resource.idParam !== undefined &&
    (typeof resource.idParam !== "string" || resource.idParam.length === 0)
  ) {
    throw new EntitlementRequirementProblem(
      "Entitlement resource requirement idParam must not be empty.",
    );
  }

  return {
    type: resource.type,
    ...(resource.id ? { id: resource.id } : {}),
    ...(resource.idParam ? { idParam: resource.idParam } : {}),
  };
}

function isEntitlementResourceRequirement(value: unknown): value is EntitlementResourceRequirement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    readonly type?: unknown;
    readonly id?: unknown;
    readonly idParam?: unknown;
  };

  return (
    typeof candidate.type === "string" &&
    candidate.type.length > 0 &&
    (candidate.id === undefined || (typeof candidate.id === "string" && candidate.id.length > 0)) &&
    (candidate.idParam === undefined ||
      (typeof candidate.idParam === "string" && candidate.idParam.length > 0))
  );
}

function isMetadataTarget(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

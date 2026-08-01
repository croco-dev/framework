import { planVersionRef } from "@croco/billing-core";
import type { PlanVersionRef } from "@croco/billing-core";
import type { MeterRef } from "@croco/metering-core";
import {
  EntitlementDefinitionProblem,
  EntitlementPlanVersionMismatchProblem,
} from "./problems/EntitlementProblems";
import type {
  EntitlementRule,
  OveragePolicy,
  PlanEntitlements,
  VersionBoundEntitlementRule,
} from "./types";

declare const FEATURE_REF_BRAND: unique symbol;

export type FeatureRef<Key extends string = string> = {
  readonly key: Key;
  readonly [FEATURE_REF_BRAND]: true;
};

export type FeatureReference = string | FeatureRef;
export type MeterReference = string | MeterRef;
export type BillingRequiredMeterRef = MeterRef<
  string,
  MeterRef["aggregation"],
  string,
  MeterRef["dimensions"],
  "required"
>;

type BaseEntitlementDefinition<Feature extends FeatureReference> = {
  readonly feature: Feature;
};

type BooleanEntitlementDefinition<Feature extends FeatureReference> =
  BaseEntitlementDefinition<Feature> & {
    readonly type: "boolean";
  };

type StaticEntitlementDefinition<Feature extends FeatureReference> =
  BaseEntitlementDefinition<Feature> & {
    readonly type: "static";
    readonly value: number;
  };

type LimitedMeteredEntitlementDefinition<
  Feature extends FeatureReference,
  Meter extends MeterReference,
> = BaseEntitlementDefinition<Feature> & {
  readonly type: "metered";
  readonly meter?: Meter;
  readonly quota: number;
  readonly overagePolicy?: Exclude<OveragePolicy, "ALLOW_WITH_OVERAGE">;
};

type BillableOverageEntitlementDefinition<
  Feature extends FeatureReference,
  Meter extends BillingRequiredMeterRef,
> = BaseEntitlementDefinition<Feature> & {
  readonly type: "metered";
  readonly meter: Meter;
  readonly quota: number;
  readonly overagePolicy: "ALLOW_WITH_OVERAGE";
};

export type EntitlementDefinition<Feature extends FeatureReference = FeatureReference> =
  | BooleanEntitlementDefinition<Feature>
  | StaticEntitlementDefinition<Feature>
  | LimitedMeteredEntitlementDefinition<Feature, MeterReference>
  | BillableOverageEntitlementDefinition<Feature, BillingRequiredMeterRef>;

export type PlanEntitlementDefinition<
  Definitions extends readonly EntitlementDefinition[] = readonly EntitlementDefinition[],
> = {
  readonly planId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly entitlements: Definitions;
};

export function defineFeature<const Key extends string>(key: Key): FeatureRef<Key> {
  if (key.trim().length === 0) {
    throw new EntitlementDefinitionProblem("Feature keys must not be empty.");
  }

  return Object.freeze({ key }) as FeatureRef<Key>;
}

export function featureKey(reference: FeatureReference): string {
  if (typeof reference === "string") {
    return reference;
  }
  if (typeof reference === "object" && reference !== null && typeof reference.key === "string") {
    return reference.key;
  }

  throw new EntitlementDefinitionProblem("Feature references require a string key.");
}

export function meterKey(reference: MeterReference): string {
  if (typeof reference === "string") {
    return reference;
  }
  if (typeof reference === "object" && reference !== null && typeof reference.key === "string") {
    return reference.key;
  }

  throw new EntitlementDefinitionProblem("Meter references require a string key.");
}

export function definePlanEntitlements(definition: PlanEntitlementDefinition): PlanEntitlements {
  assertNonEmpty("Plan ID", definition.planId);
  assertNonEmpty("Plan version reference", definition.planVersionRef);

  const entitlements = definition.entitlements.map(normalizeEntitlementDefinition);
  assertUniqueFeatures(entitlements);

  return Object.freeze({
    planId: definition.planId,
    planVersionRef: definition.planVersionRef,
    entitlements: Object.freeze(entitlements),
  });
}

export function legacyPlanVersionRef(planId: string): PlanVersionRef {
  assertNonEmpty("Legacy plan ID", planId);
  return planVersionRef(`legacy:${planId}`);
}

export function getLegacyPlanId(ref: PlanVersionRef): string | null {
  const value = String(ref);
  if (!value.startsWith("legacy:")) {
    return null;
  }

  const planId = value.slice("legacy:".length);
  return planId.length > 0 ? planId : null;
}

export function migrateLegacyPlanEntitlements(
  legacy: {
    readonly planId: string;
    readonly entitlements: readonly EntitlementRule[];
  },
  ref: PlanVersionRef,
): PlanEntitlements {
  assertNonEmpty("Plan ID", legacy.planId);
  assertNonEmpty("Plan version reference", ref);

  if (getLegacyPlanId(ref) !== null) {
    throw new EntitlementDefinitionProblem(
      "Migration requires a published plan version reference, not a legacy reference.",
    );
  }

  const entitlements = legacy.entitlements.map(normalizeLegacyRule);
  assertUniqueFeatures(entitlements);
  assertVersionBoundRules(entitlements);

  return Object.freeze({
    planId: legacy.planId,
    planVersionRef: ref,
    entitlements: Object.freeze(entitlements),
  });
}

export function assertPlanVersionMatches(
  expectedPlanId: string,
  definition: PlanEntitlements,
): void {
  if (definition.planId !== expectedPlanId) {
    throw new EntitlementPlanVersionMismatchProblem(
      definition.planVersionRef,
      expectedPlanId,
      definition.planId,
    );
  }
}

function normalizeEntitlementDefinition(
  definition: EntitlementDefinition,
): VersionBoundEntitlementRule {
  const normalizedFeatureKey = featureKey(definition.feature);
  assertNonEmpty("Feature key", normalizedFeatureKey);

  switch (definition.type) {
    case "boolean":
      return Object.freeze({
        featureKey: normalizedFeatureKey,
        type: definition.type,
      });
    case "static":
      assertFiniteNonNegative("Static entitlement value", definition.value);
      return Object.freeze({
        featureKey: normalizedFeatureKey,
        type: definition.type,
        value: definition.value,
      });
    case "metered": {
      const normalizedMeterId =
        definition.meter === undefined ? undefined : meterKey(definition.meter);
      if (normalizedMeterId !== undefined) {
        assertNonEmpty("Meter key", normalizedMeterId);
      }
      if (definition.quota !== undefined) {
        assertFiniteNonNegative("Entitlement quota", definition.quota);
      }
      if (definition.quota === undefined) {
        throw new EntitlementDefinitionProblem(
          `Version-bound metered entitlement '${normalizedFeatureKey}' requires an inline quota.`,
        );
      }
      if (
        definition.overagePolicy === "ALLOW_WITH_OVERAGE" &&
        (typeof definition.meter === "string" ||
          definition.meter === undefined ||
          definition.meter.billing !== "required")
      ) {
        throw new EntitlementDefinitionProblem(
          `Entitlement '${normalizedFeatureKey}' allows billable overage without a billing-required meter.`,
        );
      }

      return Object.freeze({
        featureKey: normalizedFeatureKey,
        type: definition.type,
        ...(normalizedMeterId === undefined ? {} : { meterId: normalizedMeterId }),
        ...(typeof definition.meter === "object" ? { meterBilling: definition.meter.billing } : {}),
        quota: definition.quota,
        ...(definition.overagePolicy === undefined
          ? {}
          : { overagePolicy: definition.overagePolicy }),
      });
    }
    default:
      throw new EntitlementDefinitionProblem("Unknown entitlement type.");
  }
}

function normalizeLegacyRule(rule: EntitlementRule): VersionBoundEntitlementRule {
  assertNonEmpty("Feature key", rule.featureKey);
  if (rule.type === "boolean")
    return Object.freeze({ featureKey: rule.featureKey, type: "boolean" });
  if (rule.type === "static") {
    if (rule.value === undefined) {
      throw new EntitlementDefinitionProblem(
        `Version-bound static entitlement '${rule.featureKey}' requires an inline value.`,
      );
    }
    assertFiniteNonNegative("Static entitlement value", rule.value);
    return Object.freeze({ featureKey: rule.featureKey, type: "static", value: rule.value });
  }
  if (rule.quota === undefined) {
    throw new EntitlementDefinitionProblem(
      `Version-bound metered entitlement '${rule.featureKey}' requires an inline quota.`,
    );
  }
  if (rule.meterId !== undefined) assertNonEmpty("Meter key", rule.meterId);
  assertFiniteNonNegative("Entitlement quota", rule.quota);
  return Object.freeze({
    featureKey: rule.featureKey,
    type: "metered",
    quota: rule.quota,
    ...(rule.meterId === undefined ? {} : { meterId: rule.meterId }),
    ...(rule.meterBilling === undefined ? {} : { meterBilling: rule.meterBilling }),
    ...(rule.overagePolicy === undefined ? {} : { overagePolicy: rule.overagePolicy }),
  });
}

function assertUniqueFeatures(entitlements: readonly EntitlementRule[]): void {
  const featureKeys = new Set<string>();
  for (const entitlement of entitlements) {
    if (featureKeys.has(entitlement.featureKey)) {
      throw new EntitlementDefinitionProblem(
        `Feature '${entitlement.featureKey}' is declared more than once for one plan version.`,
      );
    }
    featureKeys.add(entitlement.featureKey);
  }
}

function assertVersionBoundRules(entitlements: readonly EntitlementRule[]): void {
  for (const entitlement of entitlements) {
    if (entitlement.type === "metered" && entitlement.quota === undefined) {
      throw new EntitlementDefinitionProblem(
        `Version-bound metered entitlement '${entitlement.featureKey}' requires an inline quota.`,
      );
    }
    if (
      entitlement.overagePolicy === "ALLOW_WITH_OVERAGE" &&
      (entitlement.meterId === undefined || entitlement.meterBilling !== "required")
    ) {
      throw new EntitlementDefinitionProblem(
        `Entitlement '${entitlement.featureKey}' allows billable overage without a billing-required meter.`,
      );
    }
  }
}

function assertNonEmpty(label: string, value: string): void {
  if (value.trim().length === 0) {
    throw new EntitlementDefinitionProblem(`${label} must not be empty.`);
  }
}

function assertFiniteNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new EntitlementDefinitionProblem(`${label} must be a finite non-negative number.`);
  }
}

import { EntitlementDefinitionProblem } from "./problems/EntitlementProblems";
import type { EntitlementRule } from "./types";

export function assertEntitlementRules(rules: readonly EntitlementRule[]): void {
  const featureKeys = new Set<string>();

  for (const rule of rules) {
    assertNonEmpty("Feature key", rule.featureKey);
    if (featureKeys.has(rule.featureKey)) {
      throw new EntitlementDefinitionProblem(
        `Feature '${rule.featureKey}' is declared more than once for one entitlement set.`,
      );
    }

    switch (rule.type) {
      case "boolean":
        break;
      case "static":
        if (rule.value === undefined) {
          throw new EntitlementDefinitionProblem(
            `Static entitlement '${rule.featureKey}' requires a value.`,
          );
        }
        assertFiniteNonNegative("Static entitlement value", rule.value);
        break;
      case "metered":
        if (rule.quota !== undefined) {
          assertFiniteNonNegative("Entitlement quota", rule.quota);
        }
        if (rule.meterId !== undefined) {
          assertNonEmpty("Meter key", rule.meterId);
        }
        break;
      default:
        throw new EntitlementDefinitionProblem(
          `Entitlement '${rule.featureKey}' has unknown type '${String(rule.type)}'.`,
        );
    }

    if (
      rule.meterBilling !== undefined &&
      rule.meterBilling !== "local" &&
      rule.meterBilling !== "required"
    ) {
      throw new EntitlementDefinitionProblem(
        `Entitlement '${rule.featureKey}' has unknown meter billing '${String(rule.meterBilling)}'.`,
      );
    }
    if (
      rule.overagePolicy !== undefined &&
      rule.overagePolicy !== "BLOCK" &&
      rule.overagePolicy !== "WARN" &&
      rule.overagePolicy !== "ALLOW_WITH_OVERAGE"
    ) {
      throw new EntitlementDefinitionProblem(
        `Entitlement '${rule.featureKey}' has unknown overage policy '${String(rule.overagePolicy)}'.`,
      );
    }
    if (
      rule.overagePolicy === "ALLOW_WITH_OVERAGE" &&
      (rule.meterId === undefined || rule.meterBilling !== "required")
    ) {
      throw new EntitlementDefinitionProblem(
        `Entitlement '${rule.featureKey}' allows billable overage without a billing-required meter.`,
      );
    }

    featureKeys.add(rule.featureKey);
  }
}

function assertNonEmpty(label: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EntitlementDefinitionProblem(`${label} must not be empty.`);
  }
}

function assertFiniteNonNegative(label: string, value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new EntitlementDefinitionProblem(`${label} must be a finite non-negative number.`);
  }
}

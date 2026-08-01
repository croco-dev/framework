import { Component } from "@croco/framework-context";
import type { PlanVersionRef } from "@croco/billing-core";
import { legacyPlanVersionRef } from "./EntitlementDefinition";
import { getLegacyPlanId } from "./EntitlementDefinition";
import { PlanEntitlementRegistry } from "./interfaces";
import {
  EntitlementDefinitionProblem,
  EntitlementPlanVersionAlreadyRegisteredProblem,
  EntitlementPlanVersionMismatchProblem,
  EntitlementPlanVersionNotFoundProblem,
} from "./problems/EntitlementProblems";
import type { EntitlementRule, PlanEntitlements } from "./types";

type StoredPlanEntitlements = {
  readonly planId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly entitlements: readonly EntitlementRule[];
};

@Component()
export class InMemoryPlanEntitlementRegistry extends PlanEntitlementRegistry {
  private readonly registry = new Map<PlanVersionRef, StoredPlanEntitlements>();

  register(definition: PlanEntitlements): void;
  register(planId: string, rules: EntitlementRule[]): void;
  register(definitionOrPlanId: PlanEntitlements | string, rules?: EntitlementRule[]): void {
    if (typeof definitionOrPlanId === "string") {
      const ref = legacyPlanVersionRef(definitionOrPlanId);
      if (this.registry.has(ref)) throw new EntitlementPlanVersionAlreadyRegisteredProblem(ref);
      this.registry.set(ref, {
        planId: definitionOrPlanId,
        planVersionRef: ref,
        entitlements: Object.freeze((rules ?? []).map((rule) => Object.freeze({ ...rule }))),
      });
      return;
    }
    const definition = definitionOrPlanId;
    if (this.registry.has(definition.planVersionRef)) {
      throw new EntitlementPlanVersionAlreadyRegisteredProblem(definition.planVersionRef);
    }
    if (getLegacyPlanId(definition.planVersionRef) === null) assertVersionBoundRules(definition);

    this.registry.set(definition.planVersionRef, {
      planId: definition.planId,
      planVersionRef: definition.planVersionRef,
      entitlements: Object.freeze(
        definition.entitlements.map((rule) => Object.freeze({ ...rule })),
      ),
    });
  }

  clear(): void {
    this.registry.clear();
  }

  async getEntitlements(planId: string): Promise<EntitlementRule[]> {
    const definition = this.registry.get(legacyPlanVersionRef(planId));
    return definition ? [...definition.entitlements] : [];
  }

  async findRule(planId: string, featureKey: string): Promise<EntitlementRule | null> {
    const definition = this.registry.get(legacyPlanVersionRef(planId));
    if (!definition) {
      return null;
    }

    return definition.entitlements.find((rule) => rule.featureKey === featureKey) ?? null;
  }

  override async getEntitlementsByPlanVersion(
    ref: PlanVersionRef,
    expectedPlanId?: string,
  ): Promise<readonly EntitlementRule[]> {
    const definition = this.registry.get(ref);
    if (!definition) {
      throw new EntitlementPlanVersionNotFoundProblem(ref);
    }
    if (expectedPlanId !== undefined) {
      if (definition.planId !== expectedPlanId) {
        throw new EntitlementPlanVersionMismatchProblem(ref, expectedPlanId, definition.planId);
      }
    }

    return [...definition.entitlements];
  }

  override async findRuleByPlanVersion(
    ref: PlanVersionRef,
    featureKey: string,
    expectedPlanId?: string,
  ): Promise<EntitlementRule | null> {
    const entitlements = await this.getEntitlementsByPlanVersion(ref, expectedPlanId);
    return entitlements.find((rule) => rule.featureKey === featureKey) ?? null;
  }
}

function assertVersionBoundRules(definition: PlanEntitlements): void {
  const features = new Set<string>();
  for (const rule of definition.entitlements) {
    if (features.has(rule.featureKey)) {
      throw new EntitlementDefinitionProblem(
        `Feature '${rule.featureKey}' is declared more than once for one plan version.`,
      );
    }
    if (
      rule.type === "metered" &&
      rule.overagePolicy === "ALLOW_WITH_OVERAGE" &&
      (rule.meterId === undefined || rule.meterBilling !== "required")
    ) {
      throw new EntitlementDefinitionProblem(
        `Entitlement '${rule.featureKey}' allows billable overage without a billing-required meter.`,
      );
    }
    if (rule.type === "metered" && rule.quota === undefined) {
      throw new EntitlementDefinitionProblem(
        `Version-bound metered entitlement '${rule.featureKey}' requires an inline quota.`,
      );
    }
    features.add(rule.featureKey);
  }
}

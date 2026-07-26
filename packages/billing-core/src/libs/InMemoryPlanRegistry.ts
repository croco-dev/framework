import type {
  PlanVersionDefinition,
  PlanVersionRef,
  ProviderPlanBinding,
  ProviderPlanLookup,
} from "../types";
import type { PlanRegistry } from "./PlanRegistry";
import {
  InvalidPlanVersionDefinitionProblem,
  PlanVersionAlreadyPublishedProblem,
  PlanVersionConflictProblem,
  UnknownProviderPlanMappingProblem,
} from "./problems/BillingProblems";

export class InMemoryPlanRegistry implements PlanRegistry {
  private readonly versions = new Map<PlanVersionRef, PlanVersionDefinition>();

  async publishPlanVersion(planVersion: PlanVersionDefinition): Promise<void> {
    validatePlanVersion(planVersion);

    if (this.versions.has(planVersion.ref)) {
      throw new PlanVersionAlreadyPublishedProblem(planVersion.ref);
    }

    const identityConflict = [...this.versions.values()].find(
      (published) =>
        published.planId === planVersion.planId && published.versionId === planVersion.versionId,
    );
    if (identityConflict) {
      throw new PlanVersionConflictProblem(
        planVersion.ref,
        `plan '${planVersion.planId}' version '${planVersion.versionId}' is already '${identityConflict.ref}'`,
      );
    }

    const effectiveTimeConflict = [...this.versions.values()].find(
      (published) =>
        published.planId === planVersion.planId &&
        Date.parse(published.effectiveAt) === Date.parse(planVersion.effectiveAt),
    );
    if (effectiveTimeConflict) {
      throw new PlanVersionConflictProblem(
        planVersion.ref,
        `plan '${planVersion.planId}' effective time '${planVersion.effectiveAt}' is already '${effectiveTimeConflict.ref}'`,
      );
    }

    for (const binding of planVersion.providerBindings) {
      const bindingConflict = [...this.versions.values()].find((published) =>
        published.providerBindings.some((candidate) => providerBindingsEqual(candidate, binding)),
      );
      if (bindingConflict) {
        throw new PlanVersionConflictProblem(
          planVersion.ref,
          `provider '${binding.provider}' product '${binding.productId}' is already bound by '${bindingConflict.ref}'`,
        );
      }
    }

    this.versions.set(planVersion.ref, freezePlanVersion(planVersion));
  }

  async getPlan(planId: string): Promise<PlanVersionDefinition | null> {
    return this.getPlanAtDate(planId, new Date());
  }

  async getAllPlans(): Promise<PlanVersionDefinition[]> {
    const planIds = [...new Set([...this.versions.values()].map(({ planId }) => planId))];
    const plans = await Promise.all(planIds.map((planId) => this.getPlan(planId)));

    return plans.filter((plan): plan is PlanVersionDefinition => plan !== null);
  }

  async getPlanVersion(ref: PlanVersionRef): Promise<PlanVersionDefinition | null> {
    return this.versions.get(ref) ?? null;
  }

  async getAllPlanVersions(planId?: string): Promise<PlanVersionDefinition[]> {
    return [...this.versions.values()]
      .filter((version) => planId === undefined || version.planId === planId)
      .sort(comparePlanVersions);
  }

  async getPlanAtDate(planId: string, date: Date): Promise<PlanVersionDefinition | null> {
    const timestamp = date.getTime();
    if (Number.isNaN(timestamp)) {
      throw new InvalidPlanVersionDefinitionProblem("lookup date must be valid");
    }

    const candidates = [...this.versions.values()]
      .filter(
        (version) => version.planId === planId && Date.parse(version.effectiveAt) <= timestamp,
      )
      .sort(comparePlanVersions);

    return candidates.at(-1) ?? null;
  }

  async resolveProviderPlanVersion(lookup: ProviderPlanLookup): Promise<PlanVersionDefinition> {
    const normalizedLookup = normalizeProviderLookup(lookup);
    const matches = [...this.versions.values()].filter((version) =>
      version.providerBindings.some((binding) => providerBindingsEqual(binding, normalizedLookup)),
    );

    if (matches.length !== 1) {
      throw new UnknownProviderPlanMappingProblem(
        lookup.provider,
        lookup.productId,
        lookup.priceIds,
      );
    }

    return matches[0];
  }
}

function validatePlanVersion(planVersion: PlanVersionDefinition): void {
  const effectiveAt = new Date(planVersion.effectiveAt);
  if (
    !isNonEmpty(planVersion.ref) ||
    !isNonEmpty(planVersion.planId) ||
    !isNonEmpty(planVersion.versionId) ||
    !isNonEmpty(planVersion.name) ||
    Number.isNaN(effectiveAt.getTime()) ||
    effectiveAt.toISOString() !== planVersion.effectiveAt ||
    !Number.isSafeInteger(planVersion.amount) ||
    planVersion.amount < 0 ||
    planVersion.currency.length !== 3 ||
    !Number.isSafeInteger(planVersion.intervalCount) ||
    planVersion.intervalCount <= 0 ||
    planVersion.providerBindings.length === 0
  ) {
    throw new InvalidPlanVersionDefinitionProblem("required fields are invalid");
  }

  if (planVersion.rating.mode === "provider") {
    const ratingProvider = planVersion.rating.provider;
    if (
      !isNonEmpty(ratingProvider) ||
      !planVersion.providerBindings.some(({ provider }) => provider === ratingProvider)
    ) {
      throw new InvalidPlanVersionDefinitionProblem(
        "provider-rated versions require a binding for their rating provider",
      );
    }
  }

  if (
    planVersion.providerBindings.some(
      ({ provider, productId, priceIds }) =>
        !isNonEmpty(provider) ||
        !isNonEmpty(productId) ||
        priceIds.some((priceId) => !isNonEmpty(priceId)),
    )
  ) {
    throw new InvalidPlanVersionDefinitionProblem(
      "provider bindings require non-empty provider, product, and price identifiers",
    );
  }

  const bindingKeys = planVersion.providerBindings.map(providerBindingKey);
  if (new Set(bindingKeys).size !== bindingKeys.length) {
    throw new InvalidPlanVersionDefinitionProblem("provider bindings must be unique");
  }
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function comparePlanVersions(left: PlanVersionDefinition, right: PlanVersionDefinition): number {
  const effectiveDifference = Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt);
  return effectiveDifference === 0
    ? left.versionId.localeCompare(right.versionId)
    : effectiveDifference;
}

function normalizeProviderLookup(lookup: ProviderPlanLookup): ProviderPlanBinding {
  return {
    provider: lookup.provider,
    productId: lookup.productId,
    priceIds: [...new Set(lookup.priceIds)].sort(),
  };
}

function providerBindingKey(binding: ProviderPlanBinding): string {
  return JSON.stringify(normalizeProviderLookup(binding));
}

function providerBindingsEqual(left: ProviderPlanBinding, right: ProviderPlanBinding): boolean {
  return providerBindingKey(left) === providerBindingKey(right);
}

function freezePlanVersion(planVersion: PlanVersionDefinition): PlanVersionDefinition {
  const providerBindings = planVersion.providerBindings.map((binding) =>
    Object.freeze({
      ...binding,
      priceIds: Object.freeze([...new Set(binding.priceIds)].sort()),
    }),
  );

  return Object.freeze({
    ...planVersion,
    rating: Object.freeze({ ...planVersion.rating }),
    providerBindings: Object.freeze(providerBindings),
  });
}

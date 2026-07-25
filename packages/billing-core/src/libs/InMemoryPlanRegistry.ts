import type { PlanVersionDefinition, PlanVersionRef, ProviderPlanMapping } from "../types";
import type { PlanRegistry } from "./PlanRegistry";
import {
  InvalidPlanVersionDefinitionProblem,
  PlanVersionAlreadyPublishedProblem,
  UnknownPlanVersionMappingProblem,
} from "./problems/BillingProblems";

export class InMemoryPlanRegistry implements PlanRegistry {
  private readonly versions = new Map<PlanVersionRef, PlanVersionDefinition>();

  constructor(definitions: readonly PlanVersionDefinition[] = []) {
    for (const definition of definitions) {
      this.publish(definition);
    }
  }

  async publishPlanVersion(definition: PlanVersionDefinition): Promise<void> {
    this.publish(definition);
  }

  async getPlanVersion(ref: PlanVersionRef): Promise<PlanVersionDefinition | null> {
    return this.versions.get(ref) ?? null;
  }

  async getPlan(planId: string): Promise<PlanVersionDefinition | null> {
    return this.getPlanAtDate(planId, new Date());
  }

  async getAllPlans(): Promise<PlanVersionDefinition[]> {
    const latestByPlanId = new Map<string, PlanVersionDefinition>();
    const now = new Date().toISOString();

    for (const definition of this.versions.values()) {
      if (definition.effectiveAt > now) {
        continue;
      }
      const existing = latestByPlanId.get(definition.planId);
      if (!existing || definition.effectiveAt > existing.effectiveAt) {
        latestByPlanId.set(definition.planId, definition);
      }
    }

    return [...latestByPlanId.values()].sort((left, right) =>
      left.planId.localeCompare(right.planId),
    );
  }

  async getPlanAtDate(planId: string, date: Date): Promise<PlanVersionDefinition | null> {
    if (Number.isNaN(date.getTime())) {
      throw new InvalidPlanVersionDefinitionProblem("historical lookup date must be valid");
    }
    const timestamp = date.toISOString();
    let selected: PlanVersionDefinition | null = null;

    for (const definition of this.versions.values()) {
      if (
        definition.planId === planId &&
        definition.effectiveAt <= timestamp &&
        (!selected || definition.effectiveAt > selected.effectiveAt)
      ) {
        selected = definition;
      }
    }

    return selected;
  }

  async resolveProviderPlanVersion(mapping: ProviderPlanMapping): Promise<PlanVersionDefinition> {
    const requestedPriceIds = mapping.priceIds ? [...new Set(mapping.priceIds)].sort() : undefined;
    const matches = [...this.versions.values()].filter((definition) => {
      const productBindings = definition.providerBindings.filter(
        (binding) =>
          binding.provider === mapping.provider && binding.productId === mapping.productId,
      );
      if (productBindings.length === 0) {
        return false;
      }
      if (requestedPriceIds === undefined) {
        return true;
      }
      const publishedPriceIds = [
        ...new Set(
          productBindings.flatMap((binding) =>
            binding.priceId === undefined ? [] : [binding.priceId],
          ),
        ),
      ].sort();
      return (
        requestedPriceIds.length === publishedPriceIds.length &&
        requestedPriceIds.every((priceId, index) => priceId === publishedPriceIds[index])
      );
    });

    const [match] = matches;
    if (matches.length !== 1 || !match) {
      throw new UnknownPlanVersionMappingProblem(
        mapping.provider,
        mapping.productId,
        mapping.priceIds,
      );
    }

    return match;
  }

  private publish(definition: PlanVersionDefinition): void {
    this.validateDefinition(definition);
    if (this.versions.has(definition.ref)) {
      throw new PlanVersionAlreadyPublishedProblem(definition.ref);
    }
    if (
      [...this.versions.values()].some(
        (existing) =>
          existing.planId === definition.planId && existing.effectiveAt === definition.effectiveAt,
      )
    ) {
      throw new InvalidPlanVersionDefinitionProblem(
        `plan '${definition.planId}' already has a version effective at '${definition.effectiveAt}'`,
      );
    }
    if (
      [...this.versions.values()].some(
        (existing) =>
          existing.planId === definition.planId && existing.version === definition.version,
      )
    ) {
      throw new InvalidPlanVersionDefinitionProblem(
        `plan '${definition.planId}' already has version '${definition.version}'`,
      );
    }
    const mappingKeys = this.providerMappingKeys(definition);
    const conflictingMapping = [...this.versions.values()].find((existing) =>
      this.providerMappingKeys(existing).some((key) => mappingKeys.includes(key)),
    );
    if (conflictingMapping) {
      throw new InvalidPlanVersionDefinitionProblem(
        `provider mapping collides with published version '${conflictingMapping.ref}'`,
      );
    }

    const snapshot = structuredClone(definition);
    Object.freeze(snapshot.plan);
    for (const binding of snapshot.providerBindings) {
      Object.freeze(binding);
    }
    Object.freeze(snapshot.providerBindings);
    Object.freeze(snapshot.rating);
    Object.freeze(snapshot);
    this.versions.set(snapshot.ref, snapshot);
  }

  private validateDefinition(definition: PlanVersionDefinition): void {
    if (
      definition.ref.length === 0 ||
      definition.planId.length === 0 ||
      definition.version.length === 0
    ) {
      throw new InvalidPlanVersionDefinitionProblem("ref, planId, and version must be non-empty");
    }
    if (definition.plan.id !== definition.planId) {
      throw new InvalidPlanVersionDefinitionProblem(
        `plan.id '${definition.plan.id}' must match planId '${definition.planId}'`,
      );
    }
    this.requireIsoTimestamp(definition.effectiveAt, "effectiveAt");
    this.requireIsoTimestamp(definition.publishedAt, "publishedAt");
    if (definition.rating.mode === "provider-rated" && definition.providerBindings.length === 0) {
      throw new InvalidPlanVersionDefinitionProblem(
        "provider-rated versions require at least one provider binding",
      );
    }
    const bindingKeys = new Set<string>();
    for (const binding of definition.providerBindings) {
      if (
        binding.provider.length === 0 ||
        binding.productId.length === 0 ||
        binding.priceId === ""
      ) {
        throw new InvalidPlanVersionDefinitionProblem(
          "provider bindings require non-empty provider, productId, and optional priceId values",
        );
      }
      const bindingKey = `${binding.provider}\u0000${binding.productId}\u0000${binding.priceId ?? ""}`;
      if (bindingKeys.has(bindingKey)) {
        throw new InvalidPlanVersionDefinitionProblem(
          `provider binding '${binding.provider}/${binding.productId}/${binding.priceId ?? ""}' is duplicated`,
        );
      }
      bindingKeys.add(bindingKey);
    }
  }

  private requireIsoTimestamp(value: string, field: string): void {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
      throw new InvalidPlanVersionDefinitionProblem(`${field} must be a normalized ISO timestamp`);
    }
  }

  private providerMappingKeys(definition: PlanVersionDefinition): string[] {
    const pricesByProduct = new Map<string, string[]>();
    for (const binding of definition.providerBindings) {
      const productKey = `${binding.provider}\u0000${binding.productId}`;
      const priceIds = pricesByProduct.get(productKey) ?? [];
      if (binding.priceId !== undefined) {
        priceIds.push(binding.priceId);
      }
      pricesByProduct.set(productKey, priceIds);
    }
    return [...pricesByProduct.entries()].map(
      ([productKey, priceIds]) =>
        `${productKey}\u0000${[...new Set(priceIds)].sort().join("\u0000")}`,
    );
  }
}

export function planVersionRef(value: string): PlanVersionRef {
  return value as PlanVersionRef;
}

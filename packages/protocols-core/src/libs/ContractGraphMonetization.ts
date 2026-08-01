export const CONTRACT_METERED_METADATA_KEY = Symbol.for("croco:metering:metered");

type ContractMonetizationDiagnostic = {
  readonly code: string;
  readonly severity: "error";
  readonly target: "monetization";
  readonly message: string;
  readonly recoveryAction: string;
};

type ContractMonetizationRoute = {
  readonly routeId: string;
  readonly meter?: {
    readonly key: string;
    readonly descriptor?: ContractMeterDescriptor | undefined;
  };
};

export type ContractMeterDescriptor = {
  readonly key: string;
  readonly aggregation: "COUNT" | "SUM";
  readonly unit: string;
  readonly billing: "local" | "required";
  readonly dimensions?: Readonly<
    Record<
      string,
      {
        readonly kind: "enum";
        readonly values: readonly (string | number | boolean)[];
      }
    >
  >;
};

export type ContractProviderMeterBinding = {
  readonly meterKey: string;
  readonly meterId: string;
};

export type ContractProviderPlanBinding = {
  readonly provider: string;
  readonly productId: string;
  readonly priceIds: readonly string[];
  readonly meterBindings?: readonly ContractProviderMeterBinding[];
};

export type ContractPlanVersionDescriptor = {
  readonly ref: string;
  readonly planId: string;
  readonly versionId: string;
  readonly rating:
    | { readonly mode: "provider"; readonly provider: string }
    | { readonly mode: "croco" };
  readonly providerBindings: readonly ContractProviderPlanBinding[];
};

export type ContractEntitlementRuleDescriptor =
  | { readonly featureKey: string; readonly type: "boolean" }
  | { readonly featureKey: string; readonly type: "static"; readonly value: number }
  | {
      readonly featureKey: string;
      readonly type: "metered";
      readonly quota: number;
      readonly meterId?: string;
      readonly meterBilling?: "local" | "required";
      readonly overagePolicy?: "BLOCK" | "WARN" | "ALLOW_WITH_OVERAGE";
    };

export type ContractPlanEntitlementDescriptor = {
  readonly planId: string;
  readonly planVersionRef: string;
  readonly entitlements: readonly ContractEntitlementRuleDescriptor[];
};

export type ContractBillingProviderDescriptor = {
  readonly providerName: string;
  readonly capabilities: {
    readonly checkout: { readonly supported: boolean; readonly reason?: string };
    readonly usage: { readonly supported: boolean; readonly reason?: string };
  };
};

export type ContractSubscriptionMappingDescriptor = {
  readonly subscriptionId: string;
  readonly entitlementPlanVersionRef: string;
  readonly providerPlanVersionRef: string;
};

export type ContractMonetizationInput = {
  readonly meters?: readonly ContractMeterDescriptor[];
  readonly planVersions?: readonly ContractPlanVersionDescriptor[];
  readonly entitlementSets?: readonly ContractPlanEntitlementDescriptor[];
  readonly providers?: readonly ContractBillingProviderDescriptor[];
  readonly subscriptionMappings?: readonly ContractSubscriptionMappingDescriptor[];
};

export type ContractMonetizationDefinition = {
  readonly kind: "croco.contract-monetization.v1";
  readonly input: ContractMonetizationInput;
};

/** Defines executable monetization contract data that rpc-codegen discovers beside controllers. */
export function defineContractMonetization(
  input: ContractMonetizationInput,
): ContractMonetizationDefinition {
  return Object.freeze({ kind: "croco.contract-monetization.v1", input });
}

export function isContractMonetizationDefinition(
  value: unknown,
): value is ContractMonetizationDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "croco.contract-monetization.v1" &&
    "input" in value &&
    isContractMonetizationInput(value.input)
  );
}

function isContractMonetizationInput(value: unknown): value is ContractMonetizationInput {
  if (!isRecord(value)) return false;
  return (
    isOptionalArray(value["meters"], isMeterDescriptor) &&
    isOptionalArray(value["planVersions"], isPlanDescriptor) &&
    isOptionalArray(value["entitlementSets"], isEntitlementSetDescriptor) &&
    isOptionalArray(value["providers"], isProviderDescriptor) &&
    isOptionalArray(value["subscriptionMappings"], isSubscriptionMappingDescriptor)
  );
}

export type ContractMonetizationNode =
  | ({ readonly kind: "meter"; readonly id: string } & ContractMeterDescriptor)
  | ({ readonly kind: "plan-version"; readonly id: string } & ContractPlanVersionDescriptor)
  | ({ readonly kind: "entitlement-set"; readonly id: string } & ContractPlanEntitlementDescriptor)
  | ({ readonly kind: "provider"; readonly id: string } & ContractBillingProviderDescriptor)
  | ({
      readonly kind: "subscription-mapping";
      readonly id: string;
    } & ContractSubscriptionMappingDescriptor);

export type ContractMonetizationEdge = {
  readonly kind:
    | "operation-records-meter"
    | "plan-version-bills-meter"
    | "plan-version-grants-entitlement"
    | "plan-version-uses-provider"
    | "subscription-resolves-plan-version";
  readonly from: string;
  readonly to: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type ContractMonetizationGraph = {
  readonly verification: {
    readonly mode: "credential-free-structural";
    readonly remoteProviderConfigurationInspected: false;
  };
  readonly nodes: readonly ContractMonetizationNode[];
  readonly edges: readonly ContractMonetizationEdge[];
};

export type ContractProviderMappingDriftInput = {
  readonly planVersionRef: string;
  readonly productId: string;
  readonly priceIds: readonly string[];
  readonly meterBindings: readonly ContractProviderMeterBinding[];
};

export type ContractMeteredMetadata = {
  readonly meter?: ContractMeterDescriptor;
  readonly meterId?: string;
};

export function buildContractMonetizationGraph(
  routes: readonly ContractMonetizationRoute[],
  input: ContractMonetizationInput = {},
): {
  readonly graph: ContractMonetizationGraph;
  readonly diagnostics: readonly ContractMonetizationDiagnostic[];
} {
  const routeMeters = routes.flatMap((route) =>
    route.meter?.descriptor ? [route.meter.descriptor] : [],
  );
  const meters = uniqueBy(
    [...(input.meters ?? []), ...routeMeters].map(normalizeMeter),
    (meter) => meter.key,
  );
  const planVersions = uniqueBy(
    (input.planVersions ?? []).map(normalizePlanVersion),
    (plan) => plan.ref,
  );
  const entitlementSets = uniqueBy(
    (input.entitlementSets ?? []).map(normalizeEntitlementSet),
    (set) => set.planVersionRef,
  );
  const providers = uniqueBy(
    (input.providers ?? []).map(normalizeProvider),
    (provider) => provider.providerName,
  );
  const subscriptionMappings = uniqueBy(
    (input.subscriptionMappings ?? []).map(normalizeSubscriptionMapping),
    (mapping) => mapping.subscriptionId,
  );
  const nodes: ContractMonetizationNode[] = [
    ...meters.map((meter) => ({ kind: "meter" as const, id: meterNodeId(meter.key), ...meter })),
    ...planVersions.map((plan) => ({
      kind: "plan-version" as const,
      id: planNodeId(plan.ref),
      ...plan,
    })),
    ...entitlementSets.map((set) => ({
      kind: "entitlement-set" as const,
      id: entitlementNodeId(set.planVersionRef),
      ...set,
    })),
    ...providers.map((provider) => ({
      kind: "provider" as const,
      id: providerNodeId(provider.providerName),
      ...provider,
    })),
    ...subscriptionMappings.map((mapping) => ({
      kind: "subscription-mapping" as const,
      id: subscriptionNodeId(mapping.subscriptionId),
      ...mapping,
    })),
  ];
  const edges: ContractMonetizationEdge[] = [];

  for (const route of routes) {
    if (route.meter?.descriptor) {
      edges.push({
        kind: "operation-records-meter",
        from: `operation:${route.routeId}`,
        to: meterNodeId(route.meter.key),
      });
    }
  }
  for (const plan of planVersions) {
    for (const binding of plan.providerBindings) {
      edges.push({
        kind: "plan-version-uses-provider",
        from: planNodeId(plan.ref),
        to: providerNodeId(binding.provider),
      });
      for (const meterBinding of binding.meterBindings ?? []) {
        edges.push({
          kind: "plan-version-bills-meter",
          from: planNodeId(plan.ref),
          to: meterNodeId(meterBinding.meterKey),
          metadata: { provider: binding.provider, providerMeterId: meterBinding.meterId },
        });
      }
    }
  }
  for (const set of entitlementSets) {
    for (const rule of set.entitlements) {
      edges.push({
        kind: "plan-version-grants-entitlement",
        from: planNodeId(set.planVersionRef),
        to: `entitlement:${rule.featureKey}`,
      });
    }
  }
  for (const mapping of subscriptionMappings) {
    edges.push({
      kind: "subscription-resolves-plan-version",
      from: subscriptionNodeId(mapping.subscriptionId),
      to: planNodeId(mapping.providerPlanVersionRef),
    });
  }

  const graph: ContractMonetizationGraph = {
    verification: {
      mode: "credential-free-structural",
      remoteProviderConfigurationInspected: false,
    },
    nodes: nodes.sort(compareById),
    edges: edges.sort(compareEdges),
  };

  return {
    graph,
    diagnostics: validateMonetization(
      { ...input, meters: [...(input.meters ?? []), ...routeMeters] },
      meters,
      planVersions,
      entitlementSets,
      providers,
    ),
  };
}

function normalizeMeter(meter: ContractMeterDescriptor): ContractMeterDescriptor {
  return {
    key: meter.key,
    aggregation: meter.aggregation,
    unit: meter.unit,
    billing: meter.billing,
    dimensions: Object.fromEntries(
      Object.entries(meter.dimensions ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, descriptor]) => [
          key,
          {
            kind: "enum" as const,
            values: [...descriptor.values].sort(compareDimensionValues),
          },
        ]),
    ),
  };
}

function normalizePlanVersion(plan: ContractPlanVersionDescriptor): ContractPlanVersionDescriptor {
  return {
    ref: plan.ref,
    planId: plan.planId,
    versionId: plan.versionId,
    rating:
      plan.rating.mode === "provider"
        ? { mode: "provider", provider: plan.rating.provider }
        : { mode: "croco" },
    providerBindings: plan.providerBindings
      .map((binding) => ({
        provider: binding.provider,
        productId: binding.productId,
        priceIds: [...binding.priceIds].sort(),
        ...(binding.meterBindings
          ? {
              meterBindings: binding.meterBindings
                .map(({ meterKey, meterId }) => ({ meterKey, meterId }))
                .sort((left, right) =>
                  canonicalStringify(left).localeCompare(canonicalStringify(right)),
                ),
            }
          : {}),
      }))
      .sort(compareProviderBindings),
  };
}

function normalizeEntitlementSet(
  set: ContractPlanEntitlementDescriptor,
): ContractPlanEntitlementDescriptor {
  return {
    planId: set.planId,
    planVersionRef: set.planVersionRef,
    entitlements: set.entitlements
      .map((rule): ContractEntitlementRuleDescriptor => {
        if (rule.type === "boolean") return { featureKey: rule.featureKey, type: "boolean" };
        if (rule.type === "static") {
          return { featureKey: rule.featureKey, type: "static", value: rule.value };
        }
        return {
          featureKey: rule.featureKey,
          type: "metered",
          quota: rule.quota,
          ...(rule.meterId ? { meterId: rule.meterId } : {}),
          ...(rule.meterBilling ? { meterBilling: rule.meterBilling } : {}),
          ...(rule.overagePolicy ? { overagePolicy: rule.overagePolicy } : {}),
        };
      })
      .sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right))),
  };
}

function normalizeProvider(
  provider: ContractBillingProviderDescriptor,
): ContractBillingProviderDescriptor {
  return {
    providerName: provider.providerName,
    capabilities: {
      checkout: { ...provider.capabilities.checkout },
      usage: { ...provider.capabilities.usage },
    },
  };
}

function normalizeSubscriptionMapping(
  mapping: ContractSubscriptionMappingDescriptor,
): ContractSubscriptionMappingDescriptor {
  return {
    subscriptionId: mapping.subscriptionId,
    entitlementPlanVersionRef: mapping.entitlementPlanVersionRef,
    providerPlanVersionRef: mapping.providerPlanVersionRef,
  };
}

/**
 * Produces credential-free mapping input that an opt-in provider preflight can compare remotely.
 * Calling this function never performs network I/O or claims that provider state was inspected.
 */
export function getContractProviderMappingDriftInput(
  graph: ContractMonetizationGraph,
  providerName: string,
): readonly ContractProviderMappingDriftInput[] {
  return graph.nodes
    .filter(
      (node): node is Extract<ContractMonetizationNode, { kind: "plan-version" }> =>
        node.kind === "plan-version",
    )
    .flatMap((plan) =>
      plan.providerBindings
        .filter((binding) => binding.provider === providerName)
        .map((binding) => ({
          planVersionRef: plan.ref,
          productId: binding.productId,
          priceIds: [...binding.priceIds].sort(),
          meterBindings: [...(binding.meterBindings ?? [])].sort((left, right) =>
            left.meterKey.localeCompare(right.meterKey),
          ),
        })),
    )
    .sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));
}

function validateMonetization(
  input: ContractMonetizationInput,
  meters: readonly ContractMeterDescriptor[],
  plans: readonly ContractPlanVersionDescriptor[],
  entitlementSets: readonly ContractPlanEntitlementDescriptor[],
  providers: readonly ContractBillingProviderDescriptor[],
): readonly ContractMonetizationDiagnostic[] {
  const diagnostics: ContractMonetizationDiagnostic[] = [...validateDescriptorConflicts(input)];
  const billedMeterKeys = new Set(
    plans.flatMap((plan) =>
      plan.providerBindings
        .flatMap((binding) => binding.meterBindings ?? [])
        .map((binding) => binding.meterKey),
    ),
  );
  const planByRef = new Map(plans.map((plan) => [plan.ref, plan]));
  const meterByKey = new Map(meters.map((meter) => [meter.key, meter]));
  const providerByName = new Map(providers.map((provider) => [provider.providerName, provider]));

  for (const meter of meters) {
    if (meter.billing === "required" && !billedMeterKeys.has(meter.key)) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_METER_UNBOUND",
          `Billing-required meter '${meter.key}' is not referenced by any published plan version.`,
          `Bind meter '${meter.key}' to a provider meter in a published plan version.`,
        ),
      );
    }
  }

  for (const plan of plans) {
    const bindingsWithMeters = plan.providerBindings.filter(
      (binding) => (binding.meterBindings?.length ?? 0) > 0,
    );
    const hasBillableEntitlements = entitlementSets.some(
      (set) =>
        set.planVersionRef === plan.ref &&
        set.entitlements.some(
          (rule) =>
            rule.type === "metered" &&
            (rule.meterBilling === "required" || rule.overagePolicy === "ALLOW_WITH_OVERAGE"),
        ),
    );
    if (plan.providerBindings.length === 0) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
          `Published plan version '${plan.ref}' has no provider product mapping.`,
          `Add a provider product binding for plan version '${plan.ref}'.`,
        ),
      );
    } else if (hasBillableEntitlements && bindingsWithMeters.length === 0) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
          `Usage-priced plan version '${plan.ref}' has no provider meter mapping.`,
          `Add a provider meter binding for plan version '${plan.ref}'.`,
        ),
      );
    }
    if (plan.rating.mode === "croco" && bindingsWithMeters.length > 0) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_RATING_MODE_CONFLICT",
          `Plan version '${plan.ref}' uses Croco rating and provider meter bindings at the same time.`,
          "Choose exactly one rating owner for the plan version.",
        ),
      );
    }
    if (plan.rating.mode === "provider") {
      const ratingProvider = plan.rating.provider;
      if (!plan.providerBindings.some((binding) => binding.provider === ratingProvider)) {
        diagnostics.push(
          createDiagnostic(
            "CROCO_BILLING_RATING_MODE_CONFLICT",
            `Plan version '${plan.ref}' is rated by '${ratingProvider}' without a matching provider binding.`,
            "Bind the rating provider to the plan version or select the provider that owns its pricing.",
          ),
        );
      }
    }
    for (const binding of plan.providerBindings) {
      const profile = providerByName.get(binding.provider);
      if (!profile) {
        diagnostics.push(
          createDiagnostic(
            "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING",
            `Plan version '${plan.ref}' uses provider '${binding.provider}' without a capability profile.`,
            `Register provider profile '${binding.provider}' before verifying the plan version.`,
          ),
        );
      } else if (!profile.capabilities.checkout.supported) {
        diagnostics.push(
          createDiagnostic(
            "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING",
            `Plan version '${plan.ref}' requires provider '${binding.provider}' to support checkout.`,
            `Select a provider profile with checkout support or remove its product binding from plan version '${plan.ref}'.`,
          ),
        );
      }
      for (const meterBinding of binding.meterBindings ?? []) {
        if (!meterByKey.has(meterBinding.meterKey)) {
          diagnostics.push(
            createDiagnostic(
              "CROCO_BILLING_METER_UNBOUND",
              `Plan version '${plan.ref}' binds unknown meter '${meterBinding.meterKey}'.`,
              `Declare typed meter '${meterBinding.meterKey}' before binding it to provider '${binding.provider}'.`,
            ),
          );
        }
      }
    }
    for (const binding of bindingsWithMeters) {
      if (plan.rating.mode === "provider" && plan.rating.provider !== binding.provider) {
        diagnostics.push(
          createDiagnostic(
            "CROCO_BILLING_RATING_MODE_CONFLICT",
            `Plan version '${plan.ref}' is rated by '${plan.rating.provider}' but bills meter usage through '${binding.provider}'.`,
            "Use the rating provider for every provider meter binding on the plan version.",
          ),
        );
      }
      const profile = providerByName.get(binding.provider);
      if (profile && !profile.capabilities.usage.supported) {
        diagnostics.push(
          createDiagnostic(
            "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING",
            `Usage-priced plan version '${plan.ref}' requires provider '${binding.provider}' to support usage ingestion.`,
            `Select a provider profile with usage support or remove usage pricing from plan version '${plan.ref}'.`,
          ),
        );
      }
    }
  }

  for (const set of entitlementSets) {
    const plan = planByRef.get(set.planVersionRef);
    if (!plan) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
          `Entitlement set for '${set.planId}' references unknown plan version '${set.planVersionRef}'.`,
          `Publish plan version '${set.planVersionRef}' before binding its entitlement set.`,
        ),
      );
      continue;
    }
    if (plan.planId !== set.planId) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH",
          `Entitlement set plan '${set.planId}' does not match plan '${plan.planId}' resolved by version '${set.planVersionRef}'.`,
          "Bind entitlements and provider pricing to the same immutable plan version.",
        ),
      );
    }
    for (const rule of set.entitlements) {
      if (rule.type !== "metered" || rule.overagePolicy !== "ALLOW_WITH_OVERAGE") continue;
      const bound =
        rule.meterId !== undefined &&
        plan.providerBindings.some((binding) =>
          (binding.meterBindings ?? []).some(
            (meterBinding) => meterBinding.meterKey === rule.meterId,
          ),
        );
      const meter = rule.meterId ? meterByKey.get(rule.meterId) : undefined;
      if (rule.meterBilling !== "required" || meter?.billing !== "required" || !bound) {
        diagnostics.push(
          createDiagnostic(
            "CROCO_BILLING_METER_UNBOUND",
            `Entitlement '${rule.featureKey}' allows overage without a billing-required provider-bound meter on plan version '${set.planVersionRef}'.`,
            "Use a billing-required meter and bind it to the same plan version's usage-capable provider.",
          ),
        );
      }
    }
  }

  for (const mapping of input.subscriptionMappings ?? []) {
    const entitlementPlan = planByRef.get(mapping.entitlementPlanVersionRef);
    const providerPlan = planByRef.get(mapping.providerPlanVersionRef);

    if (!entitlementPlan || !providerPlan) {
      const unknownRefs = [
        ...(!entitlementPlan ? [mapping.entitlementPlanVersionRef] : []),
        ...(!providerPlan ? [mapping.providerPlanVersionRef] : []),
      ];
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
          `Subscription '${mapping.subscriptionId}' references unknown plan version(s): ${[...new Set(unknownRefs)].join(", ")}.`,
          "Publish every referenced plan version before resolving subscription mappings.",
        ),
      );
    }
    if (mapping.entitlementPlanVersionRef !== mapping.providerPlanVersionRef) {
      diagnostics.push(
        createDiagnostic(
          "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH",
          `Subscription '${mapping.subscriptionId}' resolves entitlements from '${mapping.entitlementPlanVersionRef}' but provider pricing from '${mapping.providerPlanVersionRef}'.`,
          "Resolve entitlement and provider mappings from the same immutable plan version.",
        ),
      );
    }
  }

  return diagnostics.sort((left, right) =>
    `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`),
  );
}

function compareProviderBindings(
  left: ContractProviderPlanBinding,
  right: ContractProviderPlanBinding,
): number {
  return canonicalStringify(left).localeCompare(canonicalStringify(right));
}

function validateDescriptorConflicts(
  input: ContractMonetizationInput,
): readonly ContractMonetizationDiagnostic[] {
  return [
    ...findConflicts((input.meters ?? []).map(normalizeMeter), (meter) => meter.key, "meter"),
    ...findConflicts(
      (input.planVersions ?? []).map(normalizePlanVersion),
      (plan) => plan.ref,
      "plan version",
    ),
    ...findConflicts(
      (input.entitlementSets ?? []).map(normalizeEntitlementSet),
      (set) => set.planVersionRef,
      "entitlement set",
    ),
    ...findConflicts(
      (input.providers ?? []).map(normalizeProvider),
      (provider) => provider.providerName,
      "provider",
    ),
    ...findConflicts(
      (input.subscriptionMappings ?? []).map(normalizeSubscriptionMapping),
      (mapping) => mapping.subscriptionId,
      "subscription mapping",
    ),
    ...(input.planVersions ?? []).flatMap((plan) =>
      plan.providerBindings.flatMap((binding) =>
        findConflicts(
          binding.meterBindings ?? [],
          (meterBinding) => meterBinding.meterKey,
          `provider meter binding on plan version '${plan.ref}'`,
        ),
      ),
    ),
    ...(input.entitlementSets ?? []).flatMap((set) =>
      findConflicts(
        set.entitlements,
        (rule) => rule.featureKey,
        `entitlement rule on plan version '${set.planVersionRef}'`,
      ),
    ),
  ];
}

function findConflicts<T>(
  values: readonly T[],
  key: (value: T) => string,
  descriptorName: string,
): readonly ContractMonetizationDiagnostic[] {
  const fingerprintsByKey = new Map<string, Set<string>>();
  for (const value of values) {
    const descriptorKey = key(value);
    const fingerprints = fingerprintsByKey.get(descriptorKey) ?? new Set<string>();
    fingerprints.add(canonicalStringify(value));
    fingerprintsByKey.set(descriptorKey, fingerprints);
  }

  return [...fingerprintsByKey]
    .filter(([, fingerprints]) => fingerprints.size > 1)
    .map(([descriptorKey]) =>
      createDiagnostic(
        "CROCO_BILLING_DESCRIPTOR_CONFLICT",
        `Conflicting ${descriptorName} descriptors use identity '${descriptorKey}'.`,
        `Keep exactly one canonical ${descriptorName} descriptor for '${descriptorKey}'.`,
      ),
    );
}

function createDiagnostic(
  code: string,
  message: string,
  recoveryAction: string,
): ContractMonetizationDiagnostic {
  return { code, severity: "error", target: "monetization", message, recoveryAction };
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  const sorted = [...values].sort(
    (left, right) =>
      key(left).localeCompare(key(right)) ||
      canonicalStringify(left).localeCompare(canonicalStringify(right)),
  );
  const unique: T[] = [];
  let previousKey: string | undefined;
  for (const value of sorted) {
    const currentKey = key(value);
    if (currentKey === previousKey) {
      continue;
    }
    unique.push(value);
    previousKey = currentKey;
  }
  return unique;
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).sort().join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareDimensionValues(
  left: string | number | boolean,
  right: string | number | boolean,
): number {
  return canonicalStringify(left).localeCompare(canonicalStringify(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalArray<T>(
  value: unknown,
  predicate: (entry: unknown) => entry is T,
): value is readonly T[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(predicate));
}

function isMeterDescriptor(value: unknown): value is ContractMeterDescriptor {
  return (
    isRecord(value) &&
    typeof value["key"] === "string" &&
    (value["aggregation"] === "COUNT" || value["aggregation"] === "SUM") &&
    typeof value["unit"] === "string" &&
    (value["billing"] === "local" || value["billing"] === "required") &&
    (value["dimensions"] === undefined || isMeterDimensions(value["dimensions"]))
  );
}

function isMeterDimensions(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        isRecord(entry) &&
        entry["kind"] === "enum" &&
        Array.isArray(entry["values"]) &&
        entry["values"].every(
          (item) =>
            typeof item === "string" ||
            typeof item === "boolean" ||
            (typeof item === "number" && Number.isFinite(item)),
        ),
    )
  );
}

function isPlanDescriptor(value: unknown): value is ContractPlanVersionDescriptor {
  return (
    isRecord(value) &&
    typeof value["ref"] === "string" &&
    typeof value["planId"] === "string" &&
    typeof value["versionId"] === "string" &&
    isRecord(value["rating"]) &&
    (value["rating"]["mode"] === "croco" ||
      (value["rating"]["mode"] === "provider" &&
        typeof value["rating"]["provider"] === "string")) &&
    Array.isArray(value["providerBindings"]) &&
    value["providerBindings"].every(isProviderPlanBinding)
  );
}

function isProviderPlanBinding(value: unknown): value is ContractProviderPlanBinding {
  return (
    isRecord(value) &&
    typeof value["provider"] === "string" &&
    typeof value["productId"] === "string" &&
    Array.isArray(value["priceIds"]) &&
    value["priceIds"].every((id) => typeof id === "string") &&
    isOptionalArray(
      value["meterBindings"],
      (entry): entry is ContractProviderMeterBinding =>
        isRecord(entry) &&
        typeof entry["meterKey"] === "string" &&
        typeof entry["meterId"] === "string",
    )
  );
}

function isEntitlementSetDescriptor(value: unknown): value is ContractPlanEntitlementDescriptor {
  return (
    isRecord(value) &&
    typeof value["planId"] === "string" &&
    typeof value["planVersionRef"] === "string" &&
    Array.isArray(value["entitlements"]) &&
    value["entitlements"].every(isEntitlementRuleDescriptor)
  );
}

function isEntitlementRuleDescriptor(value: unknown): value is ContractEntitlementRuleDescriptor {
  if (!isRecord(value) || typeof value["featureKey"] !== "string") return false;
  if (value["type"] === "boolean") return true;
  if (value["type"] === "static") return isFiniteNonNegative(value["value"]);
  return (
    value["type"] === "metered" &&
    isFiniteNonNegative(value["quota"]) &&
    (value["meterId"] === undefined || typeof value["meterId"] === "string") &&
    (value["meterBilling"] === undefined ||
      value["meterBilling"] === "local" ||
      value["meterBilling"] === "required") &&
    (value["overagePolicy"] === undefined ||
      value["overagePolicy"] === "BLOCK" ||
      value["overagePolicy"] === "WARN" ||
      value["overagePolicy"] === "ALLOW_WITH_OVERAGE")
  );
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isProviderDescriptor(value: unknown): value is ContractBillingProviderDescriptor {
  return (
    isRecord(value) &&
    typeof value["providerName"] === "string" &&
    isRecord(value["capabilities"]) &&
    [value["capabilities"]["checkout"], value["capabilities"]["usage"]].every(
      (capability) =>
        isRecord(capability) &&
        typeof capability["supported"] === "boolean" &&
        (capability["reason"] === undefined || typeof capability["reason"] === "string"),
    )
  );
}

function isSubscriptionMappingDescriptor(
  value: unknown,
): value is ContractSubscriptionMappingDescriptor {
  return (
    isRecord(value) &&
    typeof value["subscriptionId"] === "string" &&
    typeof value["entitlementPlanVersionRef"] === "string" &&
    typeof value["providerPlanVersionRef"] === "string"
  );
}

function meterNodeId(key: string): string {
  return `meter:${key}`;
}
function planNodeId(ref: string): string {
  return `plan-version:${ref}`;
}
function providerNodeId(provider: string): string {
  return `provider:${provider}`;
}
function entitlementNodeId(ref: string): string {
  return `entitlement-set:${ref}`;
}
function subscriptionNodeId(id: string): string {
  return `subscription-mapping:${id}`;
}
function compareById(left: ContractMonetizationNode, right: ContractMonetizationNode): number {
  return left.id.localeCompare(right.id);
}
function compareEdges(left: ContractMonetizationEdge, right: ContractMonetizationEdge): number {
  return `${left.kind}:${left.from}:${left.to}:${JSON.stringify(left.metadata ?? {})}`.localeCompare(
    `${right.kind}:${right.from}:${right.to}:${JSON.stringify(right.metadata ?? {})}`,
  );
}

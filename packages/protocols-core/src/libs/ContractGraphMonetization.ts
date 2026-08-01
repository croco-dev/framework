import type {
  ContractDiagnostic,
  ContractDiagnosticEvidence,
  ContractDiagnosticRecovery,
  ContractDiagnosticSourceLocation,
} from "./ContractDiagnostic";

type MonetizationContractRoute = {
  readonly operationId: string;
  readonly meters?: readonly {
    readonly key: string;
    readonly aggregation?: "COUNT" | "SUM";
    readonly unit?: string;
    readonly billing: "local" | "required";
  }[];
  readonly routeContract: {
    readonly sourceLocation?: ContractDiagnosticSourceLocation;
  } | null;
};

export const CONTRACT_MONETIZATION_INPUT_VERSION = "croco.contract-monetization.input.v1";
export const CONTRACT_MONETIZATION_GRAPH_VERSION = "croco.contract-monetization.v1";

export type ContractMeterReference = string | { readonly key: string };

export type ContractMeterDeclaration = {
  readonly key: string;
  readonly aggregation: "COUNT" | "SUM";
  readonly unit: string;
  readonly billing: "local" | "required";
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
};

export type ContractPlanVersionValue = {
  readonly ref: string;
  readonly planId: string;
  readonly rating:
    | { readonly mode: "croco" }
    | { readonly mode: "provider"; readonly provider: string };
  readonly providerBindings: readonly {
    readonly provider: string;
    readonly productId: string;
    readonly priceIds: readonly string[];
  }[];
};

export type ContractPlanVersionDeclaration = {
  readonly plan: ContractPlanVersionValue;
  readonly billedMeters?: readonly ContractMeterReference[];
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
};

export type ContractPlanEntitlementDeclaration = {
  readonly planId: string;
  readonly planVersionRef: string;
  readonly entitlements: readonly {
    readonly featureKey: string;
    readonly type: "boolean" | "metered" | "static";
    readonly meterId?: string;
    readonly meterBilling?: "local" | "required";
    readonly quota?: number;
    readonly overagePolicy?: "BLOCK" | "WARN" | "ALLOW_WITH_OVERAGE";
  }[];
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
};

export type ContractBillingProviderDeclaration = {
  readonly providerName: string;
  readonly capabilities: {
    readonly checkout: { readonly supported: boolean; readonly reason?: string };
    readonly usage: { readonly supported: boolean; readonly reason?: string };
  };
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
};

export type ContractProviderPlanMappingDeclaration = {
  readonly provider: string;
  readonly planVersionRef: string;
  readonly productId: string;
  readonly priceIds: readonly string[];
  readonly meterBindings?: readonly {
    readonly meter: ContractMeterReference;
    readonly externalMeterId: string;
  }[];
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
};

export type ContractMonetizationInput = {
  readonly version: typeof CONTRACT_MONETIZATION_INPUT_VERSION;
  readonly meters?: readonly ContractMeterDeclaration[];
  readonly planVersions?: readonly ContractPlanVersionDeclaration[];
  readonly entitlementSets?: readonly ContractPlanEntitlementDeclaration[];
  readonly providers?: readonly ContractBillingProviderDeclaration[];
  readonly providerMappings?: readonly ContractProviderPlanMappingDeclaration[];
};

export type ContractMonetizationNode =
  | ({ readonly type: "meter"; readonly id: string } & ContractMeterDeclaration)
  | {
      readonly type: "plan-version";
      readonly id: string;
      readonly ref: string;
      readonly planId: string;
      readonly rating: ContractPlanVersionValue["rating"];
      readonly sourceLocation?: ContractDiagnosticSourceLocation;
    }
  | {
      readonly type: "entitlement-set";
      readonly id: string;
      readonly planId: string;
      readonly planVersionRef: string;
      readonly entitlements: ContractPlanEntitlementDeclaration["entitlements"];
      readonly sourceLocation?: ContractDiagnosticSourceLocation;
    }
  | {
      readonly type: "billing-provider";
      readonly id: string;
      readonly providerName: string;
      readonly capabilities: ContractBillingProviderDeclaration["capabilities"];
      readonly sourceLocation?: ContractDiagnosticSourceLocation;
    }
  | {
      readonly type: "provider-plan-mapping";
      readonly id: string;
      readonly provider: string;
      readonly planVersionRef: string;
      readonly productId: string;
      readonly priceIds: readonly string[];
      readonly meterBindings: readonly {
        readonly meterKey: string;
        readonly externalMeterId: string;
      }[];
      readonly sourceLocation?: ContractDiagnosticSourceLocation;
    };

export type ContractMonetizationEdge = {
  readonly type:
    | "operation-records-meter"
    | "plan-version-bills-meter"
    | "plan-version-grants-entitlement"
    | "plan-version-binds-provider"
    | "provider-maps-plan-version"
    | "provider-maps-meter";
  readonly from: string;
  readonly to: string;
};

export type ContractMonetizationGraph = {
  readonly version: typeof CONTRACT_MONETIZATION_GRAPH_VERSION;
  readonly validationSource: "credential-free-structural";
  readonly nodes: readonly ContractMonetizationNode[];
  readonly edges: readonly ContractMonetizationEdge[];
};

export type ContractProviderPreflightFinding = {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly contractId?: string;
  readonly evidence?: ContractDiagnosticEvidence;
  readonly recovery?: ContractDiagnosticRecovery;
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
};

export type ContractProviderPreflightSignal = {
  readonly aborted: boolean;
  readonly reason?: unknown;
  readonly throwIfAborted?: () => void;
};

export type ContractMonetizationProviderPreflight = {
  readonly provider: string;
  readonly inspect: (input: {
    readonly graph: ContractMonetizationGraph;
    readonly signal?: ContractProviderPreflightSignal;
  }) => Promise<readonly ContractProviderPreflightFinding[]>;
};

export type ContractProviderPreflightReport = {
  readonly provider: string;
  readonly validationSource: "remote-provider-preflight";
  readonly diagnostics: readonly ContractDiagnostic[];
};

export function defineContractMonetization<
  const Input extends Omit<ContractMonetizationInput, "version">,
>(input: Input): Input & { readonly version: typeof CONTRACT_MONETIZATION_INPUT_VERSION } {
  return Object.freeze({
    ...input,
    version: CONTRACT_MONETIZATION_INPUT_VERSION,
  });
}

export function isContractMonetizationInput(value: unknown): value is ContractMonetizationInput {
  return (
    isRecord(value) &&
    value["version"] === CONTRACT_MONETIZATION_INPUT_VERSION &&
    isOptionalArray(value["meters"], isMeterDeclaration) &&
    isOptionalArray(value["planVersions"], isPlanVersionDeclaration) &&
    isOptionalArray(value["entitlementSets"], isEntitlementSetDeclaration) &&
    isOptionalArray(value["providers"], isProviderDeclaration) &&
    isOptionalArray(value["providerMappings"], isProviderMappingDeclaration)
  );
}

export function isContractMonetizationGraph(value: unknown): value is ContractMonetizationGraph {
  return (
    isRecord(value) &&
    value["version"] === CONTRACT_MONETIZATION_GRAPH_VERSION &&
    value["validationSource"] === "credential-free-structural" &&
    Array.isArray(value["nodes"]) &&
    value["nodes"].every(isContractMonetizationNode) &&
    new Set(value["nodes"].map((node) => node.id)).size === value["nodes"].length &&
    Array.isArray(value["edges"]) &&
    value["edges"].every(isContractMonetizationEdge)
  );
}

export function mergeContractMonetizationInputs(
  inputs: readonly ContractMonetizationInput[],
): ContractMonetizationInput | undefined {
  if (inputs.length === 0) {
    return undefined;
  }

  return {
    version: CONTRACT_MONETIZATION_INPUT_VERSION,
    meters: inputs.flatMap((input) => input.meters ?? []),
    planVersions: inputs.flatMap((input) => input.planVersions ?? []),
    entitlementSets: inputs.flatMap((input) => input.entitlementSets ?? []),
    providers: inputs.flatMap((input) => input.providers ?? []),
    providerMappings: inputs.flatMap((input) => input.providerMappings ?? []),
  };
}

export function buildContractMonetizationGraph(
  routes: readonly MonetizationContractRoute[],
  input: ContractMonetizationInput | undefined,
): {
  readonly graph: ContractMonetizationGraph;
  readonly diagnostics: readonly ContractDiagnostic[];
} {
  const meterDeclarations = collectMeterDeclarations(routes, input?.meters ?? []);
  const meters = normalizeMeters(meterDeclarations);
  const plans = normalizePlans(input?.planVersions ?? []);
  const entitlementSets = normalizeEntitlementSets(input?.entitlementSets ?? []);
  const providers = normalizeProviders(input?.providers ?? []);
  const mappings = normalizeMappings(input?.providerMappings ?? []);
  const nodes = createNodes(meters, plans, entitlementSets, providers, mappings);
  const edges = createEdges(routes, plans, entitlementSets, mappings);
  const diagnostics = [
    ...validateDeclarationConflicts(meterDeclarations, (meter) => meterId(meter.key), "meter"),
    ...validateDeclarationConflicts(
      input?.planVersions ?? [],
      (plan) => planId(plan.plan.ref),
      "plan-version",
    ),
    ...validateDeclarationConflicts(
      input?.entitlementSets ?? [],
      (set) => entitlementSetId(set.planVersionRef),
      "entitlement",
    ),
    ...validateDeclarationConflicts(
      input?.providers ?? [],
      (provider) => providerId(provider.providerName),
      "provider",
    ),
    ...validateDeclarationConflicts(input?.providerMappings ?? [], mappingId, "provider"),
    ...validateMonetization(meters, plans, entitlementSets, providers, mappings),
  ].sort(compareDiagnostics);

  return {
    graph: {
      version: CONTRACT_MONETIZATION_GRAPH_VERSION,
      validationSource: "credential-free-structural",
      nodes,
      edges,
    },
    diagnostics,
  };
}

export async function runContractMonetizationProviderPreflight(
  graph: ContractMonetizationGraph,
  preflight: ContractMonetizationProviderPreflight,
  signal?: ContractProviderPreflightSignal,
): Promise<ContractProviderPreflightReport> {
  const findings = await preflight.inspect({ graph, ...(signal ? { signal } : {}) });

  return {
    provider: preflight.provider,
    validationSource: "remote-provider-preflight",
    diagnostics: findings
      .map(
        (finding): ContractDiagnostic => ({
          code: finding.code,
          severity: finding.severity,
          target: "provider",
          message: finding.message,
          source: "remote-provider-preflight",
          ...(finding.contractId ? { contractId: finding.contractId } : {}),
          ...(finding.evidence ? { evidence: finding.evidence } : {}),
          ...(finding.recovery ? { recovery: finding.recovery } : {}),
          ...(finding.sourceLocation
            ? { sourceLocation: normalizeSourceLocation(finding.sourceLocation) }
            : {}),
        }),
      )
      .sort(compareDiagnostics),
  };
}

function collectMeterDeclarations(
  routes: readonly MonetizationContractRoute[],
  declared: readonly ContractMeterDeclaration[],
): readonly ContractMeterDeclaration[] {
  const declaredKeys = new Set(declared.map((meter) => meter.key));
  return [
    ...declared.map(
      (meter): ContractMeterDeclaration => ({
        key: meter.key,
        aggregation: meter.aggregation,
        unit: meter.unit,
        billing: meter.billing,
        ...(meter.sourceLocation
          ? { sourceLocation: normalizeSourceLocation(meter.sourceLocation) }
          : {}),
      }),
    ),
    ...routes.flatMap((route) =>
      (route.meters ?? [])
        .filter(
          (meter) =>
            !declaredKeys.has(meter.key) ||
            meter.aggregation !== undefined ||
            meter.unit !== undefined,
        )
        .map(
          (meter): ContractMeterDeclaration => ({
            key: meter.key,
            aggregation: meter.aggregation ?? "COUNT",
            unit: meter.unit ?? "unknown",
            billing: meter.billing,
            ...(route.routeContract?.sourceLocation
              ? { sourceLocation: normalizeSourceLocation(route.routeContract.sourceLocation) }
              : {}),
          }),
        ),
    ),
  ].sort(compareCanonical);
}

function normalizeMeters(
  declarations: readonly ContractMeterDeclaration[],
): readonly ContractMeterDeclaration[] {
  return declarations.filter(uniqueBy((meter) => meter.key));
}

function normalizePlans(
  plans: readonly ContractPlanVersionDeclaration[],
): readonly ContractPlanVersionDeclaration[] {
  return plans
    .map((declaration) => ({
      ...declaration,
      plan: {
        ...declaration.plan,
        providerBindings: declaration.plan.providerBindings
          .map((binding) => ({ ...binding, priceIds: [...binding.priceIds].sort(compareStrings) }))
          .sort(compareCanonical),
      },
      billedMeters: [...(declaration.billedMeters ?? [])].sort((left, right) =>
        compareStrings(meterKey(left), meterKey(right)),
      ),
      ...(declaration.sourceLocation
        ? { sourceLocation: normalizeSourceLocation(declaration.sourceLocation) }
        : {}),
    }))
    .sort(compareCanonical)
    .filter(uniqueBy((declaration) => String(declaration.plan.ref)));
}

function normalizeEntitlementSets(
  entitlementSets: readonly ContractPlanEntitlementDeclaration[],
): readonly ContractPlanEntitlementDeclaration[] {
  return entitlementSets
    .map((set) => ({
      ...set,
      entitlements: [...set.entitlements].sort(compareCanonical),
      ...(set.sourceLocation
        ? { sourceLocation: normalizeSourceLocation(set.sourceLocation) }
        : {}),
    }))
    .sort(compareCanonical)
    .filter(uniqueBy((set) => String(set.planVersionRef)));
}

function normalizeProviders(
  providers: readonly ContractBillingProviderDeclaration[],
): readonly ContractBillingProviderDeclaration[] {
  return providers
    .map((provider) => ({
      ...provider,
      ...(provider.sourceLocation
        ? { sourceLocation: normalizeSourceLocation(provider.sourceLocation) }
        : {}),
    }))
    .sort(compareCanonical)
    .filter(uniqueBy((provider) => provider.providerName));
}

function normalizeMappings(
  mappings: readonly ContractProviderPlanMappingDeclaration[],
): readonly ContractProviderPlanMappingDeclaration[] {
  return mappings
    .map((mapping) => ({
      ...mapping,
      priceIds: [...mapping.priceIds].sort(compareStrings),
      meterBindings: [...(mapping.meterBindings ?? [])].sort((left, right) =>
        compareStrings(meterKey(left.meter), meterKey(right.meter)),
      ),
      ...(mapping.sourceLocation
        ? { sourceLocation: normalizeSourceLocation(mapping.sourceLocation) }
        : {}),
    }))
    .sort(
      (left, right) =>
        compareStrings(mappingId(left), mappingId(right)) || compareCanonical(left, right),
    )
    .filter(uniqueBy(mappingId));
}

function createNodes(
  meters: readonly ContractMeterDeclaration[],
  plans: readonly ContractPlanVersionDeclaration[],
  entitlementSets: readonly ContractPlanEntitlementDeclaration[],
  providers: readonly ContractBillingProviderDeclaration[],
  mappings: readonly ContractProviderPlanMappingDeclaration[],
): readonly ContractMonetizationNode[] {
  return [
    ...meters.map(
      (meter): ContractMonetizationNode => ({
        type: "meter",
        id: meterId(meter.key),
        ...meter,
      }),
    ),
    ...plans.map(
      ({ plan, sourceLocation }): ContractMonetizationNode => ({
        type: "plan-version",
        id: planId(plan.ref),
        ref: String(plan.ref),
        planId: plan.planId,
        rating: plan.rating,
        ...(sourceLocation ? { sourceLocation: normalizeSourceLocation(sourceLocation) } : {}),
      }),
    ),
    ...entitlementSets.map(
      (set): ContractMonetizationNode => ({
        type: "entitlement-set",
        id: entitlementSetId(set.planVersionRef),
        planId: set.planId,
        planVersionRef: String(set.planVersionRef),
        entitlements: [...set.entitlements].sort((left, right) =>
          compareStrings(left.featureKey, right.featureKey),
        ),
        ...(set.sourceLocation
          ? { sourceLocation: normalizeSourceLocation(set.sourceLocation) }
          : {}),
      }),
    ),
    ...providers.map(
      (provider): ContractMonetizationNode => ({
        type: "billing-provider",
        id: providerId(provider.providerName),
        providerName: provider.providerName,
        capabilities: provider.capabilities,
        ...(provider.sourceLocation
          ? { sourceLocation: normalizeSourceLocation(provider.sourceLocation) }
          : {}),
      }),
    ),
    ...mappings.map(
      (mapping): ContractMonetizationNode => ({
        type: "provider-plan-mapping",
        id: mappingId(mapping),
        provider: mapping.provider,
        planVersionRef: String(mapping.planVersionRef),
        productId: mapping.productId,
        priceIds: [...mapping.priceIds],
        meterBindings: (mapping.meterBindings ?? []).map((binding) => ({
          meterKey: meterKey(binding.meter),
          externalMeterId: binding.externalMeterId,
        })),
        ...(mapping.sourceLocation
          ? { sourceLocation: normalizeSourceLocation(mapping.sourceLocation) }
          : {}),
      }),
    ),
  ].sort((left, right) => compareStrings(left.id, right.id));
}

function createEdges(
  routes: readonly MonetizationContractRoute[],
  plans: readonly ContractPlanVersionDeclaration[],
  entitlementSets: readonly ContractPlanEntitlementDeclaration[],
  mappings: readonly ContractProviderPlanMappingDeclaration[],
): readonly ContractMonetizationEdge[] {
  const edges: ContractMonetizationEdge[] = [];

  for (const route of routes) {
    for (const meter of route.meters ?? []) {
      edges.push({
        type: "operation-records-meter",
        from: `operation:${route.operationId}`,
        to: meterId(meter.key),
      });
    }
  }

  for (const declaration of plans) {
    for (const meter of declaration.billedMeters ?? []) {
      edges.push({
        type: "plan-version-bills-meter",
        from: planId(declaration.plan.ref),
        to: meterId(meterKey(meter)),
      });
    }
    for (const binding of declaration.plan.providerBindings) {
      edges.push({
        type: "plan-version-binds-provider",
        from: planId(declaration.plan.ref),
        to: providerId(binding.provider),
      });
    }
  }

  for (const set of entitlementSets) {
    edges.push({
      type: "plan-version-grants-entitlement",
      from: planId(set.planVersionRef),
      to: entitlementSetId(set.planVersionRef),
    });
  }

  for (const mapping of mappings) {
    edges.push({
      type: "provider-maps-plan-version",
      from: mappingId(mapping),
      to: planId(mapping.planVersionRef),
    });
    for (const binding of mapping.meterBindings ?? []) {
      edges.push({
        type: "provider-maps-meter",
        from: mappingId(mapping),
        to: meterId(meterKey(binding.meter)),
      });
    }
  }

  return edges.sort(compareEdges);
}

function validateMonetization(
  meters: readonly ContractMeterDeclaration[],
  plans: readonly ContractPlanVersionDeclaration[],
  entitlementSets: readonly ContractPlanEntitlementDeclaration[],
  providers: readonly ContractBillingProviderDeclaration[],
  mappings: readonly ContractProviderPlanMappingDeclaration[],
): readonly ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const meterByKey = new Map(meters.map((meter) => [meter.key, meter]));
  const planByRef = new Map(
    plans.map((declaration) => [String(declaration.plan.ref), declaration]),
  );
  const providerByName = new Map(providers.map((provider) => [provider.providerName, provider]));
  const entitlementByRef = new Map(entitlementSets.map((set) => [String(set.planVersionRef), set]));
  const billedMeterKeys = new Set(plans.flatMap((plan) => (plan.billedMeters ?? []).map(meterKey)));

  for (const meter of meters) {
    if (meter.billing === "required" && !billedMeterKeys.has(meter.key)) {
      diagnostics.push(
        monetizationDiagnostic(
          "CROCO_BILLING_METER_UNBOUND",
          "meter",
          meterId(meter.key),
          `Billing-required meter '${meter.key}' is not billed by any published plan version.`,
          { kind: "meter-binding", references: [meter.key] },
          `Add '${meter.key}' to a plan version's billedMeters declaration and bind that plan to a usage-capable provider.`,
          meter.sourceLocation,
        ),
      );
    }
  }

  for (const declaration of plans) {
    for (const reference of declaration.billedMeters ?? []) {
      const key = meterKey(reference);
      if (!meterByKey.has(key)) {
        diagnostics.push(
          monetizationDiagnostic(
            "CROCO_BILLING_METER_UNBOUND",
            "plan-version",
            planId(declaration.plan.ref),
            `Plan version '${declaration.plan.ref}' bills undeclared meter '${key}'.`,
            {
              kind: "plan-meter-declaration",
              references: [String(declaration.plan.ref), key],
            },
            `Declare meter '${key}' before referencing it from billedMeters.`,
            declaration.sourceLocation,
          ),
        );
      }
    }
  }

  for (const mapping of mappings) {
    const plan = planByRef.get(String(mapping.planVersionRef));
    for (const binding of mapping.meterBindings ?? []) {
      const key = meterKey(binding.meter);
      const planBillsMeter = (plan?.billedMeters ?? []).some(
        (reference) => meterKey(reference) === key,
      );
      if (!meterByKey.has(key) || !planBillsMeter) {
        diagnostics.push(
          monetizationDiagnostic(
            "CROCO_BILLING_METER_UNBOUND",
            "provider",
            mappingId(mapping),
            `Provider mapping '${mapping.provider}:${mapping.productId}' binds meter '${key}' without a declared plan billing path.`,
            {
              kind: "provider-meter-binding",
              references: [String(mapping.planVersionRef), mapping.provider, key],
            },
            `Declare meter '${key}' and add it to the mapped plan version's billedMeters before binding an external meter.`,
            mapping.sourceLocation,
          ),
        );
      }
    }
  }

  for (const declaration of plans) {
    const { plan } = declaration;
    const bindings = plan.providerBindings;
    const ratingProvider = plan.rating.mode === "provider" ? plan.rating.provider : undefined;

    for (const binding of bindings) {
      const provider = providerByName.get(binding.provider);
      if (!provider?.capabilities.checkout.supported) {
        diagnostics.push(
          monetizationDiagnostic(
            "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING",
            "provider",
            providerId(binding.provider),
            `Plan version '${plan.ref}' is bound to provider '${binding.provider}', which does not declare checkout support.`,
            {
              kind: "provider-capability",
              references: [String(plan.ref), binding.provider, "checkout"],
            },
            `Select a provider profile with checkout support or remove the '${binding.provider}' binding from '${plan.ref}'.`,
            provider?.sourceLocation ?? declaration.sourceLocation,
          ),
        );
      }

      const hasMapping = mappings.some(
        (mapping) =>
          mapping.provider === binding.provider &&
          String(mapping.planVersionRef) === String(plan.ref) &&
          mapping.productId === binding.productId &&
          sameStrings(mapping.priceIds, binding.priceIds),
      );
      if (!hasMapping) {
        diagnostics.push(
          monetizationDiagnostic(
            "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
            "plan-version",
            planId(plan.ref),
            `Plan version '${plan.ref}' has no provider mapping for '${binding.provider}:${binding.productId}'.`,
            {
              kind: "provider-plan-version",
              references: [String(plan.ref), binding.provider, binding.productId],
            },
            "Publish a provider mapping whose product and price IDs match this immutable plan version binding.",
            declaration.sourceLocation,
          ),
        );
      }
    }

    if (
      ratingProvider !== undefined &&
      !bindings.some((binding) => binding.provider === ratingProvider)
    ) {
      diagnostics.push(
        monetizationDiagnostic(
          "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
          "plan-version",
          planId(plan.ref),
          `Plan version '${plan.ref}' is rated by provider '${ratingProvider}' but has no matching provider binding.`,
          { kind: "provider-plan-binding", references: [String(plan.ref), ratingProvider] },
          `Add a provider binding for '${ratingProvider}' or change the plan rating mode.`,
          declaration.sourceLocation,
        ),
      );
    }

    if (
      ratingProvider !== undefined &&
      bindings.some((binding) => binding.provider !== ratingProvider)
    ) {
      diagnostics.push(
        monetizationDiagnostic(
          "CROCO_BILLING_RATING_MODE_CONFLICT",
          "plan-version",
          planId(plan.ref),
          `Plan version '${plan.ref}' declares provider rating '${ratingProvider}' with bindings for a different provider.`,
          {
            kind: "rating-mode",
            references: [String(plan.ref), ...bindings.map((binding) => binding.provider)],
          },
          "Keep provider-rated plan bindings on the declared rating provider, or use Croco rating explicitly.",
          declaration.sourceLocation,
        ),
      );
    }

    if ((declaration.billedMeters ?? []).length > 0) {
      for (const binding of bindings) {
        const provider = providerByName.get(binding.provider);
        if (!provider?.capabilities.usage.supported) {
          diagnostics.push(
            monetizationDiagnostic(
              "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING",
              "provider",
              providerId(binding.provider),
              `Usage-priced plan version '${plan.ref}' is bound to provider '${binding.provider}', which does not declare usage ingestion support.`,
              {
                kind: "provider-capability",
                references: [String(plan.ref), binding.provider, "usage"],
              },
              `Select a provider profile with usage support or remove usage pricing from '${plan.ref}'.`,
              provider?.sourceLocation ?? declaration.sourceLocation,
            ),
          );
        }
      }
    }
  }

  for (const set of entitlementSets) {
    const plan = planByRef.get(String(set.planVersionRef));
    if (!plan || plan.plan.planId !== set.planId) {
      diagnostics.push(
        monetizationDiagnostic(
          "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH",
          "entitlement",
          entitlementSetId(set.planVersionRef),
          `Entitlement set '${set.planVersionRef}' does not resolve to the same plan family and version as its billing plan.`,
          {
            kind: "entitlement-plan-version",
            references: [set.planId, String(set.planVersionRef)],
          },
          "Bind the entitlement set to an existing plan version with the same planId and immutable version reference.",
          set.sourceLocation,
        ),
      );
    }

    for (const entitlement of set.entitlements) {
      if (entitlement.overagePolicy !== "ALLOW_WITH_OVERAGE") {
        continue;
      }
      const meter = entitlement.meterId ? meterByKey.get(entitlement.meterId) : undefined;
      const planBillsMeter = (plan?.billedMeters ?? []).some(
        (candidate) => meterKey(candidate) === entitlement.meterId,
      );
      const hasProviderMeterBinding = mappings.some(
        (mapping) =>
          String(mapping.planVersionRef) === String(set.planVersionRef) &&
          (mapping.meterBindings ?? []).some(
            (binding) => meterKey(binding.meter) === entitlement.meterId,
          ),
      );
      if (!meter || meter.billing !== "required" || !planBillsMeter || !hasProviderMeterBinding) {
        diagnostics.push(
          monetizationDiagnostic(
            "CROCO_BILLING_METER_UNBOUND",
            "entitlement",
            `entitlement:${set.planVersionRef}:${entitlement.featureKey}`,
            `Entitlement '${entitlement.featureKey}' allows billable overage without a complete billing-required meter and provider mapping path.`,
            {
              kind: "overage-billing-path",
              references: [
                String(set.planVersionRef),
                entitlement.featureKey,
                entitlement.meterId ?? "missing-meter",
              ],
            },
            "Declare a billing-required meter, bill it from this plan version, and add an external provider meter binding.",
            set.sourceLocation,
          ),
        );
      }
    }
  }

  for (const mapping of mappings) {
    const plan = planByRef.get(String(mapping.planVersionRef));
    const entitlementSet = entitlementByRef.get(String(mapping.planVersionRef));
    const matchesPlanBinding = plan?.plan.providerBindings.some(
      (binding) =>
        binding.provider === mapping.provider &&
        binding.productId === mapping.productId &&
        sameStrings(binding.priceIds, mapping.priceIds),
    );
    if (!plan || !matchesPlanBinding) {
      diagnostics.push(
        monetizationDiagnostic(
          "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
          "provider",
          mappingId(mapping),
          `Provider mapping '${mapping.provider}:${mapping.productId}' does not resolve to its declared plan version '${mapping.planVersionRef}'.`,
          {
            kind: "provider-plan-version",
            references: [mapping.provider, mapping.productId, String(mapping.planVersionRef)],
          },
          "Align the provider product and price mapping with the immutable plan version provider binding.",
          mapping.sourceLocation,
        ),
      );
    }
    if (!entitlementSet) {
      diagnostics.push(
        monetizationDiagnostic(
          "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH",
          "entitlement",
          mappingId(mapping),
          `Provider mapping '${mapping.provider}:${mapping.productId}' resolves '${mapping.planVersionRef}' without an entitlement set for that exact version.`,
          {
            kind: "provider-entitlement-version",
            references: [mapping.provider, String(mapping.planVersionRef)],
          },
          "Publish an entitlement set for the exact provider-mapped plan version.",
          mapping.sourceLocation,
        ),
      );
    }
  }

  return diagnostics.sort(compareDiagnostics);
}

function monetizationDiagnostic(
  code: string,
  target: ContractDiagnostic["target"],
  contractId: string,
  message: string,
  evidence: ContractDiagnosticEvidence,
  recoveryAction: string,
  sourceLocation?: ContractDiagnosticSourceLocation,
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    target,
    message,
    contractId,
    source: "credential-free-structural",
    evidence,
    recovery: { action: recoveryAction },
    ...(sourceLocation ? { sourceLocation: normalizeSourceLocation(sourceLocation) } : {}),
  };
}

function normalizeSourceLocation(
  sourceLocation: ContractDiagnosticSourceLocation,
): ContractDiagnosticSourceLocation {
  const normalized = sourceLocation.path.split("\\").join("/");
  const sourceIndex = normalized.lastIndexOf("/src/");
  const pathSegments = normalized.split("/");
  const finalPathSegment = pathSegments[pathSegments.length - 1];
  const path =
    sourceIndex >= 0
      ? normalized.slice(sourceIndex + 1)
      : normalized.startsWith("src/")
        ? normalized
        : (finalPathSegment ?? normalized);

  return {
    path,
    ...(sourceLocation.line === undefined ? {} : { line: sourceLocation.line }),
    ...(sourceLocation.column === undefined ? {} : { column: sourceLocation.column }),
  };
}

function meterKey(reference: ContractMeterReference): string {
  return typeof reference === "string" ? reference : reference.key;
}

function meterId(key: string): string {
  return `meter:${key}`;
}

function planId(ref: string): string {
  return `plan-version:${String(ref)}`;
}

function providerId(provider: string): string {
  return `provider:${provider}`;
}

function entitlementSetId(ref: string): string {
  return `entitlement-set:${String(ref)}`;
}

function mappingId(mapping: ContractProviderPlanMappingDeclaration): string {
  return `provider-mapping:${mapping.provider}:${mapping.planVersionRef}:${mapping.productId}`;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEdges(left: ContractMonetizationEdge, right: ContractMonetizationEdge): number {
  return compareStrings(
    `${left.type}:${left.from}:${left.to}`,
    `${right.type}:${right.from}:${right.to}`,
  );
}

function compareDiagnostics(left: ContractDiagnostic, right: ContractDiagnostic): number {
  return compareStrings(
    `${left.code}:${left.contractId ?? ""}:${left.message}`,
    `${right.code}:${right.contractId ?? ""}:${right.message}`,
  );
}

function compareCanonical(left: unknown, right: unknown): number {
  return compareStrings(canonicalString(left), canonicalString(right));
}

function validateDeclarationConflicts<
  Declaration extends { readonly sourceLocation?: ContractDiagnosticSourceLocation },
>(
  declarations: readonly Declaration[],
  getId: (declaration: Declaration) => string,
  target: ContractDiagnostic["target"],
): readonly ContractDiagnostic[] {
  const firstById = new Map<
    string,
    { readonly signature: string; readonly declaration: Declaration }
  >();
  const reported = new Set<string>();
  const diagnostics: ContractDiagnostic[] = [];

  for (const declaration of [...declarations].sort(compareCanonical)) {
    const id = getId(declaration);
    const signature = canonicalSemanticString(withoutSourceLocation(declaration));
    const first = firstById.get(id);
    if (!first) {
      firstById.set(id, { signature, declaration });
      continue;
    }
    if (first.signature === signature || reported.has(id)) {
      continue;
    }
    reported.add(id);
    diagnostics.push(
      monetizationDiagnostic(
        "CROCO_BILLING_DECLARATION_CONFLICT",
        target,
        id,
        `Monetization contract '${id}' has multiple declarations with conflicting values.`,
        { kind: "declaration-conflict", references: [id] },
        "Keep one canonical declaration per contract identity, or make duplicate declarations structurally equivalent.",
        first.declaration.sourceLocation ?? declaration.sourceLocation,
      ),
    );
  }

  return diagnostics;
}

function uniqueBy<Value>(getKey: (value: Value) => string): (value: Value) => boolean {
  const seen = new Set<string>();
  return (value) => {
    const key = getKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  };
}

function withoutSourceLocation(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "sourceLocation"));
}

function canonicalSemanticString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalSemanticString).sort(compareStrings).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${canonicalSemanticString(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function canonicalString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalString).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const sortedLeft = [...left].sort(compareStrings);
  const sortedRight = [...right].sort(compareStrings);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalArray<T>(
  value: unknown,
  predicate: (candidate: unknown) => candidate is T,
): value is readonly T[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(predicate));
}

function isContractMonetizationNode(value: unknown): value is ContractMonetizationNode {
  if (!isRecord(value) || typeof value["id"] !== "string") {
    return false;
  }
  switch (value["type"]) {
    case "meter":
      return isMeterDeclaration(value);
    case "plan-version":
      return (
        typeof value["ref"] === "string" &&
        typeof value["planId"] === "string" &&
        isRating(value["rating"]) &&
        hasOptionalSourceLocation(value)
      );
    case "entitlement-set":
      return isEntitlementSetDeclaration(value);
    case "billing-provider":
      return isProviderDeclaration(value);
    case "provider-plan-mapping":
      return (
        typeof value["provider"] === "string" &&
        typeof value["planVersionRef"] === "string" &&
        typeof value["productId"] === "string" &&
        Array.isArray(value["priceIds"]) &&
        value["priceIds"].every((priceId) => typeof priceId === "string") &&
        Array.isArray(value["meterBindings"]) &&
        value["meterBindings"].every(
          (binding) =>
            isRecord(binding) &&
            typeof binding["meterKey"] === "string" &&
            typeof binding["externalMeterId"] === "string",
        ) &&
        hasOptionalSourceLocation(value)
      );
    default:
      return false;
  }
}

function isContractMonetizationEdge(value: unknown): value is ContractMonetizationEdge {
  return (
    isRecord(value) &&
    [
      "operation-records-meter",
      "plan-version-bills-meter",
      "plan-version-grants-entitlement",
      "plan-version-binds-provider",
      "provider-maps-plan-version",
      "provider-maps-meter",
    ].includes(String(value["type"])) &&
    typeof value["from"] === "string" &&
    typeof value["to"] === "string"
  );
}

function isMeterReference(value: unknown): value is ContractMeterReference {
  return typeof value === "string" || (isRecord(value) && typeof value["key"] === "string");
}

function isSourceLocation(value: unknown): value is ContractDiagnosticSourceLocation {
  return (
    isRecord(value) &&
    typeof value["path"] === "string" &&
    (value["line"] === undefined || typeof value["line"] === "number") &&
    (value["column"] === undefined || typeof value["column"] === "number")
  );
}

function hasOptionalSourceLocation(value: Record<string, unknown>): boolean {
  return value["sourceLocation"] === undefined || isSourceLocation(value["sourceLocation"]);
}

function isMeterDeclaration(value: unknown): value is ContractMeterDeclaration {
  return (
    isRecord(value) &&
    typeof value["key"] === "string" &&
    (value["aggregation"] === "COUNT" || value["aggregation"] === "SUM") &&
    typeof value["unit"] === "string" &&
    (value["billing"] === "local" || value["billing"] === "required") &&
    hasOptionalSourceLocation(value)
  );
}

function isProviderBinding(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value["provider"] === "string" &&
    typeof value["productId"] === "string" &&
    Array.isArray(value["priceIds"]) &&
    value["priceIds"].every((priceId) => typeof priceId === "string")
  );
}

function isPlanVersionDeclaration(value: unknown): value is ContractPlanVersionDeclaration {
  if (!isRecord(value) || !isRecord(value["plan"])) {
    return false;
  }
  const plan = value["plan"];
  return (
    typeof plan["ref"] === "string" &&
    typeof plan["planId"] === "string" &&
    isRating(plan["rating"]) &&
    Array.isArray(plan["providerBindings"]) &&
    plan["providerBindings"].every(isProviderBinding) &&
    isOptionalArray(value["billedMeters"], isMeterReference) &&
    hasOptionalSourceLocation(value)
  );
}

function isRating(value: unknown): value is ContractPlanVersionValue["rating"] {
  return (
    isRecord(value) &&
    (value["mode"] === "croco" ||
      (value["mode"] === "provider" && typeof value["provider"] === "string"))
  );
}

function isEntitlement(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value["featureKey"] === "string" &&
    ["boolean", "metered", "static"].includes(String(value["type"])) &&
    (value["meterId"] === undefined || typeof value["meterId"] === "string") &&
    (value["meterBilling"] === undefined ||
      value["meterBilling"] === "local" ||
      value["meterBilling"] === "required") &&
    (value["quota"] === undefined || typeof value["quota"] === "number") &&
    (value["overagePolicy"] === undefined ||
      ["BLOCK", "WARN", "ALLOW_WITH_OVERAGE"].includes(String(value["overagePolicy"])))
  );
}

function isEntitlementSetDeclaration(value: unknown): value is ContractPlanEntitlementDeclaration {
  return (
    isRecord(value) &&
    typeof value["planId"] === "string" &&
    typeof value["planVersionRef"] === "string" &&
    Array.isArray(value["entitlements"]) &&
    value["entitlements"].every(isEntitlement) &&
    hasOptionalSourceLocation(value)
  );
}

function isCapability(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value["supported"] === "boolean" &&
    (value["reason"] === undefined || typeof value["reason"] === "string")
  );
}

function isProviderDeclaration(value: unknown): value is ContractBillingProviderDeclaration {
  return (
    isRecord(value) &&
    typeof value["providerName"] === "string" &&
    isRecord(value["capabilities"]) &&
    isCapability(value["capabilities"]["checkout"]) &&
    isCapability(value["capabilities"]["usage"]) &&
    hasOptionalSourceLocation(value)
  );
}

function isMeterBinding(value: unknown): value is {
  readonly meter: ContractMeterReference;
  readonly externalMeterId: string;
} {
  return (
    isRecord(value) &&
    isMeterReference(value["meter"]) &&
    typeof value["externalMeterId"] === "string"
  );
}

function isProviderMappingDeclaration(
  value: unknown,
): value is ContractProviderPlanMappingDeclaration {
  return (
    isRecord(value) &&
    typeof value["provider"] === "string" &&
    typeof value["planVersionRef"] === "string" &&
    typeof value["productId"] === "string" &&
    Array.isArray(value["priceIds"]) &&
    value["priceIds"].every((priceId) => typeof priceId === "string") &&
    isOptionalArray(value["meterBindings"], isMeterBinding) &&
    hasOptionalSourceLocation(value)
  );
}

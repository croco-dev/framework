export type SmokeMatrixTier = "spine-blocking" | "ecosystem-advisory";

export type SmokeMatrixStatus = "pending" | "passed" | "failed";

export type AdvisorySmokeMetadata = {
  readonly owner: string;
  readonly recoveryAction: string;
};

export type SmokeMatrixCaseDefinition = {
  readonly name: string;
  readonly tier: SmokeMatrixTier;
  readonly advisory?: AdvisorySmokeMetadata;
};

export type SmokeMatrixCaseState = SmokeMatrixCaseDefinition & {
  readonly status: SmokeMatrixStatus;
};

export type SmokeMatrixFailure = {
  readonly message: string;
  readonly owner: string;
  readonly recoveryAction: string;
};

export type SmokeMatrixTierReport = {
  readonly schemaVersion: "croco.generated-app-smoke/v2";
  readonly tier: SmokeMatrixTier;
  readonly generatedAt: string;
  readonly filteredRun: boolean;
  readonly status: SmokeMatrixStatus;
  readonly release: {
    readonly blockingTier: "spine-blocking";
    readonly status: SmokeMatrixStatus;
  };
  readonly failure?: SmokeMatrixFailure;
  readonly cases: readonly SmokeMatrixCaseState[];
};

export type SmokeMatrixAggregateReport = {
  readonly schemaVersion: "croco.generated-app-smoke/v2";
  readonly generatedAt: string;
  readonly status: SmokeMatrixStatus;
  readonly release: {
    readonly blockingTier: "spine-blocking";
    readonly status: SmokeMatrixStatus;
  };
  readonly tiers: readonly {
    readonly tier: SmokeMatrixTier;
    readonly status: SmokeMatrixStatus;
  }[];
  readonly cases: readonly SmokeMatrixCaseState[];
};

export type SmokeMatrixSelection<T extends SmokeMatrixCaseDefinition> = {
  readonly cases: readonly T[];
  readonly selectedTier?: SmokeMatrixTier;
  readonly requestedCaseNames: readonly string[];
  readonly filteredRun: boolean;
};

export const GENERATED_SMOKE_MATRIX_CASES = [
  {
    name: "blank-basic",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "create-croco-app blank template owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=blank-basic pnpm create-croco-app:smoke; restore blank template typecheck coverage.",
    },
  },
  {
    name: "goal-saas-api",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "create-croco-app SaaS goal owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=goal-saas-api pnpm create-croco-app:smoke; inspect the SaaS goal manifest, runtime capability, typecheck, build, test, and failure-drill contracts.",
    },
  },
  {
    name: "graphql-standalone-api",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "Presentation standalone GraphQL owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=graphql-standalone-api pnpm create-croco-app:smoke; inspect GraphQL contract, protected route, and standalone build coverage.",
    },
  },
  { name: "graphql-lambda-api", tier: "spine-blocking" },
  {
    name: "trpc-nextjs-vercel-fullstack",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "Presentation Next.js tRPC owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=trpc-nextjs-vercel-fullstack pnpm create-croco-app:smoke; inspect the ddd-fullstack Next.js tRPC build.",
    },
  },
  {
    name: "graphql-nextjs-opennext",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "Presentation GraphQL OpenNext owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=graphql-nextjs-opennext pnpm create-croco-app:smoke; inspect GraphQL contract scripts and OpenNext files.",
    },
  },
  {
    name: "trpc-nextjs-docker-frontend",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "Presentation Docker frontend owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=trpc-nextjs-docker-frontend pnpm create-croco-app:smoke; restore web Dockerfile generation.",
    },
  },
  { name: "graphql-vite-spa-docker", tier: "spine-blocking" },
  {
    name: "meta-vite-web",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "Meta Vite presentation owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=meta-vite-web pnpm create-croco-app:smoke; inspect the meta-vite build and presentation smoke.",
    },
  },
  { name: "meta-vite-fullstack-workers", tier: "spine-blocking" },
  { name: "production-app-starter", tier: "spine-blocking" },
  {
    name: "admin-console-starter",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "Admin console generated app owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=admin-console-starter pnpm create-croco-app:smoke; inspect admin smoke, contracts, and the DI graph.",
    },
  },
  { name: "saas-golden-path", tier: "spine-blocking" },
  {
    name: "saas-cloudflare-profile",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "SaaS Cloudflare profile owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=saas-cloudflare-profile pnpm create-croco-app:smoke; inspect the provider profile and Workers runtime capability manifest.",
    },
  },
  {
    name: "saas-lambda-profile",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "SaaS Lambda profile owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=saas-lambda-profile pnpm create-croco-app:smoke; inspect the provider profile and Lambda runtime capability manifest.",
    },
  },
  {
    name: "ai-saas-golden-path",
    tier: "ecosystem-advisory",
    advisory: {
      owner: "AI SaaS generated app owner",
      recoveryAction:
        "CROCO_GENERATED_SMOKE_CASES=ai-saas-golden-path pnpm create-croco-app:smoke; inspect the AI full demo flow and contracts.",
    },
  },
] as const satisfies readonly SmokeMatrixCaseDefinition[];

const SMOKE_MATRIX_TIERS = ["spine-blocking", "ecosystem-advisory"] as const;

export function getGeneratedSmokeMatrixCaseNames(): readonly string[] {
  return GENERATED_SMOKE_MATRIX_CASES.map(({ name }) => name);
}

export function withGeneratedSmokeMatrixMetadata<T extends { readonly name: string }>(
  cases: readonly T[],
): readonly (T & SmokeMatrixCaseDefinition)[] {
  const definitions = new Map<string, SmokeMatrixCaseDefinition>(
    GENERATED_SMOKE_MATRIX_CASES.map((definition) => [definition.name, definition]),
  );
  const result = cases.map((smokeCase) => {
    const definition = definitions.get(smokeCase.name);
    if (!definition) {
      throw new Error(`Generated smoke case ${smokeCase.name} has no matrix tier definition`);
    }

    return { ...smokeCase, ...definition };
  });

  const unknownDefinitions = GENERATED_SMOKE_MATRIX_CASES.filter(
    ({ name }) => !cases.some((smokeCase) => smokeCase.name === name),
  );
  if (unknownDefinitions.length > 0) {
    throw new Error(
      `Generated smoke matrix definition has no executable case(s): ${unknownDefinitions.map(({ name }) => name).join(", ")}`,
    );
  }

  assertGeneratedSmokeMatrixContract(result);
  return result;
}

export function assertGeneratedSmokeMatrixContract(
  cases: readonly SmokeMatrixCaseDefinition[],
): void {
  const names = new Set<string>();
  for (const smokeCase of cases) {
    if (names.has(smokeCase.name)) {
      throw new Error(`Generated smoke matrix has a duplicate case name: ${smokeCase.name}`);
    }
    names.add(smokeCase.name);

    if (smokeCase.tier === "ecosystem-advisory") {
      if (!smokeCase.advisory?.owner.trim() || !smokeCase.advisory.recoveryAction.trim()) {
        throw new Error(
          `Advisory generated smoke case ${smokeCase.name} requires owner and recoveryAction`,
        );
      }
    } else if (smokeCase.advisory) {
      throw new Error(
        `Spine generated smoke case ${smokeCase.name} must not include advisory metadata`,
      );
    }
  }

  if (!cases.some(({ tier }) => tier === "spine-blocking")) {
    throw new Error("Generated smoke matrix requires at least one spine-blocking case");
  }
}

export function selectGeneratedSmokeMatrixCases<T extends SmokeMatrixCaseDefinition>(
  cases: readonly T[],
  options: {
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string | undefined>>;
  } = {},
): SmokeMatrixSelection<T> {
  const args = options.args ?? [];
  const env = options.env ?? {};
  const { selectedTier, requestedCaseNames } = parseGeneratedSmokeMatrixSelection(args, env);
  const knownCaseNames = new Set(cases.map(({ name }) => name));
  const unknownCases = requestedCaseNames.filter((caseName) => !knownCaseNames.has(caseName));
  if (unknownCases.length > 0) {
    throw new Error(`Unknown create-croco-app generated smoke case(s): ${unknownCases.join(", ")}`);
  }

  const requestedCases =
    requestedCaseNames.length > 0
      ? cases.filter(({ name }) => requestedCaseNames.includes(name))
      : cases;
  if (selectedTier && requestedCaseNames.length > 0) {
    const outsideTier = requestedCases
      .filter(({ tier }) => tier !== selectedTier)
      .map(({ name }) => name);
    if (outsideTier.length > 0) {
      throw new Error(
        `Generated smoke case(s) do not belong to selected tier ${selectedTier}: ${outsideTier.join(", ")}`,
      );
    }
  }

  const selectedCases = selectedTier
    ? requestedCases.filter(({ tier }) => tier === selectedTier)
    : requestedCases;
  if (selectedCases.length === 0) {
    throw new Error("Generated smoke case selection is empty");
  }

  return {
    cases: selectedCases,
    selectedTier,
    requestedCaseNames,
    filteredRun: Boolean(selectedTier) || requestedCaseNames.length > 0,
  };
}

export function createGeneratedSmokeMatrixTierReport(
  tier: SmokeMatrixTier,
  selectedCases: readonly Pick<SmokeMatrixCaseState, "name" | "status">[],
  options: {
    readonly filteredRun: boolean;
    readonly previousReport?: unknown;
    readonly generatedAt?: string;
    readonly failure?: SmokeMatrixFailure;
  },
): SmokeMatrixTierReport {
  const previous = isGeneratedSmokeMatrixTierReport(options.previousReport, tier)
    ? new Map(options.previousReport.cases.map((smokeCase) => [smokeCase.name, smokeCase]))
    : new Map<string, SmokeMatrixCaseState>();
  const updates = new Map(selectedCases.map((smokeCase) => [smokeCase.name, smokeCase.status]));
  const cases = GENERATED_SMOKE_MATRIX_CASES.filter((smokeCase) => smokeCase.tier === tier).map(
    (definition) => ({
      ...definition,
      status: updates.get(definition.name) ?? previous.get(definition.name)?.status ?? "pending",
    }),
  );
  const status = options.failure
    ? "failed"
    : deriveSmokeMatrixStatus(cases.map((smokeCase) => smokeCase.status));

  return {
    schemaVersion: "croco.generated-app-smoke/v2",
    tier,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    filteredRun: options.filteredRun,
    status,
    release: {
      blockingTier: "spine-blocking",
      status: tier === "spine-blocking" ? status : "pending",
    },
    failure: options.failure,
    cases,
  };
}

export function createGeneratedSmokeMatrixAggregateReport(
  reports: Readonly<Record<SmokeMatrixTier, unknown>>,
  generatedAt = new Date().toISOString(),
): SmokeMatrixAggregateReport {
  const tierReports = SMOKE_MATRIX_TIERS.map((tier) =>
    isGeneratedSmokeMatrixTierReport(reports[tier], tier) ? reports[tier] : undefined,
  );
  const tiers = SMOKE_MATRIX_TIERS.map((tier, index) => ({
    tier,
    status: tierReports[index]?.status ?? "pending",
  }));
  const cases = tierReports.flatMap((report) => report?.cases ?? []);
  const spineStatus = tiers.find(({ tier }) => tier === "spine-blocking")?.status ?? "pending";

  return {
    schemaVersion: "croco.generated-app-smoke/v2",
    generatedAt,
    status: deriveSmokeMatrixStatus(tiers.map(({ status }) => status)),
    release: { blockingTier: "spine-blocking", status: spineStatus },
    tiers,
    cases,
  };
}

export function isGeneratedSmokeMatrixTierReport(
  value: unknown,
  tier: SmokeMatrixTier,
): value is SmokeMatrixTierReport {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "croco.generated-app-smoke/v2" ||
    value.tier !== tier
  ) {
    return false;
  }
  if (
    !Array.isArray(value.cases) ||
    !isSmokeMatrixStatus(value.status) ||
    !isRecord(value.release) ||
    value.release.blockingTier !== "spine-blocking" ||
    !isSmokeMatrixStatus(value.release.status) ||
    value.release.status !== (tier === "spine-blocking" ? value.status : "pending") ||
    (value.failure !== undefined && !isSmokeMatrixFailure(value.failure))
  ) {
    return false;
  }

  const expected = GENERATED_SMOKE_MATRIX_CASES.filter((smokeCase) => smokeCase.tier === tier);
  if (value.cases.length !== expected.length) {
    return false;
  }

  const expectedByName = new Map<string, SmokeMatrixCaseDefinition>(
    expected.map((smokeCase) => [smokeCase.name, smokeCase]),
  );
  const seen = new Set<string>();
  for (const smokeCase of value.cases) {
    if (!isRecord(smokeCase) || typeof smokeCase.name !== "string" || seen.has(smokeCase.name)) {
      return false;
    }
    seen.add(smokeCase.name);
    const definition = expectedByName.get(smokeCase.name);
    if (!definition || smokeCase.tier !== tier || !isSmokeMatrixStatus(smokeCase.status)) {
      return false;
    }
    if (tier === "ecosystem-advisory") {
      if (
        !isAdvisoryMetadata(smokeCase.advisory) ||
        smokeCase.advisory.owner !== definition.advisory?.owner ||
        smokeCase.advisory.recoveryAction !== definition.advisory?.recoveryAction
      ) {
        return false;
      }
    } else if ("advisory" in smokeCase) {
      return false;
    }
  }

  return true;
}

export function renderGeneratedSmokeMatrixReport(
  report: SmokeMatrixTierReport | SmokeMatrixAggregateReport,
): string {
  const lines = [
    "# Generated app smoke matrix",
    "",
    `- Status: ${report.status}`,
    `- Generated at: ${report.generatedAt}`,
    `- Release blocking tier: ${report.release.blockingTier}`,
    `- Release status: ${report.release.status}`,
    "",
  ];

  if ("tier" in report) {
    lines.push(
      `- Tier: ${report.tier}`,
      `- Filtered run: ${report.filteredRun ? "yes" : "no"}`,
      "",
    );
  } else {
    lines.push("## Tier summary", "", "| Tier | Status |", "| --- | --- |");
    lines.push(...report.tiers.map(({ tier, status }) => `| ${tier} | ${status} |`), "");
  }

  if ("failure" in report && report.failure) {
    lines.push(
      "## Failure",
      "",
      `- Message: ${escapeMarkdown(report.failure.message)}`,
      `- Owner: ${escapeMarkdown(report.failure.owner)}`,
      `- Recovery: ${escapeMarkdown(report.failure.recoveryAction)}`,
      "",
    );
  }

  lines.push(
    "## Cases",
    "",
    "| Case | Tier | Status | Advisory owner | Recovery action |",
    "| --- | --- | --- | --- | --- |",
    ...report.cases.map((smokeCase) => {
      const advisory = smokeCase.advisory;
      return `| \`${smokeCase.name}\` | ${smokeCase.tier} | ${smokeCase.status} | ${advisory ? escapeMarkdown(advisory.owner) : "-"} | ${advisory ? escapeMarkdown(advisory.recoveryAction) : "-"} |`;
    }),
    "",
  );

  return lines.join("\n");
}

function parseGeneratedSmokeMatrixSelection(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): {
  readonly selectedTier?: SmokeMatrixTier;
  readonly requestedCaseNames: readonly string[];
} {
  let selectedTier = parseSmokeMatrixTier(
    env.CROCO_GENERATED_SMOKE_TIER,
    "CROCO_GENERATED_SMOKE_TIER",
  );
  const requestedCaseNames = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--tier") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--tier requires spine-blocking or ecosystem-advisory");
      }
      const parsedTier = parseSmokeMatrixTier(value, "--tier");
      if (selectedTier && selectedTier !== parsedTier) {
        throw new Error("CROCO_GENERATED_SMOKE_TIER and --tier must select the same tier");
      }
      selectedTier = parsedTier;
      index += 1;
      continue;
    }
    if (arg.startsWith("--tier=")) {
      const parsedTier = parseSmokeMatrixTier(arg.slice("--tier=".length), "--tier");
      if (selectedTier && selectedTier !== parsedTier) {
        throw new Error("CROCO_GENERATED_SMOKE_TIER and --tier must select the same tier");
      }
      selectedTier = parsedTier;
      continue;
    }
    requestedCaseNames.add(arg);
  }

  for (const caseName of (env.CROCO_GENERATED_SMOKE_CASES ?? "").split(",")) {
    const trimmed = caseName.trim();
    if (trimmed) {
      requestedCaseNames.add(trimmed);
    }
  }

  return { selectedTier, requestedCaseNames: [...requestedCaseNames] };
}

function parseSmokeMatrixTier(
  value: string | undefined,
  source: string,
): SmokeMatrixTier | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "spine-blocking" || value === "ecosystem-advisory") {
    return value;
  }
  throw new Error(`${source} must be spine-blocking or ecosystem-advisory`);
}

function deriveSmokeMatrixStatus(statuses: readonly SmokeMatrixStatus[]): SmokeMatrixStatus {
  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }
  if (statuses.length === 0 || statuses.some((status) => status === "pending")) {
    return "pending";
  }
  return "passed";
}

function isSmokeMatrixStatus(value: unknown): value is SmokeMatrixStatus {
  return value === "pending" || value === "passed" || value === "failed";
}

function isAdvisoryMetadata(value: unknown): value is AdvisorySmokeMetadata {
  return (
    isRecord(value) &&
    typeof value.owner === "string" &&
    value.owner.trim().length > 0 &&
    typeof value.recoveryAction === "string" &&
    value.recoveryAction.trim().length > 0
  );
}

function isSmokeMatrixFailure(value: unknown): value is SmokeMatrixFailure {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    typeof value.owner === "string" &&
    value.owner.length > 0 &&
    typeof value.recoveryAction === "string" &&
    value.recoveryAction.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

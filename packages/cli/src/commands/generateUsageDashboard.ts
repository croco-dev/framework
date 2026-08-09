import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { registerController } from "../libs/codemods/registerController.js";
import type { RegisterControllerResult } from "../libs/codemods/registerController.js";
import { CLI_DIAGNOSTIC_CODES, withLegacyCode } from "../libs/diagnosticCodes.js";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import {
  assertGeneratedImportDependencies,
  hasManifestDependency,
  readPackageManifest,
} from "../libs/generatedImportContract.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

const DEFAULT_API_PATH = "/ops/usage";
const DEFAULT_PAGE_PATH = "/usage";
const CONTROLLER_CLASS_NAME = "UsageDashboardController";

class InvalidUsageDashboardRoutePathProblem extends Problem {
  constructor(label: string, value: string) {
    super(
      CLI_DIAGNOSTIC_CODES.usageDashboardInvalidRoutePath,
      ProblemCategory.BadRequest,
      `Invalid ${label}: ${value}`,
      withLegacyCode("usageDashboardInvalidRoutePath"),
    );
  }
}

type GeneratedSource = {
  readonly path: string;
  readonly content: string;
};

type RouteParts = {
  readonly controllerPath: string;
  readonly methodPath: string;
};

type ConsolePageMode = "ssr" | "spa";

export interface RunGenerateUsageDashboardOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
  apiPath?: string;
  pagePath?: string;
  page?: boolean;
}

export interface RunGenerateUsageDashboardApiResult {
  apiPath: string;
  files: WriteResult[];
  registration: RegisterControllerResult;
}

export interface RunGenerateUsageDashboardPageResult {
  pagePath: string;
  mode: ConsolePageMode;
  files: WriteResult[];
}

export interface RunGenerateUsageDashboardResult {
  api: RunGenerateUsageDashboardApiResult;
  page: RunGenerateUsageDashboardPageResult | null;
}

export async function runGenerateUsageDashboard(
  options: RunGenerateUsageDashboardOptions = {},
): Promise<RunGenerateUsageDashboardResult | null> {
  const {
    dryRun = false,
    overwrite = false,
    cwd = process.cwd(),
    apiPath = DEFAULT_API_PATH,
    pagePath = DEFAULT_PAGE_PATH,
    page = true,
  } = options;
  const workspace = await detect(cwd);

  if (!workspace.root || !workspace.hasApiServer) {
    console.log("No Croco API workspace detected. Run from a Croco project with apps/api-server.");
    return null;
  }

  const normalizedApiPath = normalizeRoutePath(apiPath, "apiPath");
  const normalizedPagePath = normalizeRoutePath(pagePath, "pagePath");
  const apiServerSrc = join(workspace.root, "apps", "api-server", "src");
  const apiSources = createApiSources(apiServerSrc, splitRoutePath(normalizedApiPath));
  const apiManifestPath = join(workspace.root, "apps", "api-server", "package.json");

  await assertGeneratedImportDependencies({
    manifestPath: apiManifestPath,
    manifestLabel: "apps/api-server/package.json",
    sources: apiSources,
  });

  const apiFiles = await Promise.all(
    apiSources.map((source) => fileWriterWrite(source.path, source.content, { dryRun, overwrite })),
  );
  const registration = await registerController({
    entryPath: resolveApiEntryPath(apiServerSrc),
    importPath: "./controllers/UsageDashboardController",
    className: CONTROLLER_CLASS_NAME,
    dryRun,
  });

  const pageResult =
    page && workspace.hasConsoleWeb
      ? await generateConsolePage({
          workspaceRoot: workspace.root,
          apiPath: normalizedApiPath,
          pagePath: normalizedPagePath,
          dryRun,
          overwrite,
        })
      : null;

  return {
    api: {
      apiPath: normalizedApiPath,
      files: apiFiles,
      registration,
    },
    page: pageResult,
  };
}

export const generateUsageDashboard = defineCommand({
  meta: {
    name: "usage-dashboard",
    description: "Generate a SaaS usage dashboard API and optional console page",
  },
  args: {
    ...GLOBAL_OPTIONS,
    apiPath: {
      type: "string",
      default: DEFAULT_API_PATH,
      description: "Usage dashboard API path",
    },
    pagePath: {
      type: "string",
      default: DEFAULT_PAGE_PATH,
      description: "Console page path",
    },
    page: {
      type: "boolean",
      default: true,
      description: "Generate console page when apps/console-web exists",
    },
  },
  async run({ args }) {
    const result = await runGenerateUsageDashboard({
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      apiPath: typeof args.apiPath === "string" ? args.apiPath : undefined,
      pagePath: typeof args.pagePath === "string" ? args.pagePath : undefined,
      page: Boolean(args.page),
    });

    logGenerateUsageDashboardResult(result);
  },
});

async function generateConsolePage(options: {
  readonly workspaceRoot: string;
  readonly apiPath: string;
  readonly pagePath: string;
  readonly dryRun: boolean;
  readonly overwrite: boolean;
}): Promise<RunGenerateUsageDashboardPageResult> {
  const consoleWebManifestPath = join(options.workspaceRoot, "apps", "console-web", "package.json");
  const mode = await detectConsolePageMode(consoleWebManifestPath);
  const pageDir = join(options.workspaceRoot, "apps", "console-web", "pages", "usage");
  const pageSources = [
    {
      path: join(pageDir, "Page.tsx"),
      content: pageTemplate(options.apiPath),
    },
    {
      path: join(pageDir, "route.ts"),
      content: pageRouteTemplate({ pagePath: options.pagePath, mode }),
    },
  ];

  await assertGeneratedImportDependencies({
    manifestPath: consoleWebManifestPath,
    manifestLabel: "apps/console-web/package.json",
    sources: pageSources,
  });

  const files = await Promise.all(
    pageSources.map((source) =>
      fileWriterWrite(source.path, source.content, {
        dryRun: options.dryRun,
        overwrite: options.overwrite,
      }),
    ),
  );

  return {
    pagePath: options.pagePath,
    mode,
    files,
  };
}

async function detectConsolePageMode(manifestPath: string): Promise<ConsolePageMode> {
  const manifest = await readPackageManifest(manifestPath);
  if (hasManifestDependency(manifest, "@croco/meta-vite")) {
    return "ssr";
  }
  if (hasManifestDependency(manifest, "@croco/frontend-vite")) {
    return "spa";
  }
  return "ssr";
}

function createApiSources(apiServerSrc: string, route: RouteParts): GeneratedSource[] {
  const usageDashboardDir = join(apiServerSrc, "usage-dashboard");

  return [
    {
      path: join(usageDashboardDir, "UsageDashboardProblems.ts"),
      content: problemsTemplate(),
    },
    {
      path: join(usageDashboardDir, "UsageDashboardService.ts"),
      content: serviceTemplate(),
    },
    {
      path: join(usageDashboardDir, "UsageDashboardRuntime.ts"),
      content: runtimeTemplate(),
    },
    {
      path: join(usageDashboardDir, "index.ts"),
      content: barrelTemplate(),
    },
    {
      path: join(apiServerSrc, "controllers", "UsageDashboardController.ts"),
      content: controllerTemplate(route),
    },
  ];
}

function resolveApiEntryPath(apiServerSrc: string): string {
  const appPath = join(apiServerSrc, "app.ts");
  if (existsSync(appPath)) {
    const content = readFileSync(appPath, "utf-8");
    if (hasControllerRegistrationTarget(content)) {
      return appPath;
    }
  }

  const indexPath = join(apiServerSrc, "index.ts");
  return existsSync(indexPath) ? indexPath : appPath;
}

function hasControllerRegistrationTarget(content: string): boolean {
  return (
    content.includes("controllers:") ||
    content.includes("createApp(") ||
    content.includes(".addControllers(")
  );
}

function normalizeRoutePath(value: string, label: string): string {
  const trimmed = value.trim();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash =
    withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;

  if (!/^\/[A-Za-z0-9_./:-]+$/.test(withoutTrailingSlash)) {
    throw new InvalidUsageDashboardRoutePathProblem(label, value);
  }

  return withoutTrailingSlash;
}

function splitRoutePath(path: string): RouteParts {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new InvalidUsageDashboardRoutePathProblem("apiPath", path);
  }
  if (segments.length === 1) {
    return {
      controllerPath: `/${segments[0]}`,
      methodPath: "/",
    };
  }

  return {
    controllerPath: `/${segments.slice(0, -1).join("/")}`,
    methodPath: `/${segments[segments.length - 1]}`,
  };
}

function problemsTemplate(): string {
  return `import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ProblemDetails, ProblemOptions } from "@croco/problems-core";

export const USAGE_DASHBOARD_PROBLEM_CODES = {
  tenantRequired: "CROCO_CLI_USAGE_DASHBOARD_001",
  tenantNotFound: "CROCO_CLI_USAGE_DASHBOARD_002",
  meterNotFound: "CROCO_CLI_USAGE_DASHBOARD_003",
  providerUnavailable: "CROCO_CLI_USAGE_DASHBOARD_004",
} as const;

export const USAGE_DASHBOARD_LEGACY_PROBLEM_CODES = {
  tenantRequired: "usage-dashboard/tenant-required",
  tenantNotFound: "usage-dashboard/tenant-not-found",
  meterNotFound: "usage-dashboard/meter-not-found",
  providerUnavailable: "usage-dashboard/provider-unavailable",
} as const;

type UsageDashboardProblemJson = ProblemDetails & {
  readonly legacyCode: string;
};

abstract class UsageDashboardProblem extends Problem {
  abstract readonly code: string;
  abstract readonly category: ProblemCategory;
  abstract readonly legacyCode: string;

  protected constructor(code: string, category: ProblemCategory, detail?: string, options?: ProblemOptions) {
    super(code, category, detail, options);
  }

  toJSON(): UsageDashboardProblemJson {
    return { ...super.toJSON(), legacyCode: this.legacyCode };
  }
}

export class UsageDashboardTenantRequiredProblem extends UsageDashboardProblem {
  readonly code = USAGE_DASHBOARD_PROBLEM_CODES.tenantRequired;
  readonly legacyCode = USAGE_DASHBOARD_LEGACY_PROBLEM_CODES.tenantRequired;
  readonly category = ProblemCategory.ValidationError;

  constructor() {
    super(
      USAGE_DASHBOARD_PROBLEM_CODES.tenantRequired,
      ProblemCategory.ValidationError,
      "Usage dashboard requires x-tenant-id header or tenantId query parameter.",
    );
  }
}

export class UsageDashboardTenantNotFoundProblem extends UsageDashboardProblem {
  readonly code = USAGE_DASHBOARD_PROBLEM_CODES.tenantNotFound;
  readonly legacyCode = USAGE_DASHBOARD_LEGACY_PROBLEM_CODES.tenantNotFound;
  readonly category = ProblemCategory.NotFound;

  constructor(tenantId: string) {
    super(
      USAGE_DASHBOARD_PROBLEM_CODES.tenantNotFound,
      ProblemCategory.NotFound,
      "Usage dashboard tenant not found: " + tenantId + ".",
    );
  }
}

export class UsageDashboardMeterNotFoundProblem extends UsageDashboardProblem {
  readonly code = USAGE_DASHBOARD_PROBLEM_CODES.meterNotFound;
  readonly legacyCode = USAGE_DASHBOARD_LEGACY_PROBLEM_CODES.meterNotFound;
  readonly category = ProblemCategory.NotFound;

  constructor(tenantId: string, meterId: string) {
    super(
      USAGE_DASHBOARD_PROBLEM_CODES.meterNotFound,
      ProblemCategory.NotFound,
      "Usage dashboard meter " + meterId + " not found for tenant " + tenantId + ".",
    );
  }
}

export class UsageDashboardProviderUnavailableProblem extends UsageDashboardProblem {
  readonly code = USAGE_DASHBOARD_PROBLEM_CODES.providerUnavailable;
  readonly legacyCode = USAGE_DASHBOARD_LEGACY_PROBLEM_CODES.providerUnavailable;
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail = "Usage dashboard runtime providers are unavailable.", options?: ProblemOptions) {
    super(
      USAGE_DASHBOARD_PROBLEM_CODES.providerUnavailable,
      ProblemCategory.InternalServerError,
      detail,
      options,
    );
  }
}
`;
}

function serviceTemplate(): string {
  return `import type { BillingService, Subscription } from "@croco/billing-core";
import type { EntitlementCheckResult, EntitlementManager, OveragePolicy } from "@croco/entitlements-core";
import type { MeterDefinition, MeteringService, MeterRegistry } from "@croco/metering-core";
import type { Tenant, TenantStore } from "@croco/tenant-core";
import {
  UsageDashboardMeterNotFoundProblem,
  UsageDashboardProviderUnavailableProblem,
  UsageDashboardTenantNotFoundProblem,
  UsageDashboardTenantRequiredProblem,
} from "./UsageDashboardProblems";

export type UsageDashboardOverageState =
  | "within_quota"
  | "near_quota"
  | "over_quota_blocked"
  | "over_quota_warn"
  | "overage_allowed";

export type UsageDashboardMeterSnapshot = {
  readonly meterId: string;
  readonly featureKey: string | null;
  readonly usage: number;
  readonly quota: number | null;
  readonly remaining: number | null;
  readonly percentUsed: number | null;
  readonly overagePolicy: OveragePolicy | null;
  readonly overageState: UsageDashboardOverageState;
  readonly unit: string | null;
};

export type UsageDashboardFeatureSnapshot = {
  readonly featureKey: string;
  readonly granted: boolean;
  readonly type: EntitlementCheckResult["type"];
  readonly usage: number | null;
  readonly quota: number | null;
  readonly remaining: number | null;
  readonly percentUsed: number | null;
  readonly overagePolicy: OveragePolicy | null;
  readonly overageState: UsageDashboardOverageState | null;
  readonly reason: string | null;
};

export type UsageDashboardSnapshot = {
  readonly tenantId: string;
  readonly planId: string | null;
  readonly planVersionRef: string | null;
  readonly subscriptionStatus: Subscription["status"] | "none";
  readonly currentPeriodEnd: string | null;
  readonly aggregate: {
    readonly usage: number;
    readonly quota: number | null;
    readonly remaining: number | null;
    readonly percentUsed: number | null;
  };
  readonly meters: readonly UsageDashboardMeterSnapshot[];
  readonly features: readonly UsageDashboardFeatureSnapshot[];
  readonly billingDelivery: UsageDashboardBillingDeliverySnapshot | null;
  readonly lastUpdatedAt: string;
};

export type UsageDashboardBillingDeliverySnapshot = {
  readonly localUsage: number;
  readonly providerAcceptedUsage: number;
  readonly usageDrift: number;
  readonly backlogCount: number;
  readonly oldestPendingAgeMs: number | null;
  readonly retryCount: number;
  readonly terminalFailureCount: number;
  readonly recoveryCommand: string;
};

export type UsageDashboardSnapshotOptions = {
  readonly featureKeys?: readonly string[];
  readonly meterIds?: readonly string[];
};

export type UsageDashboardDependencies = {
  readonly tenantStore: Pick<TenantStore, "findById">;
  readonly billingService: Pick<BillingService, "getSubscription">;
  readonly meterRegistry: Pick<MeterRegistry, "getByTenant">;
  readonly meteringService: Pick<MeteringService, "getUsage">;
  readonly entitlementManager: Pick<EntitlementManager, "check">;
  readonly usageBillingReadModel?: {
    getSnapshot(
      tenantId: string,
      meterIds: readonly string[],
    ): Promise<UsageDashboardBillingDeliverySnapshot>;
  };
};

const NEAR_QUOTA_RATIO = 0.8;

export class UsageDashboardService {
  constructor(private readonly dependencies: UsageDashboardDependencies) {}

  async getSnapshot(
    tenantIdInput: string | null | undefined,
    options: UsageDashboardSnapshotOptions = {},
  ): Promise<UsageDashboardSnapshot> {
    const tenantId = normalizeTenantId(tenantIdInput);
    if (!tenantId) {
      throw new UsageDashboardTenantRequiredProblem();
    }

    const tenant = await this.dependencies.tenantStore.findById(tenantId);
    if (!tenant) {
      throw new UsageDashboardTenantNotFoundProblem(tenantId);
    }

    const [subscription, meters] = await Promise.all([
      this.dependencies.billingService.getSubscription(tenantId),
      this.readMeters(tenantId),
    ]);
    const selectedMeters = filterMeters(tenantId, meters, options.meterIds);
    const featureKeys = resolveFeatureKeys(tenant, selectedMeters, options.featureKeys);
    const features = await Promise.all(
      featureKeys.map((featureKey) => this.readFeature(tenantId, featureKey)),
    );
    const featureByKey = new Map(features.map((feature) => [feature.featureKey, feature]));
    const meterSnapshots = await Promise.all(
      selectedMeters.map((meter) => this.readMeter(tenantId, meter, featureByKey)),
    );
    const billingDelivery = this.dependencies.usageBillingReadModel
      ? await this.readBillingDelivery(
          tenantId,
          selectedMeters
            .filter(isRequiredBillingMeter)
            .map((meter) => meter.meterId),
        )
      : null;

    return {
      tenantId,
      planId: subscription?.planId ?? null,
      planVersionRef: readPlanVersionRef(subscription),
      subscriptionStatus: subscription?.status ?? "none",
      currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
      aggregate: aggregateMeters(meterSnapshots),
      meters: meterSnapshots,
      features,
      billingDelivery,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private async readMeters(tenantId: string): Promise<readonly MeterDefinition[]> {
    try {
      return await this.dependencies.meterRegistry.getByTenant(tenantId);
    } catch (error) {
      throw new UsageDashboardProviderUnavailableProblem(formatProviderError("meter registry", error));
    }
  }

  private async readFeature(
    tenantId: string,
    featureKey: string,
  ): Promise<UsageDashboardFeatureSnapshot> {
    try {
      const entitlement = await this.dependencies.entitlementManager.check(tenantId, featureKey);
      const usage = entitlement.usage ?? null;
      const quota = entitlement.quota ?? null;
      const remaining = entitlement.remaining ?? (quota === null || usage === null ? null : Math.max(0, quota - usage));
      const overagePolicy = entitlement.overagePolicy ?? null;

      return {
        featureKey,
        granted: entitlement.granted,
        type: entitlement.type,
        usage,
        quota,
        remaining,
        percentUsed: calculatePercentUsed(usage, quota),
        overagePolicy,
        overageState:
          usage === null || quota === null
            ? null
            : resolveOverageState({ usage, quota, overagePolicy, allowOverQuota: false }),
        reason: entitlement.reason ?? null,
      };
    } catch (error) {
      throw new UsageDashboardProviderUnavailableProblem(formatProviderError("entitlement manager", error));
    }
  }

  private async readMeter(
    tenantId: string,
    meter: MeterDefinition,
    featureByKey: ReadonlyMap<string, UsageDashboardFeatureSnapshot>,
  ): Promise<UsageDashboardMeterSnapshot> {
    const featureKey = readStringMetadata(meter.metadata, "featureKey");
    const feature = featureKey ? featureByKey.get(featureKey) : null;
    const usage = await this.readUsage(tenantId, meter.meterId);
    const quota = feature?.quota ?? meter.quota ?? null;
    const remaining = quota === null ? null : Math.max(0, quota - usage);
    const overagePolicy = feature?.overagePolicy ?? (meter.allowOverQuota ? "ALLOW_WITH_OVERAGE" : "BLOCK");

    return {
      meterId: meter.meterId,
      featureKey,
      usage,
      quota,
      remaining,
      percentUsed: calculatePercentUsed(usage, quota),
      overagePolicy,
      overageState: resolveOverageState({
        usage,
        quota,
        overagePolicy,
        allowOverQuota: meter.allowOverQuota ?? false,
      }),
      unit: readStringMetadata(meter.metadata, "unit"),
    };
  }

  private async readUsage(tenantId: string, meterId: string): Promise<number> {
    try {
      return this.dependencies.meteringService.getUsage({
        tenantId,
        meterId,
        period: "billing_cycle",
      });
    } catch (error) {
      throw new UsageDashboardProviderUnavailableProblem(formatProviderError("metering service", error));
    }
  }

  private async readBillingDelivery(
    tenantId: string,
    meterIds: readonly string[],
  ): Promise<UsageDashboardBillingDeliverySnapshot> {
    const readModel = this.dependencies.usageBillingReadModel;
    if (!readModel) {
      throw new UsageDashboardProviderUnavailableProblem("Usage dashboard billing delivery read model is unavailable.");
    }
    try {
      return await readModel.getSnapshot(tenantId, meterIds);
    } catch (error) {
      throw new UsageDashboardProviderUnavailableProblem(formatProviderError("billing delivery read model", error));
    }
  }
}

export function resolveOverageState(options: {
  readonly usage: number;
  readonly quota: number | null;
  readonly overagePolicy: OveragePolicy | null;
  readonly allowOverQuota: boolean;
}): UsageDashboardOverageState {
  if (options.quota === null || options.quota <= 0) {
    return "within_quota";
  }

  if (options.usage <= options.quota) {
    return options.usage / options.quota >= NEAR_QUOTA_RATIO ? "near_quota" : "within_quota";
  }

  if (options.overagePolicy === "ALLOW_WITH_OVERAGE" || options.allowOverQuota) {
    return "overage_allowed";
  }
  if (options.overagePolicy === "WARN") {
    return "over_quota_warn";
  }

  return "over_quota_blocked";
}

function normalizeTenantId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isRequiredBillingMeter(meter: MeterDefinition): boolean {
  return "billing" in meter && meter.billing === "required";
}

function readPlanVersionRef(subscription: Subscription | null): string | null {
  if (!subscription || !("planVersionRef" in subscription)) {
    return null;
  }
  return typeof subscription.planVersionRef === "string" ? subscription.planVersionRef : null;
}

function filterMeters(
  tenantId: string,
  meters: readonly MeterDefinition[],
  meterIds: readonly string[] | undefined,
): readonly MeterDefinition[] {
  if (!meterIds || meterIds.length === 0) {
    return meters;
  }

  const byId = new Map(meters.map((meter) => [meter.meterId, meter]));
  return meterIds.map((meterId) => {
    const meter = byId.get(meterId);
    if (!meter) {
      throw new UsageDashboardMeterNotFoundProblem(tenantId, meterId);
    }
    return meter;
  });
}

function resolveFeatureKeys(
  tenant: Tenant,
  meters: readonly MeterDefinition[],
  explicitFeatureKeys: readonly string[] | undefined,
): readonly string[] {
  return uniqueStrings([
    ...(explicitFeatureKeys ?? []),
    ...(tenant.settings.features ?? []),
    ...meters.map((meter) => readStringMetadata(meter.metadata, "featureKey")),
  ]);
}

function uniqueStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function calculatePercentUsed(usage: number | null, quota: number | null): number | null {
  if (usage === null || quota === null || quota <= 0) {
    return null;
  }

  return Math.round((usage / quota) * 1000) / 10;
}

function aggregateMeters(meters: readonly UsageDashboardMeterSnapshot[]): UsageDashboardSnapshot["aggregate"] {
  const usage = meters.reduce((total, meter) => total + meter.usage, 0);
  const quotaMeters = meters.filter((meter) => meter.quota !== null);
  const quota =
    quotaMeters.length === 0
      ? null
      : quotaMeters.reduce((total, meter) => total + (meter.quota ?? 0), 0);
  const remaining = quota === null ? null : Math.max(0, quota - usage);

  return {
    usage,
    quota,
    remaining,
    percentUsed: calculatePercentUsed(usage, quota),
  };
}

function formatProviderError(label: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return "Usage dashboard " + label + " is unavailable: " + detail;
}
`;
}

function runtimeTemplate(): string {
  return `import { UsageDashboardProviderUnavailableProblem } from "./UsageDashboardProblems";
import { UsageDashboardService, type UsageDashboardDependencies } from "./UsageDashboardService";

type RuntimeModule = {
  readonly defaultSaasRuntime?: unknown;
};

const SAAS_RUNTIME_MODULE = "../saasDemo";

export async function createUsageDashboardService(): Promise<UsageDashboardService> {
  let module: RuntimeModule;
  try {
    module = (await import(SAAS_RUNTIME_MODULE)) as RuntimeModule;
  } catch (error) {
    throw new UsageDashboardProviderUnavailableProblem(
      "Usage dashboard runtime module at apps/api-server/src/saasDemo.ts failed to load: " +
        formatRuntimeImportError(error) +
        ". Wire billingService, meterRegistry, meteringService, entitlementManager, and tenantStore before exposing this endpoint.",
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  const runtime = module.defaultSaasRuntime;
  if (!isUsageDashboardRuntime(runtime)) {
    throw new UsageDashboardProviderUnavailableProblem(
      "Usage dashboard runtime is missing billingService, meterRegistry, meteringService, entitlementManager, or tenantStore.",
    );
  }

  return new UsageDashboardService(runtime);
}

function isUsageDashboardRuntime(value: unknown): value is UsageDashboardDependencies {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    hasMethod(candidate.tenantStore, "findById") &&
    hasMethod(candidate.billingService, "getSubscription") &&
    hasMethod(candidate.meterRegistry, "getByTenant") &&
    hasMethod(candidate.meteringService, "getUsage") &&
    hasMethod(candidate.entitlementManager, "check")
  );
}

function hasMethod(value: unknown, name: string): boolean {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>)[name] === "function";
}

function formatRuntimeImportError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
`;
}

function controllerTemplate(route: RouteParts): string {
  const contractPath =
    route.methodPath === "/" ? route.controllerPath : `${route.controllerPath}${route.methodPath}`;

  return `import { Component } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import {
  Controller,
  Ctx,
  defineRouteContract,
  defineRouteProblem,
  Get,
  HttpMethod,
  ProblemResponses,
  RequestValidationProblem,
  ResponseSchema,
  routeProblemResponses,
} from "@croco/protocols-rest";
import type { CrocoHttpContext } from "@croco/transports-http";
import { z } from "zod";
import {
  UsageDashboardMeterNotFoundProblem,
  UsageDashboardProviderUnavailableProblem,
  UsageDashboardTenantNotFoundProblem,
  UsageDashboardTenantRequiredProblem,
} from "../usage-dashboard/UsageDashboardProblems";
import type { UsageDashboardSnapshot } from "../usage-dashboard/UsageDashboardService";

const usageDashboardOveragePolicySchema = z.enum(["BLOCK", "WARN", "ALLOW_WITH_OVERAGE"]);
const usageDashboardOverageStateSchema = z.enum([
  "within_quota",
  "near_quota",
  "over_quota_blocked",
  "over_quota_warn",
  "overage_allowed",
]);

const usageDashboardMeterSnapshotSchema = z.object({
  meterId: z.string(),
  featureKey: z.string().nullable(),
  usage: z.number(),
  quota: z.number().nullable(),
  remaining: z.number().nullable(),
  percentUsed: z.number().nullable(),
  overagePolicy: usageDashboardOveragePolicySchema.nullable(),
  overageState: usageDashboardOverageStateSchema,
  unit: z.string().nullable(),
});

const usageDashboardFeatureSnapshotSchema = z.object({
  featureKey: z.string(),
  granted: z.boolean(),
  type: z.enum(["boolean", "metered", "static"]),
  usage: z.number().nullable(),
  quota: z.number().nullable(),
  remaining: z.number().nullable(),
  percentUsed: z.number().nullable(),
  overagePolicy: usageDashboardOveragePolicySchema.nullable(),
  overageState: usageDashboardOverageStateSchema.nullable(),
  reason: z.string().nullable(),
});

const usageDashboardSnapshotSchema = z.object({
  tenantId: z.string(),
  planId: z.string().nullable(),
  planVersionRef: z.string().nullable(),
  subscriptionStatus: z.string(),
  currentPeriodEnd: z.string().nullable(),
  aggregate: z.object({
    usage: z.number(),
    quota: z.number().nullable(),
    remaining: z.number().nullable(),
    percentUsed: z.number().nullable(),
  }),
  meters: z.array(usageDashboardMeterSnapshotSchema),
  features: z.array(usageDashboardFeatureSnapshotSchema),
  billingDelivery: z.object({
    localUsage: z.number(),
    providerAcceptedUsage: z.number(),
    usageDrift: z.number(),
    backlogCount: z.number(),
    oldestPendingAgeMs: z.number().nullable(),
    retryCount: z.number(),
    terminalFailureCount: z.number(),
    recoveryCommand: z.string(),
  }).nullable(),
  lastUpdatedAt: z.string(),
});

const usageDashboardTenantRequiredProblem = defineRouteProblem(UsageDashboardTenantRequiredProblem, {
  code: "CROCO_CLI_USAGE_DASHBOARD_001",
  category: ProblemCategory.ValidationError,
  description: "Usage dashboard requires tenant context.",
});
const usageDashboardTenantNotFoundProblem = defineRouteProblem(UsageDashboardTenantNotFoundProblem, {
  code: "CROCO_CLI_USAGE_DASHBOARD_002",
  category: ProblemCategory.NotFound,
  description: "The requested tenant does not exist.",
});
const usageDashboardMeterNotFoundProblem = defineRouteProblem(UsageDashboardMeterNotFoundProblem, {
  code: "CROCO_CLI_USAGE_DASHBOARD_003",
  category: ProblemCategory.NotFound,
  description: "A requested meter does not exist.",
});
const usageDashboardProviderUnavailableProblem = defineRouteProblem(UsageDashboardProviderUnavailableProblem, {
  code: "CROCO_CLI_USAGE_DASHBOARD_004",
  category: ProblemCategory.InternalServerError,
  description: "Usage dashboard dependencies are unavailable.",
});

const usageDashboardSnapshotRoute = defineRouteContract({
  id: "usage-dashboard.snapshot",
  method: HttpMethod.GET,
  path: "${contractPath}",
  operationId: "getUsageDashboardSnapshot",
  response: usageDashboardSnapshotSchema,
  problems: [
    usageDashboardTenantRequiredProblem,
    usageDashboardTenantNotFoundProblem,
    usageDashboardMeterNotFoundProblem,
    usageDashboardProviderUnavailableProblem,
  ],
});

@Component()
@Controller("${route.controllerPath}")
export class UsageDashboardController {
  @Get(usageDashboardSnapshotRoute)
  @ProblemResponses(...routeProblemResponses(usageDashboardSnapshotRoute))
  @ResponseSchema(usageDashboardSnapshotSchema)
  async snapshot(@Ctx() ctx: CrocoHttpContext): Promise<UsageDashboardSnapshot> {
    const { createUsageDashboardService } = await import("../usage-dashboard/UsageDashboardRuntime");
    const service = await createUsageDashboardService();

    return service.getSnapshot(readTenantId(ctx), {
      featureKeys: readRepeatedQuery(ctx, "feature"),
      meterIds: readRepeatedQuery(ctx, "meter"),
    });
  }
}

function readTenantId(ctx: CrocoHttpContext): string | undefined {
  const tenantId = ctx.header("x-tenant-id");
  if (tenantId !== undefined) {
    return tenantId;
  }

  const queryTenantId = ctx.query("tenantId");
  if (Array.isArray(queryTenantId)) {
    throw new RequestValidationProblem("query", [
      { path: "tenantId", message: "Expected a single query value" },
    ]);
  }

  return queryTenantId;
}

function readRepeatedQuery(ctx: CrocoHttpContext, name: string): readonly string[] | undefined {
  const value = ctx.query(name);
  if (!value) {
    return undefined;
  }

  const values = (Array.isArray(value) ? value : [value])
    .flatMap((item) => item.split(","))
    .map((part) => part.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}
`;
}

function barrelTemplate(): string {
  return `export {
  UsageDashboardMeterNotFoundProblem,
  UsageDashboardProviderUnavailableProblem,
  UsageDashboardTenantNotFoundProblem,
  UsageDashboardTenantRequiredProblem,
} from "./UsageDashboardProblems";
export { createUsageDashboardService } from "./UsageDashboardRuntime";
export {
  UsageDashboardService,
  resolveOverageState,
  type UsageDashboardBillingDeliverySnapshot,
  type UsageDashboardDependencies,
  type UsageDashboardFeatureSnapshot,
  type UsageDashboardMeterSnapshot,
  type UsageDashboardOverageState,
  type UsageDashboardSnapshot,
  type UsageDashboardSnapshotOptions,
} from "./UsageDashboardService";
`;
}

function pageTemplate(apiPath: string): string {
  return `import { useEffect, useMemo, useState } from 'react';

type OverageState =
  | 'within_quota'
  | 'near_quota'
  | 'over_quota_blocked'
  | 'over_quota_warn'
  | 'overage_allowed';

type MeterRow = {
  readonly meterId: string;
  readonly featureKey: string | null;
  readonly usage: number;
  readonly quota: number | null;
  readonly remaining: number | null;
  readonly percentUsed: number | null;
  readonly overagePolicy: string | null;
  readonly overageState: OverageState;
  readonly unit: string | null;
};

type UsageDashboardSnapshot = {
  readonly tenantId: string;
  readonly planId: string | null;
  readonly planVersionRef: string | null;
  readonly subscriptionStatus: string;
  readonly currentPeriodEnd: string | null;
  readonly aggregate: {
    readonly usage: number;
    readonly quota: number | null;
    readonly remaining: number | null;
    readonly percentUsed: number | null;
  };
  readonly meters: readonly MeterRow[];
  readonly billingDelivery: {
    readonly localUsage: number;
    readonly providerAcceptedUsage: number;
    readonly usageDrift: number;
    readonly backlogCount: number;
    readonly oldestPendingAgeMs: number | null;
    readonly retryCount: number;
    readonly terminalFailureCount: number;
    readonly recoveryCommand: string;
  } | null;
  readonly lastUpdatedAt: string;
};

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly snapshot: UsageDashboardSnapshot };

const API_PATH = '${apiPath}';

export default function UsageDashboardPage() {
  const tenantId = useMemo(readTenantId, []);
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    if (!tenantId) {
      setState({ status: 'empty' });
      return;
    }

    const controller = new AbortController();
    const url = new URL(API_PATH, window.location.origin);
    url.searchParams.set('tenantId', tenantId);

    fetch(url, {
      headers: { 'x-tenant-id': tenantId },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return {
            status: 'error',
            message: 'CROCO_USAGE_DASHBOARD_REQUEST_FAILED: HTTP ' + response.status,
          } satisfies ViewState;
        }

        return {
          status: 'ready',
          snapshot: (await response.json()) as UsageDashboardSnapshot,
        } satisfies ViewState;
      })
      .then(setState)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });

    return () => controller.abort();
  }, [tenantId]);

  if (state.status === 'loading') {
    return <main><h1>Usage</h1><p>Loading usage...</p></main>;
  }

  if (state.status === 'empty') {
    return <main><h1>Usage</h1><p>Select a tenant with ?tenantId=... or x-tenant-id.</p></main>;
  }

  if (state.status === 'error') {
    return <main><h1>Usage</h1><p>{state.message}</p></main>;
  }

  const snapshot = state.snapshot;
  const overQuotaMeters = snapshot.meters.filter((meter) => isOverQuotaState(meter.overageState));

  return (
    <main>
      <h1>Usage</h1>
      {overQuotaMeters.length > 0 ? <p>{overQuotaMeters.length} meter needs quota attention.</p> : null}
      <section>
        <h2>Plan</h2>
        <dl>
          <dt>Tenant</dt>
          <dd>{snapshot.tenantId}</dd>
          <dt>Plan</dt>
          <dd>{snapshot.planId ?? 'none'}</dd>
          <dt>Plan version</dt>
          <dd>{snapshot.planVersionRef ?? 'none'}</dd>
          <dt>Status</dt>
          <dd>{snapshot.subscriptionStatus}</dd>
          <dt>Next billing cycle</dt>
          <dd>{formatDate(snapshot.currentPeriodEnd)}</dd>
        </dl>
      </section>
      {snapshot.billingDelivery ? (
        <section>
          <h2>Billing delivery</h2>
          <p>
            {formatNumber(snapshot.billingDelivery.providerAcceptedUsage)} provider accepted /{' '}
            {formatNumber(snapshot.billingDelivery.localUsage)} local usage
          </p>
          <p>
            Drift: {formatNumber(snapshot.billingDelivery.usageDrift)}; pending:{' '}
            {snapshot.billingDelivery.backlogCount}
          </p>
          <p>
            Retries: {formatNumber(snapshot.billingDelivery.retryCount)}; terminal failures:{' '}
            {formatNumber(snapshot.billingDelivery.terminalFailureCount)}
          </p>
          {snapshot.billingDelivery.oldestPendingAgeMs !== null ? (
            <p>Oldest pending: {formatNumber(snapshot.billingDelivery.oldestPendingAgeMs)} ms</p>
          ) : null}
          {snapshot.billingDelivery.backlogCount > 0 ? (
            <code>{snapshot.billingDelivery.recoveryCommand}</code>
          ) : null}
        </section>
      ) : null}
      <section>
        <h2>Aggregate usage</h2>
        <p>{formatNumber(snapshot.aggregate.usage)} used / {formatNullableNumber(snapshot.aggregate.quota)} quota</p>
        <progress value={snapshot.aggregate.percentUsed ?? 0} max={100} />
      </section>
      <section>
        <h2>Meters</h2>
        <table>
          <thead>
            <tr>
              <th>Meter</th>
              <th>Feature</th>
              <th>Usage</th>
              <th>Quota</th>
              <th>Remaining</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.meters.map((meter) => (
              <tr key={meter.meterId}>
                <td>{meter.meterId}</td>
                <td>{meter.featureKey ?? 'none'}</td>
                <td>{formatNumber(meter.usage)} {meter.unit ?? ''}</td>
                <td>{formatNullableNumber(meter.quota)}</td>
                <td>{formatNullableNumber(meter.remaining)}</td>
                <td>{meter.overageState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function readTenantId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get('tenantId')?.trim();
  return tenantId ? tenantId : null;
}

function isOverQuotaState(state: OverageState): boolean {
  return state === 'over_quota_blocked' || state === 'over_quota_warn' || state === 'overage_allowed';
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'none';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'none' : formatNumber(value);
}
`;
}

function pageRouteTemplate(options: {
  readonly pagePath: string;
  readonly mode: ConsolePageMode;
}): string {
  if (options.mode === "spa") {
    return `import Page from './Page';

export const routeConfig = {
  path: '${options.pagePath}',
  Component: Page,
};
`;
  }

  return `import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';
import Page from './Page';

const route = {
  path: '${options.pagePath}',
  mode: 'ssr',
  component: Page,
} satisfies PageRouteDefinition;

export default defineRoute(route);
`;
}

function logGenerateUsageDashboardResult(result: RunGenerateUsageDashboardResult | null): void {
  if (!result) return;

  for (const file of result.api.files) {
    logWriteResult(file);
  }
  logRegistrationResult(result.api.registration);

  for (const file of result.page?.files ?? []) {
    logWriteResult(file);
  }
}

function logWriteResult(result: WriteResult): void {
  if (result.status === "created") {
    console.log(`Created: ${result.path}`);
  } else if (result.status === "overwritten") {
    console.log(`Overwritten: ${result.path}`);
  } else if (result.status === "skipped-dry-run") {
    console.log(`[Dry run] Would create: ${result.path}`);
    if (result.diff) {
      console.log(result.diff);
    }
  } else if (result.status === "exists-no-overwrite") {
    console.log(`Skipped (exists): ${result.path}`);
  }
}

function logRegistrationResult(result: RegisterControllerResult): void {
  if (result.status === "unsupported-pattern") {
    console.log(`Skipped controller registration: ${result.hint}`);
    return;
  }

  console.log(`Registered controller: ${result.className}`);
}

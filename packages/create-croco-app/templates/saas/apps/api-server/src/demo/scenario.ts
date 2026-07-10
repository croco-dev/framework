import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";
import { seedDefaultSaasRuntime } from "../saasDemo";
import { assertSaasSmokeContract, type SaasDemoSnapshot } from "./saasSmokeContract";

const API_REQUESTS_METER_ID = "api_requests";
const API_REQUESTS_FEATURE_KEY = "api.requests";
const STORAGE_GB_METER_ID = "storage_gb";
const STORAGE_GB_FEATURE_KEY = "storage.gb";
const NORMALIZED_CURRENT_PERIOD_END = "<normalized-current-period-end>";
const NORMALIZED_LAST_UPDATED_AT = "<normalized-last-updated-at>";

const dashboardOverageStateSchema = z.enum([
  "within_quota",
  "near_quota",
  "over_quota_blocked",
  "over_quota_warn",
  "overage_allowed",
]);
const dashboardMeterSchema = z.object({
  meterId: z.string(),
  featureKey: z.string().nullable(),
  usage: z.number(),
  quota: z.number().nullable(),
  remaining: z.number().nullable(),
  percentUsed: z.number().nullable(),
  overagePolicy: z.string().nullable(),
  overageState: dashboardOverageStateSchema,
  unit: z.string().nullable(),
});
const dashboardFeatureSchema = z.object({
  featureKey: z.string(),
  granted: z.boolean(),
  type: z.string().optional(),
  usage: z.number().nullable(),
  quota: z.number().nullable(),
  remaining: z.number().nullable(),
  percentUsed: z.number().nullable(),
  overagePolicy: z.string().nullable(),
  overageState: dashboardOverageStateSchema.nullable(),
  reason: z.string().nullable(),
});
const dashboardSnapshotSchema = z.object({
  tenantId: z.string(),
  planId: z.string().nullable(),
  subscriptionStatus: z.string(),
  currentPeriodEnd: z.string().nullable(),
  aggregate: z.object({
    usage: z.number(),
    quota: z.number().nullable(),
    remaining: z.number().nullable(),
    percentUsed: z.number().nullable(),
  }),
  meters: z.array(dashboardMeterSchema),
  features: z.array(dashboardFeatureSchema),
  lastUpdatedAt: z.string(),
});

type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;
type DashboardMeter = z.infer<typeof dashboardMeterSchema>;
type DashboardFeature = z.infer<typeof dashboardFeatureSchema>;
type UsageDashboardServiceShape = {
  getSnapshot(
    tenantId: string,
    options: {
      readonly meterIds: readonly string[];
      readonly featureKeys: readonly string[];
    },
  ): Promise<unknown>;
};
type SaasScenarioReport = {
  readonly schemaVersion: "croco.saas-golden-path.scenario/v1";
  readonly generatedAt: "deterministic";
  readonly tenantId: string;
  readonly billingSubscriptionStatus: string;
  readonly dashboardTenantId: string;
  readonly dashboardPlanId: string | null;
  readonly aiQuotaFailureCode: string;
  readonly operationsHealthStatus: string;
  readonly jobsStatus: string;
  readonly lifecycleDuplicateRunStatus: string;
  readonly seed: {
    readonly tenant: SaasDemoSnapshot["tenant"];
    readonly auth: SaasDemoSnapshot["auth"];
    readonly invitation: SaasDemoSnapshot["invitation"];
    readonly membership: {
      readonly memberCount: number;
      readonly ownerRole: string;
      readonly memberRole: string;
      readonly seatLimitFailureCode: string;
    };
    readonly billing: SaasDemoSnapshot["billing"];
    readonly metering: SaasDemoSnapshot["metering"];
    readonly ai: SaasDemoSnapshot["ai"];
    readonly operations: SaasDemoSnapshot["operations"];
    readonly jobs: SaasDemoSnapshot["jobs"];
    readonly lifecycle: SaasDemoSnapshot["lifecycle"];
    readonly failureDrills: readonly {
      readonly name: string;
      readonly problemCode: string;
    }[];
  };
  readonly dashboard: {
    readonly tenantId: string;
    readonly planId: string | null;
    readonly subscriptionStatus: string;
    readonly currentPeriodEnd: typeof NORMALIZED_CURRENT_PERIOD_END;
    readonly lastUpdatedAt: typeof NORMALIZED_LAST_UPDATED_AT;
    readonly aggregate: DashboardSnapshot["aggregate"];
    readonly meters: readonly Pick<
      DashboardMeter,
      "meterId" | "featureKey" | "usage" | "quota" | "remaining" | "overageState" | "unit"
    >[];
    readonly features: readonly Pick<
      DashboardFeature,
      "featureKey" | "granted" | "usage" | "quota" | "remaining" | "overageState"
    >[];
  };
};

export async function runSaasGoldenPathScenario(): Promise<SaasScenarioReport> {
  const seed = await seedDefaultSaasRuntime();
  assertSaasSmokeContract(seed);

  const dashboardService = await loadUsageDashboardService();
  const dashboard = parseDashboardSnapshot(
    await dashboardService.getSnapshot(seed.tenant.id, {
      meterIds: [API_REQUESTS_METER_ID, STORAGE_GB_METER_ID],
      featureKeys: [API_REQUESTS_FEATURE_KEY, STORAGE_GB_FEATURE_KEY],
    }),
  );

  assertScenarioState(seed, dashboard);
  const report = createScenarioReport(seed, dashboard);
  await writeScenarioArtifacts(report);

  return report;
}

async function loadUsageDashboardService(): Promise<UsageDashboardServiceShape> {
  const runtimeModulePath = ["..", "usage-dashboard", "UsageDashboardRuntime"].join("/");
  const runtimeModule = (await import(runtimeModulePath)) as Record<string, unknown>;
  const createUsageDashboardService = runtimeModule.createUsageDashboardService;

  if (typeof createUsageDashboardService !== "function") {
    throw new Error("Generated usage dashboard runtime is missing createUsageDashboardService().");
  }

  const service = (await createUsageDashboardService()) as unknown;
  if (!hasMethod(service, "getSnapshot")) {
    throw new Error("Generated usage dashboard service is missing getSnapshot().");
  }

  return service as UsageDashboardServiceShape;
}

function parseDashboardSnapshot(value: unknown): DashboardSnapshot {
  const result = dashboardSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Generated usage dashboard snapshot shape mismatch: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return result.data;
}

function assertScenarioState(seed: SaasDemoSnapshot, dashboard: DashboardSnapshot): void {
  assertEquals("tenant id", seed.tenant.id, "tenant_acme");
  assertEquals("auth user id", seed.auth.userId, "user_member");
  assertEquals("auth session id", seed.auth.sessionId, "session_demo_member");
  assertEquals("billing status", seed.billing.subscriptionStatus, "active");
  assertEquals(
    "billing duplicate event failure code",
    seed.billing.mockEvent.duplicateFailureCode,
    "billing/webhook-already-processed",
  );
  assertEquals("dashboard tenant", dashboard.tenantId, seed.tenant.id);
  assertEquals("dashboard plan", dashboard.planId, "team");
  assertEquals("dashboard subscription", dashboard.subscriptionStatus, "active");
  assertEquals("AI provider", seed.ai.provider, "in-memory");
  assertEquals("AI quota failure code", seed.ai.quotaFailureCode, "llm-metering/quota-exceeded");
  assertEquals("operations health", seed.operations.healthStatus, "up");
  assertEquals("operations diagnostics", seed.operations.diagnosticsSummary, "all_healthy");
  assertEquals("billing sync job status", seed.jobs.status, "completed");
  assertEquals("billing sync job failure policy", seed.jobs.failurePolicyState, "succeeded");
  assertEquals("lifecycle first run", seed.lifecycle.firstRunStatus, "succeeded");
  assertEquals("lifecycle duplicate run", seed.lifecycle.duplicateRunStatus, "skipped");
  assertEquals(
    "lifecycle duplicate reason",
    seed.lifecycle.duplicateSkipReason,
    "idempotency_key_reused",
  );
  assertEquals("lifecycle action type", seed.lifecycle.emittedActionType, "cs.follow_up");
  assertEquals("lifecycle action count", seed.lifecycle.emittedActionCount, 1);

  const apiRequestsMeter = requireMeter(dashboard, API_REQUESTS_METER_ID);
  assertEquals("api_requests usage", apiRequestsMeter.usage, 3);
  assertEquals("api_requests quota", apiRequestsMeter.quota, 100);
  assertEquals("api_requests state", apiRequestsMeter.overageState, "within_quota");

  const storageMeter = requireMeter(dashboard, STORAGE_GB_METER_ID);
  assertEquals("storage_gb usage", storageMeter.usage, 105);
  assertEquals("storage_gb quota", storageMeter.quota, 100);

  const storageFeature = requireFeature(dashboard, STORAGE_GB_FEATURE_KEY);
  assertEquals("storage.gb usage", storageFeature.usage, 105);
  assertEquals("storage.gb quota", storageFeature.quota, 100);
  assertEquals("storage.gb state", storageFeature.overageState, "over_quota_warn");
}

function createScenarioReport(
  seed: SaasDemoSnapshot,
  dashboard: DashboardSnapshot,
): SaasScenarioReport {
  return {
    schemaVersion: "croco.saas-golden-path.scenario/v1",
    generatedAt: "deterministic",
    tenantId: seed.tenant.id,
    billingSubscriptionStatus: seed.billing.subscriptionStatus,
    dashboardTenantId: dashboard.tenantId,
    dashboardPlanId: dashboard.planId,
    aiQuotaFailureCode: seed.ai.quotaFailureCode,
    operationsHealthStatus: seed.operations.healthStatus,
    jobsStatus: seed.jobs.status,
    lifecycleDuplicateRunStatus: seed.lifecycle.duplicateRunStatus,
    seed: {
      tenant: seed.tenant,
      auth: seed.auth,
      invitation: seed.invitation,
      membership: {
        memberCount: seed.membership.memberCount,
        ownerRole: seed.membership.ownerRole,
        memberRole: seed.membership.memberRole,
        seatLimitFailureCode: seed.membership.seatLimit.failureCode,
      },
      billing: seed.billing,
      metering: seed.metering,
      ai: seed.ai,
      operations: seed.operations,
      jobs: seed.jobs,
      lifecycle: seed.lifecycle,
      failureDrills: [
        {
          name: "billing.mock.duplicate_event",
          problemCode: seed.billing.mockEvent.duplicateFailureCode,
        },
        {
          name: "membership.seat_limit",
          problemCode: seed.membership.seatLimit.failureCode,
        },
        {
          name: "llm.prompt_tokens.quota",
          problemCode: seed.ai.quotaFailureCode,
        },
      ],
    },
    dashboard: {
      tenantId: dashboard.tenantId,
      planId: dashboard.planId,
      subscriptionStatus: dashboard.subscriptionStatus,
      currentPeriodEnd: NORMALIZED_CURRENT_PERIOD_END,
      lastUpdatedAt: NORMALIZED_LAST_UPDATED_AT,
      aggregate: dashboard.aggregate,
      meters: dashboard.meters.map((meter) => ({
        meterId: meter.meterId,
        featureKey: meter.featureKey,
        usage: meter.usage,
        quota: meter.quota,
        remaining: meter.remaining,
        overageState: meter.overageState,
        unit: meter.unit,
      })),
      features: dashboard.features
        .filter((feature) =>
          [API_REQUESTS_FEATURE_KEY, STORAGE_GB_FEATURE_KEY].includes(feature.featureKey),
        )
        .map((feature) => ({
          featureKey: feature.featureKey,
          granted: feature.granted,
          usage: feature.usage,
          quota: feature.quota,
          remaining: feature.remaining,
          overageState: feature.overageState,
        })),
    },
  };
}

async function writeScenarioArtifacts(report: SaasScenarioReport): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const outputDir = join(projectRoot, "ci-reports", "saas-golden-path");
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "scenario.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(outputDir, "scenario.md"), renderScenarioMarkdown(report));
}

function renderScenarioMarkdown(report: SaasScenarioReport): string {
  return `${[
    "# SaaS golden path scenario",
    "",
    `- Schema: ${report.schemaVersion}`,
    `- Tenant: ${report.tenantId}`,
    `- Billing subscription: ${report.billingSubscriptionStatus}`,
    `- Dashboard plan: ${report.dashboardPlanId ?? "none"}`,
    "",
    "| Evidence | Value |",
    "| --- | --- |",
    `| Auth session | ${report.seed.auth.sessionId} |`,
    `| Invitation | ${report.seed.invitation.status} for ${report.seed.invitation.invitedUserId} |`,
    `| Members | ${report.seed.membership.memberCount} |`,
    `| Billing event | ${report.seed.billing.mockEvent.processedStatus} (${report.seed.billing.mockEvent.duplicateFailureCode}) |`,
    `| API usage | ${readReportMeter(report, API_REQUESTS_METER_ID).usage}/${readReportMeter(report, API_REQUESTS_METER_ID).quota} |`,
    `| Storage usage | ${readReportMeter(report, STORAGE_GB_METER_ID).usage}/${readReportMeter(report, STORAGE_GB_METER_ID).quota} |`,
    `| Storage feature state | ${readReportFeature(report, STORAGE_GB_FEATURE_KEY).overageState ?? "none"} |`,
    `| AI usage | ${report.seed.ai.totalTokens} tokens (${report.seed.ai.quotaFailureCode}) |`,
    `| Operations | ${report.seed.operations.healthStatus}/${report.seed.operations.diagnosticsSummary} |`,
    `| Billing sync job | ${report.seed.jobs.status} (${report.seed.jobs.failurePolicyState}) |`,
    `| Lifecycle | ${report.seed.lifecycle.firstRunStatus}, duplicate ${report.seed.lifecycle.duplicateRunStatus} (${report.seed.lifecycle.emittedActionType}) |`,
    "",
  ].join("\n")}\n`;
}

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (basename(cwd) === "api-server" && basename(dirname(cwd)) === "apps") {
    return resolve(cwd, "../..");
  }

  return cwd;
}

function requireMeter(dashboard: DashboardSnapshot, meterId: string): DashboardMeter {
  const meter = dashboard.meters.find((candidate) => candidate.meterId === meterId);
  if (!meter) {
    throw new Error(`Generated usage dashboard did not return meter ${meterId}.`);
  }

  return meter;
}

function requireFeature(dashboard: DashboardSnapshot, featureKey: string): DashboardFeature {
  const feature = dashboard.features.find((candidate) => candidate.featureKey === featureKey);
  if (!feature) {
    throw new Error(`Generated usage dashboard did not return feature ${featureKey}.`);
  }

  return feature;
}

function readReportMeter(
  report: SaasScenarioReport,
  meterId: string,
): SaasScenarioReport["dashboard"]["meters"][number] {
  const meter = report.dashboard.meters.find((candidate) => candidate.meterId === meterId);
  if (!meter) {
    throw new Error(`Scenario report did not include meter ${meterId}.`);
  }

  return meter;
}

function readReportFeature(
  report: SaasScenarioReport,
  featureKey: string,
): SaasScenarioReport["dashboard"]["features"][number] {
  const feature = report.dashboard.features.find(
    (candidate) => candidate.featureKey === featureKey,
  );
  if (!feature) {
    throw new Error(`Scenario report did not include feature ${featureKey}.`);
  }

  return feature;
}

function assertEquals<T>(label: string, actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(
      `Scenario ${label} expected ${String(expected)} but received ${String(actual)}.`,
    );
  }
}

function hasMethod(value: unknown, methodName: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)[methodName] === "function"
  );
}

void runSaasGoldenPathScenario().then((report) => {
  console.log(`SaaS golden path scenario wrote ci-reports/saas-golden-path for ${report.tenantId}`);
});

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { AccessEngine } from "@croco/access-core";
import { RbacEngine, RoleRegistry } from "@croco/auth-core";
import type { AuthUser } from "@croco/auth-core";
import {
  BillingCheckoutCreationProblem,
  BillingService,
  hashCheckoutValue,
  InMemoryBillingStore,
  planVersionRef,
  WebhookAlreadyProcessedProblem,
} from "@croco/billing-core";
import type {
  BillingGateway,
  BillingLifecycleGatewayOptions,
  CheckoutResult,
  CreateCheckoutParams,
  PlanVersionRef,
  SubscriptionStatus,
} from "@croco/billing-core";
import { PolarUsageDeliveryWorker } from "@croco/billing-polar";
import { DiagnosticsCollector } from "@croco/diagnostics-core";
import {
  EntitlementManager,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  InMemoryPlanEntitlementRegistry,
  SubscriptionProvider,
  type EntitlementQuotaStatus,
  type UsageHistoryEntry,
  type UsageHistoryPeriod,
} from "@croco/entitlements-core";
import {
  createExecutionJobsOperations,
  ExecutionManagerImpl,
  type JobDetails,
  type JobsOperations,
} from "@croco/execution-core";
import {
  EventBusConfig,
  EventBusStats,
  EventPublisher,
  type DomainEvent,
} from "@croco/events-core";
import { HealthCheckService } from "@croco/health-core";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import type { IdempotencyStore } from "@croco/idempotency-core";
import { InMemoryInvitationStore, InvitationManager } from "@croco/invitation-core";
import { InMemoryLlmModel, InMemoryLlmRegistry, LlmService } from "@croco/llm-core";
import {
  COST_USD_NANOS,
  LlmMeteringService,
  LlmQuotaExceededProblem,
  PricingTable,
} from "@croco/llm-metering";
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleRunStore,
  LifecycleDiagnosticsProvider,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  createHealthStatusChangedSignal,
  createLifecycleContext,
} from "@croco/lifecycle-core";
import {
  InMemoryMembershipStore,
  MembershipManager,
  SeatLimitChecker,
  SeatLimitExceededProblem,
  type MembershipStore,
} from "@croco/membership-core";
import { IdempotencyManager, MeteringService, MeterRegistry } from "@croco/metering-core";
import { NotificationService } from "@croco/notifications-core";
import { TenantManager } from "@croco/tenant-core";
import { TxManager } from "@croco/tx-core";
import { z } from "zod";
import {
  assertSaasSmokeContract,
  SAAS_SMOKE_CONTRACT_VERSION,
  type SaasDemoSnapshot,
} from "./demo/saasSmokeContract";
import { FileBillableUsageJournal } from "./demo/FileBillableUsageJournal";
import { FileUsageBillingGateway } from "./demo/FileUsageBillingGateway";
import { SaasBillableUsageProblem } from "./problems";
import {
  InMemoryAccessProvider,
  InMemoryEventBus,
  InMemoryExecutionStore,
  InMemoryMeterRepository,
  InMemoryRedisClient,
  InMemoryTenantStore,
  InMemoryUsageStorage,
  NoopTxAdapter,
} from "./inMemoryAdapters";
import { getSaasProviderProfile, type SaasProviderProfile } from "./providerProfiles";

const TEAM_PLAN_ID = "team";
const TEAM_PLAN_VERSION_REF = planVersionRef(`${TEAM_PLAN_ID}@v1`);
const SEATS_FEATURE_KEY = "seats";
const API_REQUESTS_METER_ID = "api_requests";
const API_REQUESTS_FEATURE_KEY = "api.requests";
const LIFECYCLE_RISK_RULE_ID = "saas-risk-onboarding-follow-up";
const LIFECYCLE_RISK_ACTION_ID = "create-cs-follow-up";
const STORAGE_GB_METER_ID = "storage_gb";
const STORAGE_GB_FEATURE_KEY = "storage.gb";
const DEMO_LLM_PROVIDER = "in-memory";
const DEMO_LLM_MODEL_ID = "demo-assistant";
const DEMO_LLM_PROMPT = "Summarize tenant usage";
const DEMO_LLM_INPUT_PRICE_PER_TOKEN = 0.000001;
const DEMO_LLM_OUTPUT_PRICE_PER_TOKEN = 0.000002;
const DEMO_LLM_PROMPT_TOKENS_QUOTA = 50;
const DEMO_MEMBER_SESSION_ID = "session_demo_member";
const DEMO_SUBSCRIPTION_CURRENT_PERIOD_END = new Date("2030-01-01T00:00:00.000Z");
const DEMO_BILLING_LAST_SYNCED_AT = new Date("2026-01-01T00:00:00.000Z");
const PROMPT_TOKENS = "llm.prompt_tokens";
const COMPLETION_TOKENS = "llm.completion_tokens";
const DEMO_LLM_COST_QUOTA_USD_NANOS = 1_000_000_000;
const ACTIVE_ENTITLEMENT_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
]);
const BILLABLE_USAGE_CREATED_AT = new Date("2026-01-02T00:00:00.000Z");
const BILLABLE_USAGE_OUTAGE_AT = new Date("2026-01-02T00:00:01.000Z");
const BILLABLE_USAGE_RECOVERY_AT = new Date("2026-01-02T00:00:02.000Z");
const BILLABLE_USAGE_OVERAGE_AT = new Date("2026-01-02T00:00:03.000Z");
const INCLUDED_API_USAGE_EVENT_ID = "usage:tenant_acme:api_requests:included:v1";
const OVERAGE_API_USAGE_EVENT_ID = "usage:tenant_acme:api_requests:overage:v1";
const BILLABLE_USAGE_RECOVERY_COMMAND = "pnpm --dir apps/api-server demo:usage-recover";
const BILLABLE_USAGE_STATE_DIR = resolve(
  process.env.CROCO_DEMO_USAGE_STATE_DIR ?? "../../.croco/demo/saas-billable-usage",
);
const BILLABLE_USAGE_JOURNAL_PATH = resolve(BILLABLE_USAGE_STATE_DIR, "journal.sqlite");
const BILLABLE_USAGE_PROVIDER_PATH = resolve(BILLABLE_USAGE_STATE_DIR, "provider.sqlite");
const execFileAsync = promisify(execFile);
const recoveryDeliverySchema = z.object({
  accepted: z.number().int().nonnegative(),
  retryableFailed: z.number().int().nonnegative(),
  terminalFailed: z.number().int().nonnegative(),
});
type RecoveryDeliveryResult = Required<z.infer<typeof recoveryDeliverySchema>>;

export class DemoBillingGateway implements BillingGateway {
  private createdCheckoutCount = 0;
  private readonly checkouts = new Map<
    string,
    { readonly fingerprint: string; readonly result: CheckoutResult }
  >();

  get checkoutCreationCount(): number {
    return this.createdCheckoutCount;
  }

  async ensureCustomer(billingAccountId: string): Promise<string> {
    return `customer_${billingAccountId}`;
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const fingerprint = this.checkoutFingerprint(params);
    const existing = this.checkouts.get(params.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new BillingCheckoutCreationProblem(
          params.billingAccountId,
          "Demo checkout idempotency key was reused for different checkout input",
        );
      }
      return existing.result;
    }

    const checkoutId = `checkout_${hashCheckoutValue(params.idempotencyKey).slice(0, 16)}`;
    const result = {
      checkoutUrl: `https://billing.example.test/checkout/${checkoutId}`,
      checkoutId,
    };
    this.checkouts.set(params.idempotencyKey, { fingerprint, result });
    this.createdCheckoutCount += 1;
    return result;
  }

  async reconcileCheckout(params: CreateCheckoutParams): Promise<CheckoutResult | null> {
    const existing = this.checkouts.get(params.idempotencyKey);
    if (!existing || existing.fingerprint !== this.checkoutFingerprint(params)) {
      return null;
    }
    return existing.result;
  }

  async cancelSubscription(
    _externalSubscriptionId: string,
    _immediate: boolean,
    _options: BillingLifecycleGatewayOptions,
  ): Promise<void> {}

  async resumeSubscription(
    _externalSubscriptionId: string,
    _options: BillingLifecycleGatewayOptions,
  ): Promise<void> {}

  async getCustomerPortalUrl(externalCustomerId: string): Promise<string> {
    return `https://billing.example.test/portal/${externalCustomerId}`;
  }

  private checkoutFingerprint(params: CreateCheckoutParams): string {
    return JSON.stringify({
      billingAccountId: params.billingAccountId,
      cancelUrl: params.cancelUrl ?? null,
      email: params.email,
      productId: params.productId,
      successUrl: params.successUrl,
    });
  }
}

class MeterQuotaChecker extends EntitlementQuotaChecker {
  constructor(private readonly usageStorage: InMemoryUsageStorage) {
    super();
  }

  async checkQuota(
    tenantId: string,
    featureId: string,
    quota: number,
  ): Promise<EntitlementQuotaStatus> {
    const usage = await this.getCurrentUsage(tenantId, featureId);
    return {
      usage,
      quota,
      exceeded: usage > quota,
      remaining: Math.max(0, quota - usage),
    };
  }

  async getCurrentUsage(tenantId: string, featureId: string): Promise<number> {
    return this.usageStorage.getUsage({
      tenantId,
      meterId: featureId,
      period: "billing_cycle",
    });
  }

  async resetUsage(tenantId: string, featureId: string): Promise<void> {
    await this.usageStorage.resetBillingCycle(tenantId, featureId);
  }

  async getUsageHistory(
    tenantId: string,
    featureId: string,
    period: UsageHistoryPeriod,
  ): Promise<UsageHistoryEntry[]> {
    const records = await this.usageStorage.fetchUsageRecords({
      tenantId,
      meterId: featureId,
      period: "billing_cycle",
      startDate: period.startDate,
      endDate: period.endDate,
    });

    return records.map((record) => ({
      timestamp: record.timestamp,
      usage: record.value,
    }));
  }
}

class RegistryMeterLookup extends EntitlementMeterLookup {
  constructor(private readonly meterRegistry: MeterRegistry) {
    super();
  }

  async getMeterQuota(tenantId: string, meterId: string): Promise<number | null> {
    const meter = await this.meterRegistry.get(tenantId, meterId);
    return meter?.quota ?? null;
  }
}

class BillingEntitlementSubscriptionProvider extends SubscriptionProvider {
  constructor(private readonly billingService: BillingService) {
    super();
  }

  async getCurrentPlanId(tenantId: string): Promise<string | null> {
    const subscription = await this.billingService.getSubscription(tenantId);
    if (!subscription || !ACTIVE_ENTITLEMENT_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      return null;
    }

    return subscription.planId;
  }

  override readonly getCurrentPlanVersion = async (
    tenantId: string,
  ): Promise<{ planId: string; planVersionRef: PlanVersionRef } | null> => {
    const subscription = await this.billingService.getSubscription(tenantId);
    if (!subscription || !ACTIVE_ENTITLEMENT_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      return null;
    }

    return {
      planId: subscription.planId,
      planVersionRef: subscription.planVersionRef,
    };
  };
}

class EntitlementSeatLimitChecker extends SeatLimitChecker {
  constructor(
    private readonly membershipStore: MembershipStore,
    private readonly entitlementManager: EntitlementManager,
  ) {
    super();
  }

  async checkSeatAvailability(tenantId: string): Promise<EntitlementQuotaStatus> {
    const currentMembers = await this.getCurrentMemberCount(tenantId);
    const requestedSeats = currentMembers + 1;
    const quota = await this.getMaxSeats(tenantId);

    return {
      usage: requestedSeats,
      quota,
      exceeded: requestedSeats > quota,
      remaining: Math.max(0, quota - currentMembers),
    };
  }

  async getCurrentMemberCount(tenantId: string): Promise<number> {
    const memberships = await this.membershipStore.findAllByTenant(tenantId);
    return memberships.length;
  }

  async getMaxSeats(tenantId: string): Promise<number> {
    const result = await this.entitlementManager.check(tenantId, SEATS_FEATURE_KEY);
    if (!result.granted || result.type !== "static" || typeof result.value !== "number") {
      return 0;
    }

    return result.value;
  }
}

class DemoNotificationService extends NotificationService {
  constructor() {
    super(undefined as never, undefined as never);
  }

  override async send(..._args: Parameters<NotificationService["send"]>): Promise<void> {}
}

class DemoEventHandler {
  handle(_event: DomainEvent): void {}
}

function createDemoEventPublisher(): EventPublisher {
  const eventBusConfig = new EventBusConfig();
  const eventBus = new InMemoryEventBus();
  EventBusConfig.setInstance(eventBusConfig);
  EventBusConfig.setStats(new EventBusStats());
  eventBusConfig.setEventBus(eventBus);
  eventBusConfig.subscribe({ eventName: "*", handlerClass: DemoEventHandler });
  return new EventPublisher(eventBusConfig);
}

export type SaasRuntime = {
  providerProfile: SaasProviderProfile;
  tenantStore: InMemoryTenantStore;
  tenantManager: TenantManager;
  membershipStore: InMemoryMembershipStore;
  membershipManager: MembershipManager;
  invitationManager: InvitationManager;
  accessEngine: AccessEngine;
  rbacEngine: RbacEngine;
  billingStore: InMemoryBillingStore;
  billingGateway: BillingGateway;
  billingService: BillingService;
  billableUsageJournal: FileBillableUsageJournal;
  usageBillingGateway: FileUsageBillingGateway;
  usageBillingReadModel: {
    getSnapshot(
      tenantId: string,
      meterIds: readonly string[],
    ): Promise<SaasDemoSnapshot["usageBillingReadModel"]>;
  };
  meterRegistry: MeterRegistry;
  meteringService: MeteringService;
  llmService: LlmService;
  llmMeteringService: LlmMeteringService;
  subscriptionProvider: SubscriptionProvider;
  entitlementManager: EntitlementManager;
  seatLimitChecker: SeatLimitChecker;
  healthService: HealthCheckService;
  diagnosticsCollector: DiagnosticsCollector;
  executionManager: ExecutionManagerImpl;
  jobs: JobsOperations;
  lifecycleRuleRegistry: LifecycleRuleRegistry;
  lifecycleRunStore: InMemoryLifecycleRunStore;
  lifecycleActionSink: InMemoryLifecycleActionSink;
  lifecycleEvaluator: LifecycleRuleEvaluator;
};

export type SaasRuntimeOptions = {
  checkoutIdempotencyStore: IdempotencyStore<CheckoutResult>;
  billingGateway?: BillingGateway;
  usageBillingGateway?: FileUsageBillingGateway;
  billableUsageJournal?: FileBillableUsageJournal;
};

export function createSaasRuntime(options: SaasRuntimeOptions): SaasRuntime {
  const providerProfile = getSaasProviderProfile();
  const eventPublisher = createDemoEventPublisher();

  const tenantStore = new InMemoryTenantStore();
  const tenantManager = new TenantManager();
  const accessEngine = new AccessEngine(new InMemoryAccessProvider());
  const roleRegistry = new RoleRegistry();
  roleRegistry.register({
    name: "owner",
    permissions: ["tenant:read", "tenant:manage", "usage:record"],
  });
  roleRegistry.register({
    name: "member",
    permissions: ["tenant:read", "usage:record"],
  });

  const billingStore = new InMemoryBillingStore();
  const billingGateway = options.billingGateway ?? new DemoBillingGateway();
  const billingService = new BillingService({
    store: billingStore,
    gateway: billingGateway,
    checkoutIdempotencyStore: options.checkoutIdempotencyStore,
  });
  const meterRepository = new InMemoryMeterRepository();
  const usageStorage = new InMemoryUsageStorage();
  const billableUsageJournal =
    options.billableUsageJournal ??
    new FileBillableUsageJournal(BILLABLE_USAGE_JOURNAL_PATH, BILLABLE_USAGE_CREATED_AT);
  const usageBillingGateway =
    options.usageBillingGateway ?? new FileUsageBillingGateway(BILLABLE_USAGE_PROVIDER_PATH);
  const meterRegistry = new MeterRegistry(meterRepository, undefined, billableUsageJournal);
  const meteringService = new MeteringService({
    meterRegistry,
    usageStorage,
    idempotencyManager: new IdempotencyManager(new InMemoryRedisClient()),
  });
  const usageBillingReadModel = {
    async getSnapshot(
      tenantId: string,
      meterIds: readonly string[],
    ): Promise<SaasDemoSnapshot["usageBillingReadModel"]> {
      const localUsage = (
        await Promise.all(
          meterIds.map((meterId) =>
            meteringService.getUsage({ tenantId, meterId, period: "billing_cycle" }),
          ),
        )
      ).reduce((total, usage) => total + usage, 0);
      const providerAcceptedUsage = (
        await Promise.all(
          meterIds.map((meterId) => usageBillingGateway.getAcceptedUsage(tenantId, meterId)),
        )
      ).reduce((total, usage) => total + usage, 0);
      const diagnostics = await billableUsageJournal.getDiagnostics(BILLABLE_USAGE_OVERAGE_AT);

      return {
        localUsage,
        providerAcceptedUsage,
        usageDrift: localUsage - providerAcceptedUsage,
        backlogCount: diagnostics.backlogCount,
        oldestPendingAgeMs: diagnostics.oldestPendingAgeMs,
        retryCount: diagnostics.retryCount,
        terminalFailureCount: diagnostics.terminalFailureCount,
        recoveryCommand: BILLABLE_USAGE_RECOVERY_COMMAND,
      };
    },
  };

  const entitlementRegistry = new InMemoryPlanEntitlementRegistry();
  entitlementRegistry.register({
    planId: TEAM_PLAN_ID,
    planVersionRef: TEAM_PLAN_VERSION_REF,
    entitlements: [
      {
        featureKey: SEATS_FEATURE_KEY,
        type: "static",
        value: 2,
      },
      {
        featureKey: API_REQUESTS_FEATURE_KEY,
        type: "metered",
        meterId: API_REQUESTS_METER_ID,
        meterBilling: "required",
        quota: 2,
        overagePolicy: "ALLOW_WITH_OVERAGE",
      },
      {
        featureKey: STORAGE_GB_FEATURE_KEY,
        type: "metered",
        meterId: STORAGE_GB_METER_ID,
        quota: 100,
        overagePolicy: "WARN",
      },
      {
        featureKey: PROMPT_TOKENS,
        type: "metered",
        meterId: PROMPT_TOKENS,
        quota: DEMO_LLM_PROMPT_TOKENS_QUOTA,
        overagePolicy: "BLOCK",
      },
      {
        featureKey: COMPLETION_TOKENS,
        type: "metered",
        meterId: COMPLETION_TOKENS,
        quota: 100,
        overagePolicy: "BLOCK",
      },
      {
        featureKey: COST_USD_NANOS,
        type: "metered",
        meterId: COST_USD_NANOS,
        quota: DEMO_LLM_COST_QUOTA_USD_NANOS,
        overagePolicy: "BLOCK",
      },
      {
        featureKey: "tenant.invites",
        type: "boolean",
      },
    ],
  });
  const subscriptionProvider = new BillingEntitlementSubscriptionProvider(billingService);
  const entitlementManager = new EntitlementManager(
    entitlementRegistry,
    subscriptionProvider,
    new MeterQuotaChecker(usageStorage),
    new RegistryMeterLookup(meterRegistry),
  );
  const llmRegistry = new InMemoryLlmRegistry();
  llmRegistry.registerProvider(
    DEMO_LLM_MODEL_ID,
    () =>
      new InMemoryLlmModel(DEMO_LLM_MODEL_ID, {
        [DEMO_LLM_PROMPT]: "Usage is under control.",
      }),
  );
  const llmService = new LlmService(llmRegistry, new InMemoryEventBus());
  const llmPricingTable = new PricingTable();
  llmPricingTable.setPrice(DEMO_LLM_PROVIDER, DEMO_LLM_MODEL_ID, {
    inputPricePerToken: DEMO_LLM_INPUT_PRICE_PER_TOKEN,
    outputPricePerToken: DEMO_LLM_OUTPUT_PRICE_PER_TOKEN,
    currency: "USD",
  });
  const llmQuotaPolicy = {
    async enforce(context: {
      tenantId: string;
      meters: readonly { meterId: string; value: number }[];
    }): Promise<void> {
      for (const meter of context.meters) {
        await assertLlmQuotaForEntitlement(
          entitlementManager,
          meteringService,
          context.tenantId,
          meter.meterId,
          meter.value,
        );
      }
    },
  };
  const llmMeteringOptions = {
    meteringService,
    pricingTable: llmPricingTable,
    quotaPolicy: llmQuotaPolicy,
  };
  const llmMeteringService = new LlmMeteringService(llmMeteringOptions);
  const membershipStore = new InMemoryMembershipStore();
  const seatLimitChecker = new EntitlementSeatLimitChecker(membershipStore, entitlementManager);
  const membershipEventPublications = new Map<string, Promise<void>>();
  const membershipManager = new MembershipManager({
    store: membershipStore,
    eventPublisher: {
      publishIdempotently: async (event) => {
        const existing = membershipEventPublications.get(event.eventId);
        if (existing) return existing;

        const publication = eventPublisher.publishNow(event);
        membershipEventPublications.set(event.eventId, publication);
        try {
          await publication;
        } catch (error) {
          if (membershipEventPublications.get(event.eventId) === publication) {
            membershipEventPublications.delete(event.eventId);
          }
          throw error;
        }
      },
    },
    seatLimitChecker,
    eventDelivery: "development",
  });
  const invitationManager = new InvitationManager(
    new InMemoryInvitationStore(),
    membershipManager,
    new DemoNotificationService(),
    eventPublisher,
    new TxManager(new NoopTxAdapter()),
  );

  const healthService = new HealthCheckService({ timeout: 1000 });
  healthService.register({
    async check() {
      return {
        name: "saas-runtime",
        status: "up" as const,
        details: { preset: "saas", provider: "in-memory" },
      };
    },
  });

  const diagnosticsCollector = new DiagnosticsCollector();
  diagnosticsCollector.registerProvider({
    name: "saas-runtime",
    async getHealth() {
      return {
        status: "healthy",
        component: "saas-runtime",
        message: "SaaS golden path runtime is ready",
        details: { provider: "in-memory" },
        lastChecked: new Date().toISOString(),
      };
    },
  });
  const executionManager = new ExecutionManagerImpl(new InMemoryExecutionStore());
  const lifecycleRuleRegistry = new LifecycleRuleRegistry();
  const lifecycleRunStore = new InMemoryLifecycleRunStore();
  const lifecycleActionSink = new InMemoryLifecycleActionSink();
  lifecycleRuleRegistry.register({
    id: LIFECYCLE_RISK_RULE_ID,
    description: "Create a CS follow-up when a tenant becomes at risk during onboarding",
    severity: "high",
    triggers: [{ type: "health.status.changed" }, { type: "health.score.dropped" }],
    cooldown: { durationMs: 24 * 60 * 60 * 1000 },
    when: (context) =>
      context.health?.status === "at_risk" && context.onboarding?.isCompleted !== true,
    actions: (context) => [
      {
        id: LIFECYCLE_RISK_ACTION_ID,
        type: "cs.follow_up",
        title: "Contact at-risk tenant",
        payload: {
          tenantId: context.tenantId,
          status: context.health?.status,
          score: context.health?.score,
          currentStepId: context.onboarding?.currentStepId,
        },
      },
    ],
  });
  const lifecycleEvaluator = new LifecycleRuleEvaluator({
    registry: lifecycleRuleRegistry,
    runStore: lifecycleRunStore,
    actionAdapter: lifecycleActionSink,
  });
  diagnosticsCollector.registerProvider(new LifecycleDiagnosticsProvider(lifecycleRunStore));

  return {
    providerProfile,
    tenantStore,
    tenantManager,
    membershipStore,
    membershipManager,
    invitationManager,
    accessEngine,
    rbacEngine: new RbacEngine(roleRegistry),
    billingStore,
    billingGateway,
    billingService,
    billableUsageJournal,
    usageBillingGateway,
    usageBillingReadModel,
    meterRegistry,
    meteringService,
    llmService,
    llmMeteringService,
    subscriptionProvider,
    entitlementManager,
    seatLimitChecker,
    healthService,
    diagnosticsCollector,
    executionManager,
    jobs: createExecutionJobsOperations(executionManager),
    lifecycleRuleRegistry,
    lifecycleRunStore,
    lifecycleActionSink,
    lifecycleEvaluator,
  };
}

export function createSaasDemoRuntime(): SaasRuntime {
  return createSaasRuntime({
    checkoutIdempotencyStore: new InMemoryIdempotencyStore(),
  });
}

export let defaultSaasRuntime = createSaasDemoRuntime();

export function resetDefaultSaasRuntime(): SaasRuntime {
  defaultSaasRuntime = createSaasDemoRuntime();
  return defaultSaasRuntime;
}

export async function seedDefaultSaasRuntime(): Promise<SaasDemoSnapshot> {
  return runSaasDemoFlow(resetDefaultSaasRuntime());
}

async function assertLlmQuotaForEntitlement(
  entitlementManager: EntitlementManager,
  meteringService: MeteringService,
  tenantId: string,
  meterId: string,
  requestedUsage: number,
): Promise<void> {
  const entitlement = await entitlementManager.check(tenantId, meterId);
  if (!entitlement.granted) {
    throw new LlmQuotaExceededProblem(meterId, entitlement.usage ?? 0, entitlement.quota ?? 0);
  }
  if (entitlement.quota === undefined) {
    return;
  }

  const currentUsage = await meteringService.getUsage({
    tenantId,
    meterId,
    period: "billing_cycle",
  });
  const projectedUsage = currentUsage + requestedUsage;
  if (projectedUsage > entitlement.quota) {
    throw new LlmQuotaExceededProblem(meterId, projectedUsage, entitlement.quota);
  }
}

export async function runSaasDemoFlow(
  runtime: SaasRuntime = createSaasDemoRuntime(),
): Promise<SaasDemoSnapshot> {
  const ownerUserId = "user_owner";
  const invitedUserId = "user_member";
  const rejectedUserId = "user_over_limit";
  const tenant = await runtime.tenantStore.create({
    slug: "acme",
    name: "Acme SaaS",
    status: "trial",
    settings: {
      timezone: "UTC",
      features: ["tenant.invites", API_REQUESTS_FEATURE_KEY, STORAGE_GB_FEATURE_KEY],
    },
  });

  return runtime.tenantManager.run(tenant.id, async () => {
    const checkout = await runtime.billingService.createCheckout({
      tenantId: tenant.id,
      email: "owner@example.com",
      productId: TEAM_PLAN_ID,
      successUrl: "https://app.example.test/billing/success",
      cancelUrl: "https://app.example.test/billing/cancel",
      idempotencyKey: `checkout_${tenant.id}_${TEAM_PLAN_ID}`,
    });
    const billingMockEvent = await processBillingMockSubscriptionActivatedEvent(runtime, tenant.id);
    const entitlementPlanId = await runtime.subscriptionProvider.getCurrentPlanId(tenant.id);

    const ownerMembership = await runtime.membershipManager.addMember(
      tenant.id,
      ownerUserId,
      "owner",
      `demo-owner:${tenant.id}:${ownerUserId}`,
    );
    const invitationToken = await runtime.invitationManager.createLinkInvitation({
      idempotencyKey: `invite_${tenant.id}_${invitedUserId}`,
      tenantId: tenant.id,
      inviterId: ownerUserId,
      role: "member",
    });
    const invitationOutcome = await runtime.invitationManager.acceptInvitation({
      token: invitationToken,
      userId: invitedUserId,
    });
    const invitation = invitationOutcome.value;
    let seatLimitFailureCode = "none";
    try {
      await runtime.membershipManager.addMember(
        tenant.id,
        rejectedUserId,
        "member",
        `demo-seat-limit:${tenant.id}:${rejectedUserId}`,
      );
    } catch (error) {
      if (!(error instanceof SeatLimitExceededProblem)) {
        throw error;
      }
      seatLimitFailureCode = error.code;
    }
    await runtime.membershipManager.publishPendingEvents();
    const seatLimit = await runtime.seatLimitChecker.checkSeatAvailability(tenant.id);
    const memberMembership = await runtime.membershipManager.getMember(tenant.id, invitedUserId);
    const members = await runtime.membershipManager.listMembers(tenant.id);

    const memberUser: AuthUser = {
      id: invitedUserId,
      roles: ["member"],
      permissions: [],
    };
    const authPermission = "tenant:read";
    const authAllowed = runtime.rbacEngine.hasPermission(memberUser, authPermission);

    const accessObject = `tenant:${tenant.id}` as const;
    await runtime.accessEngine.grant({
      tenantId: tenant.id,
      tuple: {
        object: accessObject,
        relation: "member",
        subject: `user:${invitedUserId}`,
      },
    });
    const access = await runtime.accessEngine.check({
      tenantId: tenant.id,
      object: accessObject,
      relation: "member",
      subject: `user:${invitedUserId}`,
    });

    const subscriptionStatus = await runtime.billingService.getSubscriptionStatus(tenant.id);
    const billingSyncJob = await runBillingSyncJob(runtime, tenant.id);

    await runtime.meterRegistry.register({
      tenantId: tenant.id,
      meterId: API_REQUESTS_METER_ID,
      type: "COUNT",
      billing: "required",
      aggregation: "COUNT",
      unit: "request",
      quota: 2,
      allowOverQuota: true,
      metadata: { featureKey: API_REQUESTS_FEATURE_KEY, unit: "request" },
    });
    const billableUsage = await runBillableApiUsageScenario(runtime, tenant.id);
    const currentUsage = await runtime.meteringService.getUsage({
      tenantId: tenant.id,
      meterId: API_REQUESTS_METER_ID,
      period: "billing_cycle",
    });
    const entitlement = await runtime.entitlementManager.check(tenant.id, API_REQUESTS_FEATURE_KEY);

    await runtime.meterRegistry.register({
      tenantId: tenant.id,
      meterId: STORAGE_GB_METER_ID,
      type: "COUNT",
      quota: 100,
      allowOverQuota: true,
      metadata: { featureKey: STORAGE_GB_FEATURE_KEY, unit: "GB" },
    });
    await runtime.meteringService.record({
      tenantId: tenant.id,
      meterId: STORAGE_GB_METER_ID,
      value: 105,
      idempotencyKey: "demo-storage-gb",
      metadata: { source: "demo:seed" },
    });

    const lifecycleSignal = createHealthStatusChangedSignal({
      signalId: `health-risk:${tenant.id}`,
      tenantId: tenant.id,
      oldStatus: "healthy",
      newStatus: "at_risk",
      score: 62,
    });
    const lifecycleContext = createLifecycleContext({
      signal: lifecycleSignal,
      health: {
        status: "at_risk",
        score: 62,
        previousScore: 84,
        dropPercentage: 26.19,
      },
      onboarding: {
        status: "in_progress",
        isCompleted: false,
        currentStepId: "invite-team-member",
      },
      billing: {
        status: subscriptionStatus ?? "active",
        planId: TEAM_PLAN_ID,
      },
      usage: [
        {
          meterId: API_REQUESTS_METER_ID,
          usage: currentUsage,
          quota: entitlement.quota,
          remaining: entitlement.remaining,
          exceeded: entitlement.exceeded,
        },
      ],
    });
    const lifecycleFirstRun = await runtime.lifecycleEvaluator.evaluate(lifecycleContext);
    const lifecycleDuplicateRun = await runtime.lifecycleEvaluator.evaluate(lifecycleContext);
    const lifecycleRuns = await runtime.lifecycleRunStore.list({ tenantId: tenant.id });
    const lifecycleActions = runtime.lifecycleActionSink
      .getEmissions()
      .filter((emission) => emission.tenantId === tenant.id);

    await runtime.meterRegistry.register({
      tenantId: tenant.id,
      meterId: PROMPT_TOKENS,
      type: "COUNT",
      quota: DEMO_LLM_PROMPT_TOKENS_QUOTA,
      allowOverQuota: false,
      metadata: { unit: "token", provider: DEMO_LLM_PROVIDER },
    });
    await runtime.meterRegistry.register({
      tenantId: tenant.id,
      meterId: COMPLETION_TOKENS,
      type: "COUNT",
      quota: 100,
      allowOverQuota: false,
      metadata: { unit: "token", provider: DEMO_LLM_PROVIDER },
    });
    await runtime.meterRegistry.register({
      tenantId: tenant.id,
      meterId: COST_USD_NANOS,
      type: "CUSTOM_EVENT",
      quota: DEMO_LLM_COST_QUOTA_USD_NANOS,
      allowOverQuota: false,
      metadata: { unit: "usd_nanos", provider: DEMO_LLM_PROVIDER },
    });
    const aiResult = await runtime.llmService.generate({
      modelId: DEMO_LLM_MODEL_ID,
      prompt: DEMO_LLM_PROMPT,
    });
    const aiUsageRecord = await runtime.llmMeteringService.recordUsage({
      tenantId: tenant.id,
      modelId: DEMO_LLM_MODEL_ID,
      provider: DEMO_LLM_PROVIDER,
      usage: aiResult.usage,
      idempotencyKey: "demo-llm-generate",
      metadata: {
        operationType: "generate",
        source: "demo:ai",
      },
    });
    const aiPromptUsage = await runtime.meteringService.getUsage({
      tenantId: tenant.id,
      meterId: PROMPT_TOKENS,
      period: "billing_cycle",
    });
    let aiQuotaFailureCode = "none";
    try {
      await runtime.llmMeteringService.recordUsage({
        tenantId: tenant.id,
        modelId: DEMO_LLM_MODEL_ID,
        provider: DEMO_LLM_PROVIDER,
        usage: {
          promptTokens: DEMO_LLM_PROMPT_TOKENS_QUOTA,
          completionTokens: 0,
          totalTokens: DEMO_LLM_PROMPT_TOKENS_QUOTA,
          accuracy: "ESTIMATED",
        },
        idempotencyKey: "demo-llm-over-quota",
        metadata: {
          operationType: "generate",
          source: "demo:ai-quota",
        },
      });
    } catch (error) {
      if (!(error instanceof LlmQuotaExceededProblem)) {
        throw error;
      }
      aiQuotaFailureCode = error.code;
    }

    const health = await runtime.healthService.check();
    const diagnostics = await runtime.diagnosticsCollector.getReport();
    const usageBillingReadModel = await runtime.usageBillingReadModel.getSnapshot(tenant.id, [
      API_REQUESTS_METER_ID,
    ]);

    return {
      contract: {
        version: SAAS_SMOKE_CONTRACT_VERSION,
        providerProfile: runtime.providerProfile.name,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
      },
      invitation: {
        status: invitation.status,
        invitedUserId,
      },
      membership: {
        ownerRole: ownerMembership.role,
        memberRole: memberMembership.role,
        memberCount: members.length,
        seatLimit: {
          ...seatLimit,
          failureCode: seatLimitFailureCode,
          rejectedUserId,
        },
      },
      auth: {
        userId: memberUser.id,
        sessionId: DEMO_MEMBER_SESSION_ID,
        roles: memberUser.roles,
        permission: authPermission,
        allowed: authAllowed,
      },
      access: {
        object: accessObject,
        relation: "member",
        allowed: access.allowed,
      },
      billing: {
        checkoutUrl: checkout.checkoutUrl,
        subscriptionStatus: subscriptionStatus ?? "none",
        entitlementPlanId,
        mockEvent: billingMockEvent,
      },
      metering: {
        meterId: API_REQUESTS_METER_ID,
        recordedValue: usageBillingReadModel.localUsage,
        currentUsage,
      },
      billableUsage,
      usageBillingReadModel,
      ai: {
        provider: aiUsageRecord.provider,
        modelId: aiUsageRecord.modelId,
        responseText: aiResult.text,
        promptTokens: aiUsageRecord.promptTokens,
        completionTokens: aiUsageRecord.completionTokens,
        totalTokens: aiUsageRecord.promptTokens + aiUsageRecord.completionTokens,
        costUsd: aiUsageRecord.costUsd,
        promptUsage: aiPromptUsage,
        promptQuota: DEMO_LLM_PROMPT_TOKENS_QUOTA,
        quotaFailureCode: aiQuotaFailureCode,
      },
      entitlement: {
        featureKey: entitlement.featureKey,
        granted: entitlement.granted,
        quota: entitlement.quota,
        usage: entitlement.usage,
        remaining: entitlement.remaining,
        planId: entitlement.planId,
        planVersionRef: entitlement.planVersionRef,
        overagePolicy: entitlement.overagePolicy,
      },
      operations: {
        healthStatus: health.status,
        diagnosticsSummary: diagnostics.summary,
      },
      jobs: {
        id: billingSyncJob.id,
        type: billingSyncJob.type,
        status: billingSyncJob.status,
        failurePolicyState: billingSyncJob.failurePolicy.state,
        logCount: billingSyncJob.logCount,
      },
      lifecycle: {
        ruleId: lifecycleFirstRun.runs[0]?.ruleId ?? "none",
        firstRunStatus: lifecycleFirstRun.runs[0]?.status ?? "none",
        duplicateRunStatus: lifecycleDuplicateRun.runs[0]?.status ?? "none",
        duplicateSkipReason: lifecycleDuplicateRun.runs[0]?.skipReason ?? "none",
        emittedActionType: lifecycleActions[0]?.action.type ?? "none",
        emittedActionCount: lifecycleActions.length,
        visibleRunCount: lifecycleRuns.length,
      },
    };
  });
}

async function runBillableApiUsageScenario(
  runtime: SaasRuntime,
  tenantId: string,
): Promise<SaasDemoSnapshot["billableUsage"]> {
  await Promise.all([runtime.billableUsageJournal.reset(), runtime.usageBillingGateway.reset()]);
  const worker = new PolarUsageDeliveryWorker(
    runtime.billableUsageJournal,
    runtime.usageBillingGateway,
    {
      ownerId: "saas-demo-usage-worker",
      leaseDurationMs: 30_000,
      maxBatchSize: 10,
      retryBaseDelayMs: 1_000,
      retryMaxDelayMs: 1_000,
    },
  );

  const includedRecord = await runtime.meteringService.record({
    tenantId,
    meterId: API_REQUESTS_METER_ID,
    value: 2,
    idempotencyKey: INCLUDED_API_USAGE_EVENT_ID,
    metadata: { source: "demo:billable-included" },
  });
  const includedDelivery = await worker.deliverNextBatch(BILLABLE_USAGE_CREATED_AT);
  const includedEntitlement = await runtime.entitlementManager.check(
    tenantId,
    API_REQUESTS_FEATURE_KEY,
  );
  if (!includedEntitlement.granted || includedEntitlement.usage !== includedRecord.value) {
    throw new SaasBillableUsageProblem(
      "Included billable usage did not retain an allowed entitlement.",
    );
  }

  runtime.usageBillingGateway.setAvailable(false);
  const overageRecord = await runtime.meteringService.record({
    tenantId,
    meterId: API_REQUESTS_METER_ID,
    value: 1,
    idempotencyKey: OVERAGE_API_USAGE_EVENT_ID,
    metadata: { source: "demo:billable-overage" },
  });
  const unavailableDelivery = await worker.deliverNextBatch(BILLABLE_USAGE_OUTAGE_AT);
  const retryableEntry = await requireBillableUsageEntry(
    runtime.billableUsageJournal,
    OVERAGE_API_USAGE_EVENT_ID,
  );
  const outageDiagnostics =
    await runtime.billableUsageJournal.getDiagnostics(BILLABLE_USAGE_OUTAGE_AT);

  runtime.usageBillingGateway.setAvailable(true);
  const recoveryDelivery = await runUsageRecoveryProcess();

  const providerAcceptedUsageBeforeReplay = await runtime.usageBillingGateway.getAcceptedUsage(
    tenantId,
    API_REQUESTS_METER_ID,
  );
  const replayReceipt = await runtime.usageBillingGateway.ingest([
    {
      billingAccountId: tenantId,
      eventId: OVERAGE_API_USAGE_EVENT_ID,
      meterId: API_REQUESTS_METER_ID,
      occurredAt: overageRecord.timestamp,
      value: overageRecord.value,
    },
  ]);
  const providerAcceptedUsage = await runtime.usageBillingGateway.getAcceptedUsage(
    tenantId,
    API_REQUESTS_METER_ID,
  );
  const includedFinalEntry = await requireBillableUsageEntry(
    runtime.billableUsageJournal,
    INCLUDED_API_USAGE_EVENT_ID,
  );
  const overageFinalEntry = await requireBillableUsageEntry(
    runtime.billableUsageJournal,
    OVERAGE_API_USAGE_EVENT_ID,
  );
  const finalDiagnostics =
    await runtime.billableUsageJournal.getDiagnostics(BILLABLE_USAGE_OVERAGE_AT);
  const replayOutcome = replayReceipt.receipts[0]?.status;
  if (
    runtime.billableUsageJournal.durability !== "persistent" ||
    retryableEntry.state !== "retryable-failed" ||
    includedFinalEntry.state !== "accepted" ||
    overageFinalEntry.state !== "accepted" ||
    replayOutcome !== "duplicate"
  ) {
    throw new SaasBillableUsageProblem(
      "Billable usage scenario did not produce its required delivery states.",
    );
  }

  return {
    planVersionRef: TEAM_PLAN_VERSION_REF,
    journalDurability: runtime.billableUsageJournal.durability,
    included: {
      eventId: INCLUDED_API_USAGE_EVENT_ID,
      value: includedRecord.value,
      recordOutcome: "recorded",
      deliveryOutcome: includedFinalEntry.state,
      delivery: includedDelivery,
    },
    overage: {
      eventId: OVERAGE_API_USAGE_EVENT_ID,
      value: overageRecord.value,
      recordOutcome: "recorded",
      initialDeliveryOutcome: retryableEntry.state,
      finalDeliveryOutcome: overageFinalEntry.state,
    },
    providerOutage: {
      delivery: unavailableDelivery,
      failureCode: retryableEntry.failure?.code ?? "none",
      backlogCount: outageDiagnostics.backlogCount,
      oldestPendingAgeMs: outageDiagnostics.oldestPendingAgeMs,
    },
    recovery: {
      command: BILLABLE_USAGE_RECOVERY_COMMAND,
      processBoundary: "separate-node-process",
      delivery: recoveryDelivery,
    },
    replay: {
      eventId: OVERAGE_API_USAGE_EVENT_ID,
      outcome: replayOutcome,
      providerAcceptedUsageBefore: providerAcceptedUsageBeforeReplay,
      providerAcceptedUsageAfter: providerAcceptedUsage,
    },
    providerAcceptedUsage,
    finalConvergence: {
      delivery: recoveryDelivery,
      backlogCount: finalDiagnostics.backlogCount,
      oldestPendingAgeMs: finalDiagnostics.oldestPendingAgeMs,
      retryCount: finalDiagnostics.retryCount,
      terminalFailureCount: finalDiagnostics.terminalFailureCount,
      converged:
        includedFinalEntry.state === "accepted" &&
        overageFinalEntry.state === "accepted" &&
        finalDiagnostics.backlogCount === 0 &&
        providerAcceptedUsage === includedRecord.value + overageRecord.value,
    },
  };
}

export async function recoverPendingBillableUsage() {
  const journal = new FileBillableUsageJournal(
    BILLABLE_USAGE_JOURNAL_PATH,
    BILLABLE_USAGE_RECOVERY_AT,
  );
  const gateway = new FileUsageBillingGateway(BILLABLE_USAGE_PROVIDER_PATH);
  const worker = new PolarUsageDeliveryWorker(journal, gateway, {
    ownerId: "saas-demo-usage-recovery-process",
    leaseDurationMs: 30_000,
    maxBatchSize: 10,
    retryBaseDelayMs: 1_000,
    retryMaxDelayMs: 1_000,
  });
  const delivery = await worker.deliverNextBatch(BILLABLE_USAGE_RECOVERY_AT);
  const entry = await journal.get(OVERAGE_API_USAGE_EVENT_ID);
  if (entry && entry.state !== "accepted") {
    throw new SaasBillableUsageProblem(
      "Usage recovery process did not accept the pending overage event.",
    );
  }
  return delivery;
}

async function runUsageRecoveryProcess(): Promise<RecoveryDeliveryResult> {
  const packageManagerCli = process.env.npm_execpath;
  if (!packageManagerCli) {
    throw new SaasBillableUsageProblem(
      "Usage recovery requires npm_execpath from the package manager runtime.",
    );
  }
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      [packageManagerCli, "run", "demo:usage-recover"],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        timeout: 60_000,
      },
    ));
  } catch (error) {
    throw new SaasBillableUsageProblem(
      `Usage recovery command failed: ${readRecoveryProcessFailure(error)}`,
    );
  }
  const lastLine = stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .at(-1);
  if (!lastLine) {
    throw new SaasBillableUsageProblem("Usage recovery process returned no delivery result.");
  }
  try {
    return recoveryDeliverySchema.parse(JSON.parse(lastLine)) as RecoveryDeliveryResult;
  } catch {
    throw new SaasBillableUsageProblem(
      "Usage recovery process returned an invalid delivery result.",
    );
  }
}

function readRecoveryProcessFailure(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const processError = error as { stderr?: unknown; stdout?: unknown };
    for (const outputName of ["stderr", "stdout"] as const) {
      const output = processError[outputName];
      const text =
        typeof output === "string"
          ? output
          : output instanceof Uint8Array
            ? Buffer.from(output).toString("utf8")
            : "";
      if (text.trim().length > 0) return text.trim();
    }
  }
  return error instanceof Error ? error.message : String(error);
}

async function requireBillableUsageEntry(journal: FileBillableUsageJournal, eventId: string) {
  const entry = await journal.get(eventId);
  if (!entry) {
    throw new SaasBillableUsageProblem(`Billable usage journal entry '${eventId}' was not found.`);
  }
  return entry;
}

async function processBillingMockSubscriptionActivatedEvent(
  runtime: SaasRuntime,
  tenantId: string,
): Promise<SaasDemoSnapshot["billing"]["mockEvent"]> {
  const eventType = "billing.subscription_activated";
  const eventId = `${eventType}:${tenantId}:team`;
  const externalSubscriptionId = `external_subscription_${tenantId}`;
  const pinnedPlanVersionRef = TEAM_PLAN_VERSION_REF;

  await runtime.billingStore.reserveWebhook(eventId, eventType);
  await runtime.billingStore.saveSubscription({
    id: `subscription_${tenantId}`,
    billingAccountId: tenantId,
    externalSubscriptionId,
    planId: TEAM_PLAN_ID,
    planVersionRef: pinnedPlanVersionRef,
    status: "active",
    currentPeriodEnd: DEMO_SUBSCRIPTION_CURRENT_PERIOD_END,
    cancelAtPeriodEnd: false,
    lastSyncedAt: DEMO_BILLING_LAST_SYNCED_AT,
  });
  await runtime.billingStore.completeWebhook(eventId);

  let duplicateFailureCode = "none";
  try {
    await runtime.billingStore.reserveWebhook(eventId, eventType);
  } catch (error) {
    if (!(error instanceof WebhookAlreadyProcessedProblem)) {
      throw error;
    }
    duplicateFailureCode = error.code;
  }

  return {
    eventId,
    eventType,
    externalSubscriptionId,
    planVersionRef: pinnedPlanVersionRef,
    processedStatus: "completed",
    duplicateFailureCode,
  };
}

async function runBillingSyncJob(runtime: SaasRuntime, tenantId: string): Promise<JobDetails> {
  const execution = await runtime.executionManager.create({
    type: "billing-sync",
    payload: { tenantId },
    maxAttempts: 2,
    idempotencyKey: `billing-sync:${tenantId}`,
    metadata: { workflowName: "billing.sync" },
  });

  await runtime.executionManager.start(execution.id);
  await runtime.executionManager.recordLog(execution.id, {
    message: "Billing sync started",
    data: { tenantId },
  });

  try {
    const subscriptionStatus = await runtime.billingService.getSubscriptionStatus(tenantId);
    if (subscriptionStatus !== "active") {
      await runtime.executionManager.fail(execution.id, {
        message: "Billing subscription is not active",
        code: "BILLING_INACTIVE",
        retryable: false,
      });
      return runtime.jobs.show(execution.id);
    }

    await runtime.executionManager.recordLog(execution.id, {
      message: "Billing subscription active",
      data: { tenantId, subscriptionStatus },
    });
    await runtime.executionManager.complete(execution.id, { subscriptionStatus });
    return runtime.jobs.show(execution.id);
  } catch (error) {
    await runtime.executionManager.fail(execution.id, {
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    });
    throw error;
  }
}

export function assertSaasDemoSnapshot(snapshot: SaasDemoSnapshot): void {
  assertSaasSmokeContract(snapshot);
}

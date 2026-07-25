import { AccessEngine } from "@croco/access-core";
import { type AuthUser, RbacEngine, RoleRegistry } from "@croco/auth-core";
import {
  BillingService,
  InMemoryBillingStore,
  planVersionRef,
  WebhookAlreadyProcessedProblem,
  type BillingGateway,
  type SubscriptionStatus,
} from "@croco/billing-core";
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
import { InMemoryInvitationStore, InvitationManager } from "@croco/invitation-core";
import { InMemoryLlmModel, InMemoryLlmRegistry, LlmService } from "@croco/llm-core";
import { LlmMeteringService, LlmQuotaExceededProblem, PricingTable } from "@croco/llm-metering";
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
import {
  assertSaasSmokeContract,
  SAAS_SMOKE_CONTRACT_VERSION,
  type SaasDemoSnapshot,
} from "./demo/saasSmokeContract";
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
const COST_USD = "llm.cost_usd";
const ACTIVE_ENTITLEMENT_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
]);

class DemoBillingGateway implements BillingGateway {
  async ensureCustomer(billingAccountId: string): Promise<string> {
    return `customer_${billingAccountId}`;
  }

  async createCheckout(): Promise<{ checkoutUrl: string; checkoutId: string }> {
    return {
      checkoutUrl: "https://billing.example.test/checkout/team",
      checkoutId: "checkout_team",
    };
  }

  async cancelSubscription(): Promise<void> {}

  async resumeSubscription(): Promise<void> {}

  async getCustomerPortalUrl(externalCustomerId: string): Promise<string> {
    return `https://billing.example.test/portal/${externalCustomerId}`;
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
  billingService: BillingService;
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

export function createSaasRuntime(): SaasRuntime {
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
  const billingService = new BillingService({
    store: billingStore,
    gateway: new DemoBillingGateway(),
    eventPublisher,
  });
  const meterRepository = new InMemoryMeterRepository();
  const usageStorage = new InMemoryUsageStorage();
  const meterRegistry = new MeterRegistry(meterRepository);
  const meteringService = new MeteringService({
    meterRegistry,
    usageStorage,
    idempotencyManager: new IdempotencyManager(new InMemoryRedisClient()),
  });

  const entitlementRegistry = new InMemoryPlanEntitlementRegistry();
  entitlementRegistry.register(TEAM_PLAN_ID, [
    {
      featureKey: SEATS_FEATURE_KEY,
      type: "static",
      value: 2,
    },
    {
      featureKey: API_REQUESTS_FEATURE_KEY,
      type: "metered",
      meterId: API_REQUESTS_METER_ID,
      quota: 100,
      overagePolicy: "WARN",
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
      featureKey: COST_USD,
      type: "metered",
      meterId: COST_USD,
      quota: 1,
      overagePolicy: "BLOCK",
    },
    {
      featureKey: "tenant.invites",
      type: "boolean",
    },
  ]);
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
  const membershipManager = new MembershipManager(
    membershipStore,
    eventPublisher,
    seatLimitChecker,
  );
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
    billingService,
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

export let defaultSaasRuntime = createSaasRuntime();

export function resetDefaultSaasRuntime(): SaasRuntime {
  defaultSaasRuntime = createSaasRuntime();
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
  runtime: SaasRuntime = createSaasRuntime(),
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
    });
    const billingMockEvent = await processBillingMockSubscriptionActivatedEvent(runtime, tenant.id);
    const entitlementPlanId = await runtime.subscriptionProvider.getCurrentPlanId(tenant.id);

    const ownerMembership = await runtime.membershipManager.addMember(
      tenant.id,
      ownerUserId,
      "owner",
    );
    const invitationToken = await runtime.invitationManager.createLinkInvitation({
      tenantId: tenant.id,
      inviterId: ownerUserId,
      role: "member",
    });
    const invitation = await runtime.invitationManager.acceptInvitation({
      token: invitationToken,
      userId: invitedUserId,
    });
    let seatLimitFailureCode = "none";
    try {
      await runtime.membershipManager.addMember(tenant.id, rejectedUserId, "member");
    } catch (error) {
      if (!(error instanceof SeatLimitExceededProblem)) {
        throw error;
      }
      seatLimitFailureCode = error.code;
    }
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
      quota: 100,
      allowOverQuota: false,
      metadata: { featureKey: API_REQUESTS_FEATURE_KEY, unit: "request" },
    });
    const usageRecord = await runtime.meteringService.record({
      tenantId: tenant.id,
      meterId: API_REQUESTS_METER_ID,
      value: 3,
      idempotencyKey: "demo-api-requests",
      metadata: { source: "demo:seed" },
    });
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
      meterId: COST_USD,
      type: "CUSTOM_EVENT",
      quota: 1,
      allowOverQuota: false,
      metadata: { unit: "usd", provider: DEMO_LLM_PROVIDER },
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
        meterId: usageRecord.meterId,
        recordedValue: usageRecord.value,
        currentUsage,
      },
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

async function processBillingMockSubscriptionActivatedEvent(
  runtime: SaasRuntime,
  tenantId: string,
): Promise<SaasDemoSnapshot["billing"]["mockEvent"]> {
  const eventType = "billing.subscription_activated";
  const eventId = `${eventType}:${tenantId}:team`;
  const externalSubscriptionId = `external_subscription_${tenantId}`;
  const pinnedPlanVersionRef = planVersionRef(`${TEAM_PLAN_ID}@v1`);

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

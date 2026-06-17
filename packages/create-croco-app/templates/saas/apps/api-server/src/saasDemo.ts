import { AccessEngine } from "@croco/access-core";
import { type AuthUser, RbacEngine, RoleRegistry } from "@croco/auth-core";
import {
  BillingService,
  InMemoryBillingStore,
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
import { ExecutionManagerImpl } from "@croco/execution-core";
import { EventBusConfig, EventPublisher, type DomainEvent } from "@croco/events-core";
import { HealthCheckService } from "@croco/health-core";
import { InMemoryInvitationStore, InvitationManager } from "@croco/invitation-core";
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
import { InMemoryJobsOperations, type JobDetails } from "./jobs";
import { getSaasProviderProfile, type SaasProviderProfile } from "./providerProfiles";

const TEAM_PLAN_ID = "team";
const SEATS_FEATURE_KEY = "seats";
const API_REQUESTS_METER_ID = "api_requests";
const API_REQUESTS_FEATURE_KEY = "api.requests";
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

class DemoEventPublisher extends EventPublisher {
  constructor(private readonly demoEventBus: InMemoryEventBus) {
    super();
  }

  override async publish(event: DomainEvent): Promise<void> {
    await this.demoEventBus.publish(event);
  }

  async publishNow(event: DomainEvent): Promise<void> {
    await this.publish(event);
  }

  override async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}

function createDemoEventPublisher(): EventPublisher {
  const eventBusConfig = EventBusConfig.getInstance();
  const eventBus = new InMemoryEventBus();
  eventBusConfig.setEventBus(eventBus);
  return new DemoEventPublisher(eventBus);
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
  subscriptionProvider: SubscriptionProvider;
  entitlementManager: EntitlementManager;
  seatLimitChecker: SeatLimitChecker;
  healthService: HealthCheckService;
  diagnosticsCollector: DiagnosticsCollector;
  executionManager: ExecutionManagerImpl;
  jobs: InMemoryJobsOperations;
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
    subscriptionProvider,
    entitlementManager,
    seatLimitChecker,
    healthService,
    diagnosticsCollector,
    executionManager,
    jobs: new InMemoryJobsOperations(),
  };
}

export const defaultSaasRuntime = createSaasRuntime();

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
      features: ["tenant.invites", API_REQUESTS_FEATURE_KEY],
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
    await runtime.billingStore.saveSubscription({
      id: `subscription_${tenant.id}`,
      billingAccountId: tenant.id,
      externalSubscriptionId: `external_subscription_${tenant.id}`,
      planId: TEAM_PLAN_ID,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      lastSyncedAt: new Date(),
    });
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
      metadata: { unit: "request" },
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
      },
      metering: {
        meterId: usageRecord.meterId,
        recordedValue: usageRecord.value,
        currentUsage,
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
    };
  });
}

async function runBillingSyncJob(runtime: SaasRuntime, tenantId: string): Promise<JobDetails> {
  const execution = await runtime.executionManager.create({
    type: "billing-sync",
    payload: { tenantId },
    maxAttempts: 2,
    idempotencyKey: `billing-sync:${tenantId}`,
    metadata: { workflowName: "billing.sync" },
  });
  runtime.jobs.create({
    id: execution.id,
    type: "billing-sync",
    payload: { tenantId },
    maxAttempts: 2,
    metadata: { workflowName: "billing.sync" },
  });

  await runtime.executionManager.start(execution.id);
  runtime.jobs.start(execution.id);
  runtime.jobs.recordLog(execution.id, {
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
      return runtime.jobs.fail(execution.id, {
        message: "Billing subscription is not active",
        code: "BILLING_INACTIVE",
      });
    }

    runtime.jobs.recordLog(execution.id, {
      message: "Billing subscription active",
      data: { tenantId, subscriptionStatus },
    });
    await runtime.executionManager.complete(execution.id, { subscriptionStatus });
    return runtime.jobs.complete(execution.id, { subscriptionStatus });
  } catch (error) {
    await runtime.executionManager.fail(execution.id, {
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    });
    runtime.jobs.fail(execution.id, {
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    });
    throw error;
  }
}

export function assertSaasDemoSnapshot(snapshot: SaasDemoSnapshot): void {
  assertSaasSmokeContract(snapshot);
}

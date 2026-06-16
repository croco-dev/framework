import { AccessEngine } from "@croco/access-core";
import { type AuthUser, RbacEngine, RoleRegistry } from "@croco/auth-core";
import { BillingService, InMemoryBillingStore, type BillingGateway } from "@croco/billing-core";
import { DiagnosticsCollector } from "@croco/diagnostics-core";
import {
  EntitlementManager,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  InMemoryPlanEntitlementRegistry,
  StaticSubscriptionProvider,
  type EntitlementCheckResult,
  type EntitlementQuotaStatus,
  type UsageHistoryEntry,
  type UsageHistoryPeriod,
} from "@croco/entitlements-core";
import { EventBusConfig, EventPublisher, type DomainEvent } from "@croco/events-core";
import { HealthCheckService } from "@croco/health-core";
import { InMemoryInvitationStore, InvitationManager } from "@croco/invitation-core";
import { InMemoryMembershipStore, MembershipManager } from "@croco/membership-core";
import { IdempotencyManager, MeteringService, MeterRegistry } from "@croco/metering-core";
import { NotificationService } from "@croco/notifications-core";
import { TenantManager, type Tenant } from "@croco/tenant-core";
import { TxManager } from "@croco/tx-core";
import {
  InMemoryAccessProvider,
  InMemoryEventBus,
  InMemoryMeterRepository,
  InMemoryRedisClient,
  InMemoryTenantStore,
  InMemoryUsageStorage,
  NoopTxAdapter,
} from "./inMemoryAdapters";
import { SaasDemoSmokeProblem } from "./problems";

const TEAM_PLAN_ID = "team";
const API_REQUESTS_METER_ID = "api_requests";
const API_REQUESTS_FEATURE_KEY = "api.requests";

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
  tenantStore: InMemoryTenantStore;
  tenantManager: TenantManager;
  membershipManager: MembershipManager;
  invitationManager: InvitationManager;
  accessEngine: AccessEngine;
  rbacEngine: RbacEngine;
  billingStore: InMemoryBillingStore;
  billingService: BillingService;
  meterRegistry: MeterRegistry;
  meteringService: MeteringService;
  entitlementManager: EntitlementManager;
  healthService: HealthCheckService;
  diagnosticsCollector: DiagnosticsCollector;
};

export type SaasDemoSnapshot = {
  tenant: Pick<Tenant, "id" | "slug" | "name" | "status">;
  invitation: {
    status: string;
    invitedUserId: string;
  };
  membership: {
    ownerRole: string;
    memberRole: string;
    memberCount: number;
  };
  auth: {
    permission: string;
    allowed: boolean;
  };
  access: {
    object: string;
    relation: string;
    allowed: boolean;
  };
  billing: {
    checkoutUrl: string;
    subscriptionStatus: string;
  };
  metering: {
    meterId: string;
    recordedValue: number;
    currentUsage: number;
  };
  entitlement: Pick<
    EntitlementCheckResult,
    "featureKey" | "granted" | "quota" | "usage" | "remaining" | "planId"
  >;
  operations: {
    healthStatus: "up" | "down";
    diagnosticsSummary: "all_healthy" | "degraded" | "issues_detected";
  };
};

export function createSaasRuntime(): SaasRuntime {
  const eventPublisher = createDemoEventPublisher();

  const tenantStore = new InMemoryTenantStore();
  const tenantManager = new TenantManager();
  const membershipManager = new MembershipManager(new InMemoryMembershipStore(), eventPublisher);
  const invitationManager = new InvitationManager(
    new InMemoryInvitationStore(),
    membershipManager,
    new DemoNotificationService(),
    eventPublisher,
    new TxManager(new NoopTxAdapter()),
  );
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

  return {
    tenantStore,
    tenantManager,
    membershipManager,
    invitationManager,
    accessEngine,
    rbacEngine: new RbacEngine(roleRegistry),
    billingStore,
    billingService: new BillingService({
      store: billingStore,
      gateway: new DemoBillingGateway(),
      eventPublisher,
    }),
    meterRegistry,
    meteringService,
    entitlementManager: new EntitlementManager(
      entitlementRegistry,
      new StaticSubscriptionProvider(TEAM_PLAN_ID),
      new MeterQuotaChecker(usageStorage),
      new RegistryMeterLookup(meterRegistry),
    ),
    healthService,
    diagnosticsCollector,
  };
}

export const defaultSaasRuntime = createSaasRuntime();

export async function runSaasDemoFlow(
  runtime: SaasRuntime = createSaasRuntime(),
): Promise<SaasDemoSnapshot> {
  const ownerUserId = "user_owner";
  const invitedUserId = "user_member";
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
    const subscriptionStatus = await runtime.billingService.getSubscriptionStatus(tenant.id);

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
    };
  });
}

export function assertSaasDemoSnapshot(snapshot: SaasDemoSnapshot): void {
  const failures = [
    snapshot.tenant.status !== "trial" ? "tenant was not created in trial state" : undefined,
    snapshot.invitation.status !== "accepted" ? "invitation was not accepted" : undefined,
    snapshot.membership.memberCount < 2
      ? "owner and member memberships were not created"
      : undefined,
    !snapshot.auth.allowed ? "member RBAC permission check failed" : undefined,
    !snapshot.access.allowed ? "member access tuple check failed" : undefined,
    snapshot.billing.subscriptionStatus !== "active"
      ? "billing subscription is not active"
      : undefined,
    snapshot.metering.currentUsage !== 3 ? "usage was not recorded" : undefined,
    !snapshot.entitlement.granted ? "entitlement was not granted" : undefined,
    snapshot.operations.healthStatus !== "up" ? "health endpoint is not up" : undefined,
    snapshot.operations.diagnosticsSummary !== "all_healthy"
      ? "diagnostics summary is not healthy"
      : undefined,
  ].filter((failure): failure is string => failure !== undefined);

  if (failures.length > 0) {
    throw new SaasDemoSmokeProblem(failures);
  }
}

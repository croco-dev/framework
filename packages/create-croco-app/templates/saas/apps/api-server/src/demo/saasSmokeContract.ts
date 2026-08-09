import type { EntitlementCheckResult, EntitlementQuotaStatus } from "@croco/entitlements-core";
import { SaasDemoSmokeProblem } from "../problems";

export const SAAS_SMOKE_CONTRACT_VERSION = "saas-smoke-contract/v1";

export type SaasSmokeContract = {
  version: typeof SAAS_SMOKE_CONTRACT_VERSION;
  requiredProfile: "in-memory";
};

export const canonicalSaasSmokeContract = {
  version: SAAS_SMOKE_CONTRACT_VERSION,
  requiredProfile: "in-memory",
} satisfies SaasSmokeContract;

export type SaasDemoSnapshot = {
  contract: {
    version: typeof SAAS_SMOKE_CONTRACT_VERSION;
    providerProfile: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
  invitation: {
    status: string;
    invitedUserId: string;
  };
  membership: {
    ownerRole: string;
    memberRole: string;
    memberCount: number;
    seatLimit: EntitlementQuotaStatus & {
      failureCode: string;
      rejectedUserId: string;
    };
  };
  auth: {
    userId: string;
    sessionId: string;
    roles: readonly string[];
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
    entitlementPlanId: string | null;
    mockEvent: {
      eventId: string;
      eventType: string;
      externalSubscriptionId: string;
      planVersionRef: string;
      processedStatus: "completed";
      duplicateFailureCode: string;
    };
  };
  metering: {
    meterId: string;
    recordedValue: number;
    currentUsage: number;
  };
  billableUsage: {
    planVersionRef: string;
    journalDurability: "persistent";
    included: {
      eventId: string;
      value: number;
      recordOutcome: "recorded";
      deliveryOutcome: "accepted";
      delivery: {
        accepted: number;
        retryableFailed: number;
        terminalFailed: number;
      };
    };
    overage: {
      eventId: string;
      value: number;
      recordOutcome: "recorded";
      initialDeliveryOutcome: "retryable-failed";
      finalDeliveryOutcome: "accepted";
    };
    providerOutage: {
      delivery: {
        accepted: number;
        retryableFailed: number;
        terminalFailed: number;
      };
      failureCode: string;
      backlogCount: number;
      oldestPendingAgeMs: number | null;
    };
    recovery: {
      command: string;
      processBoundary: "separate-node-process";
      delivery: {
        accepted: number;
        retryableFailed: number;
        terminalFailed: number;
      };
    };
    replay: {
      eventId: string;
      outcome: "duplicate";
      providerAcceptedUsageBefore: number;
      providerAcceptedUsageAfter: number;
    };
    providerAcceptedUsage: number;
    finalConvergence: {
      delivery: {
        accepted: number;
        retryableFailed: number;
        terminalFailed: number;
      };
      backlogCount: number;
      oldestPendingAgeMs: number | null;
      retryCount: number;
      terminalFailureCount: number;
      converged: boolean;
    };
  };
  usageBillingReadModel: {
    localUsage: number;
    providerAcceptedUsage: number;
    usageDrift: number;
    backlogCount: number;
    oldestPendingAgeMs: number | null;
    retryCount: number;
    terminalFailureCount: number;
    recoveryCommand: string;
  };
  ai: {
    provider: string;
    modelId: string;
    responseText: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    promptUsage: number;
    promptQuota: number;
    quotaFailureCode: string;
  };
  entitlement: Pick<
    EntitlementCheckResult,
    | "featureKey"
    | "granted"
    | "quota"
    | "usage"
    | "remaining"
    | "planId"
    | "planVersionRef"
    | "overagePolicy"
  >;
  operations: {
    healthStatus: "up" | "down";
    diagnosticsSummary: "all_healthy" | "degraded" | "issues_detected";
  };
  jobs: {
    id: string;
    type: string;
    status: string;
    failurePolicyState: string;
    logCount: number;
  };
  lifecycle: {
    ruleId: string;
    firstRunStatus: string;
    duplicateRunStatus: string;
    duplicateSkipReason: string;
    emittedActionType: string;
    emittedActionCount: number;
    visibleRunCount: number;
  };
};

export function assertSaasSmokeContract(snapshot: SaasDemoSnapshot): void {
  const failures = [
    snapshot.contract.version !== canonicalSaasSmokeContract.version
      ? "smoke contract version mismatch"
      : undefined,
    snapshot.contract.providerProfile !== canonicalSaasSmokeContract.requiredProfile
      ? "smoke contract did not run against the in-memory profile"
      : undefined,
    snapshot.tenant.status !== "trial" ? "tenant was not created in trial state" : undefined,
    snapshot.invitation.status !== "accepted" ? "invitation was not accepted" : undefined,
    snapshot.membership.memberCount !== 2
      ? "owner and member memberships were not created"
      : undefined,
    snapshot.membership.seatLimit.quota !== 2
      ? "seat entitlement quota was not enforced"
      : undefined,
    snapshot.membership.seatLimit.usage !== 3
      ? "seat limit did not account for the rejected member"
      : undefined,
    snapshot.membership.seatLimit.exceeded !== true
      ? "seat limit failure was not captured"
      : undefined,
    snapshot.membership.seatLimit.failureCode !== "SEAT_LIMIT_EXCEEDED"
      ? "seat limit failure was not explicit"
      : undefined,
    !snapshot.auth.allowed ? "member RBAC permission check failed" : undefined,
    snapshot.auth.userId !== "user_member"
      ? "member auth user id was not deterministic"
      : undefined,
    snapshot.auth.sessionId !== "session_demo_member"
      ? "member session id was not deterministic"
      : undefined,
    !snapshot.auth.roles.includes("member") ? "member auth role was not captured" : undefined,
    !snapshot.access.allowed ? "member access tuple check failed" : undefined,
    !snapshot.billing.checkoutUrl.startsWith("https://billing.example.test/checkout/")
      ? "billing checkout URL was not created"
      : undefined,
    snapshot.billing.subscriptionStatus !== "active"
      ? "billing subscription is not active"
      : undefined,
    snapshot.billing.entitlementPlanId !== "team"
      ? "billing subscription did not sync the entitlement plan"
      : undefined,
    snapshot.billing.mockEvent.planVersionRef !== "team@v1"
      ? "billing subscription was not pinned to team@v1"
      : undefined,
    snapshot.billing.mockEvent.eventType !== "billing.subscription_activated"
      ? "billing mock event type was not explicit"
      : undefined,
    snapshot.billing.mockEvent.processedStatus !== "completed"
      ? "billing mock event was not completed"
      : undefined,
    snapshot.billing.mockEvent.duplicateFailureCode !== "billing/webhook-already-processed"
      ? "billing mock event replay failure was not explicit"
      : undefined,
    snapshot.metering.currentUsage !== 3 ? "usage was not recorded" : undefined,
    snapshot.entitlement.planVersionRef !== snapshot.billing.mockEvent.planVersionRef
      ? "entitlements did not use the subscription plan version"
      : undefined,
    snapshot.billableUsage.planVersionRef !== snapshot.billing.mockEvent.planVersionRef
      ? "billable usage did not retain the subscription plan version"
      : undefined,
    snapshot.billableUsage.journalDurability !== "persistent"
      ? "billable usage did not require a persistent journal"
      : undefined,
    snapshot.billableUsage.included.deliveryOutcome !== "accepted"
      ? "included usage was not accepted before overage"
      : undefined,
    snapshot.billableUsage.overage.initialDeliveryOutcome !== "retryable-failed"
      ? "provider outage was not retained as retryable pending overage"
      : undefined,
    snapshot.billableUsage.overage.finalDeliveryOutcome !== "accepted"
      ? "metered overage did not recover after provider restoration"
      : undefined,
    snapshot.billableUsage.recovery.processBoundary !== "separate-node-process"
      ? "billable overage recovery did not cross a Node process boundary"
      : undefined,
    snapshot.billableUsage.providerOutage.backlogCount !== 1
      ? "provider outage backlog was not observable"
      : undefined,
    snapshot.billableUsage.providerOutage.oldestPendingAgeMs !== 1000
      ? "provider outage backlog age was not deterministic"
      : undefined,
    snapshot.billableUsage.replay.outcome !== "duplicate"
      ? "accepted usage replay was not acknowledged as a duplicate"
      : undefined,
    snapshot.billableUsage.replay.providerAcceptedUsageBefore !==
    snapshot.billableUsage.replay.providerAcceptedUsageAfter
      ? "accepted usage replay changed provider usage"
      : undefined,
    snapshot.billableUsage.providerAcceptedUsage !== 3
      ? "provider accepted usage did not converge to included plus overage usage"
      : undefined,
    snapshot.usageBillingReadModel.localUsage !== snapshot.metering.currentUsage
      ? "usage billing read model did not retain local usage"
      : undefined,
    snapshot.usageBillingReadModel.providerAcceptedUsage !==
    snapshot.billableUsage.providerAcceptedUsage
      ? "usage billing read model did not retain provider accepted usage"
      : undefined,
    snapshot.usageBillingReadModel.usageDrift !== 0
      ? "usage billing read model did not converge local and provider usage"
      : undefined,
    !snapshot.billableUsage.finalConvergence.converged
      ? "billable usage did not converge after recovery"
      : undefined,
    snapshot.ai.provider !== "in-memory" ? "AI provider was not the demo provider" : undefined,
    snapshot.ai.modelId.length === 0 ? "AI model id was empty" : undefined,
    snapshot.ai.responseText.length === 0 ? "AI response text was empty" : undefined,
    snapshot.ai.promptTokens <= 0 ? "AI prompt tokens were not recorded" : undefined,
    snapshot.ai.completionTokens <= 0 ? "AI completion tokens were not recorded" : undefined,
    snapshot.ai.totalTokens !== snapshot.ai.promptTokens + snapshot.ai.completionTokens
      ? "AI total tokens do not match prompt plus completion tokens"
      : undefined,
    snapshot.ai.costUsd <= 0 ? "AI cost was not recorded" : undefined,
    snapshot.ai.promptUsage !== snapshot.ai.promptTokens
      ? "AI prompt usage did not match the recorded prompt meter"
      : undefined,
    snapshot.ai.promptQuota !== 50 ? "AI prompt quota was not enforced" : undefined,
    snapshot.ai.quotaFailureCode !== "llm-metering/quota-exceeded"
      ? "AI over-quota failure was not explicit"
      : undefined,
    !snapshot.entitlement.granted ? "entitlement was not granted" : undefined,
    snapshot.operations.healthStatus !== "up" ? "health endpoint is not up" : undefined,
    snapshot.operations.diagnosticsSummary !== "all_healthy"
      ? "diagnostics summary is not healthy"
      : undefined,
    snapshot.jobs.status !== "completed" ? "billing sync job did not complete" : undefined,
    snapshot.jobs.failurePolicyState !== "succeeded"
      ? "billing sync job is not inspectable as succeeded"
      : undefined,
    snapshot.jobs.logCount < 2 ? "billing sync job logs were not recorded" : undefined,
    snapshot.lifecycle.ruleId !== "saas-risk-onboarding-follow-up"
      ? "lifecycle risk rule did not match"
      : undefined,
    snapshot.lifecycle.firstRunStatus !== "succeeded"
      ? "lifecycle risk action did not succeed"
      : undefined,
    snapshot.lifecycle.duplicateRunStatus !== "skipped"
      ? "lifecycle duplicate event was not suppressed"
      : undefined,
    snapshot.lifecycle.duplicateSkipReason !== "idempotency_key_reused"
      ? "lifecycle duplicate event did not retain idempotency evidence"
      : undefined,
    snapshot.lifecycle.emittedActionType !== "cs.follow_up"
      ? "lifecycle action was not emitted to the CS follow-up sink"
      : undefined,
    snapshot.lifecycle.emittedActionCount !== 1
      ? "lifecycle action was not emitted exactly once"
      : undefined,
    snapshot.lifecycle.visibleRunCount < 2
      ? "lifecycle runs are not visible to diagnostics/store inspection"
      : undefined,
  ].filter((failure): failure is string => failure !== undefined);

  if (failures.length > 0) {
    throw new SaasDemoSmokeProblem(failures);
  }
}

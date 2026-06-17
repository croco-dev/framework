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
  jobs: {
    id: string;
    type: string;
    status: string;
    failurePolicyState: string;
    logCount: number;
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
    snapshot.metering.currentUsage !== 3 ? "usage was not recorded" : undefined,
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
  ].filter((failure): failure is string => failure !== undefined);

  if (failures.length > 0) {
    throw new SaasDemoSmokeProblem(failures);
  }
}

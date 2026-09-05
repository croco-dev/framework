import { Problem, ProblemCategory } from "@croco/problems-core";

import type { AdminProblemContract } from "./types";
import type { TenantWorkspaceExtension } from "./TenantWorkspace";

export const ENGAGEMENT_PERMISSIONS = {
  CUSTOMER_READ: "engagement:customer:read",
  PII_READ: "engagement:pii:read",
  MESSAGE_PREVIEW: "engagement:message:preview",
  MESSAGE_TEST_SEND: "engagement:message:test-send",
  AUDIENCE_READ: "engagement:audience:read",
  CAMPAIGN_RUN: "engagement:campaign:run",
  CAMPAIGN_CANCEL: "engagement:campaign:cancel",
  DELIVERY_READ: "engagement:delivery:read",
  SUPPRESSION_WRITE: "engagement:suppression:write",
  ENDPOINT_REACTIVATE: "engagement:endpoint:reactivate",
} as const;

export type EngagementPermission =
  (typeof ENGAGEMENT_PERMISSIONS)[keyof typeof ENGAGEMENT_PERMISSIONS];

export type EngagementChannel = "email" | "push";

export type RecipientRef = {
  readonly tenantId: string;
  readonly recipientId: string;
};

/** Reports an RFC 7807 validation failure in an engagement operations contract. */
export class EngagementOperationsValidationProblem extends Problem {
  constructor(field: string, reason: string, evidence: Readonly<Record<string, unknown>> = {}) {
    super(
      "admin-core/engagement-operations-validation-failed",
      ProblemCategory.ValidationError,
      `Engagement operation ${field} is invalid: ${reason}.`,
      { extensions: { field, ...evidence } },
    );
  }
}

/**
 * Masks an email address when PII read permission is missing.
 * E.g., user@example.com -> u***r@example.com.
 */
export function maskEmailAddress(email: string, hasPiiPermission: boolean): string {
  if (hasPiiPermission) {
    return email;
  }
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return "***";
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (local.length <= 1) {
    return `*${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}${domain}`;
}

/**
 * Masks a push notification token.
 * Push tokens are sensitive credentials and are NEVER shown in full under any permission.
 */
export function maskPushToken(token: string): string {
  if (!token || token.length <= 8) {
    return "push_***";
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export type EngagementEndpointSummary = {
  readonly id: string;
  readonly channel: EngagementChannel;
  readonly displayAddress: string;
  readonly rawAddress?: string;
  readonly status: "active" | "invalidated";
  readonly invalidationReason?: string;
  readonly invalidatedAt?: Date;
  readonly updatedAt: Date;
};

export type EngagementPreferenceSummary = {
  readonly topic: string;
  readonly channel: EngagementChannel;
  readonly decision: "allowed" | "unsubscribed" | "opted_out";
  readonly source: "explicit" | "default" | "inherited";
  readonly updatedAt?: Date;
};

export type EngagementSuppressionSummary = {
  readonly id: string;
  readonly channel?: EngagementChannel;
  readonly topic?: string;
  readonly reason: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
};

export type EngagementDispatchStatus =
  | "queued"
  | "accepted"
  | "suppressed"
  | "failed"
  | "skipped"
  | "delivered";

export type EngagementDispatchSummary = {
  readonly id: string;
  readonly tenantId: string;
  readonly recipientId: string;
  readonly messageId: string;
  readonly campaignId?: string;
  readonly channel: EngagementChannel;
  readonly status: EngagementDispatchStatus;
  readonly providerAccepted: boolean;
  readonly providerStatus?: string;
  readonly suppressionReason?: string;
  readonly failureReason?: string;
  readonly retryable: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type EngagementDeliveryEventType =
  | "accepted"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "token-invalid"
  | "failed";

export type EngagementDeliveryEventSummary = {
  readonly id: string;
  readonly dispatchId: string;
  readonly eventType: EngagementDeliveryEventType;
  readonly occurredAt: Date;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type EngagementAudienceMembershipSummary = {
  readonly audienceId: string;
  readonly audienceName: string;
  readonly snapshotId?: string;
  readonly snapshotCreatedAt?: Date;
  readonly campaignId?: string;
  readonly status: "included" | "suppressed" | "executed";
};

export type Customer360CommunicationState = {
  readonly recipient: RecipientRef;
  readonly identitySummary: {
    readonly displayName?: string;
    readonly externalId?: string;
  };
  readonly endpoints: readonly EngagementEndpointSummary[];
  readonly preferences: readonly EngagementPreferenceSummary[];
  readonly suppressions: readonly EngagementSuppressionSummary[];
  readonly recentSends: readonly EngagementDispatchSummary[];
  readonly deliveryEvents: readonly EngagementDeliveryEventSummary[];
  readonly audienceMemberships: readonly EngagementAudienceMembershipSummary[];
  readonly customFields?: Readonly<Record<string, string | number | boolean>>;
};

export type EngagementMessageDescriptorRow = {
  readonly id: string;
  readonly topic: string;
  readonly channels: readonly EngagementChannel[];
  readonly hasEmailRenderer: boolean;
  readonly hasPushRenderer: boolean;
  readonly description?: string;
};

export type EngagementMessagePreviewRequest = {
  readonly messageId: string;
  readonly channel: EngagementChannel;
  readonly mode: "fixture" | "recipient";
  readonly recipientId?: string;
  readonly data: Readonly<Record<string, unknown>>;
};

export type EngagementMessagePreviewResult = {
  readonly messageId: string;
  readonly channel: EngagementChannel;
  readonly subject?: string;
  readonly htmlContent?: string;
  readonly pushContent?: {
    readonly title: string;
    readonly body: string;
    readonly data?: Readonly<Record<string, string>>;
  };
  readonly renderedAt: Date;
};

export type EngagementTestSendRequest = {
  readonly messageId: string;
  readonly channel: EngagementChannel;
  readonly target:
    | { readonly type: "allowlisted-endpoint"; readonly endpoint: string }
    | { readonly type: "recipient"; readonly recipientId: string };
  readonly data: Readonly<Record<string, unknown>>;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type EngagementTestSendResult = {
  readonly dispatchId: string;
  readonly status: "accepted" | "delivered" | "failed" | "suppressed";
  readonly providerMessageId?: string;
  readonly dispatchedAt: Date;
  readonly auditEvidence: string;
};

export type EngagementAudienceDescriptorRow = {
  readonly id: string;
  readonly name: string;
  readonly scope: "tenant" | "global";
  readonly source: string;
  readonly estimatedSize?: number;
};

export type EngagementAudienceEstimateRequest = {
  readonly audienceId: string;
  readonly sampleLimit?: number;
};

export type EngagementAudienceEstimateResult = {
  readonly audienceId: string;
  readonly totalCount: number;
  readonly sampleRecipients: readonly {
    readonly recipientId: string;
    readonly maskedEmail?: string;
  }[];
  readonly isSampleBounded: true;
};

export type EngagementCampaignStatus =
  | "draft"
  | "snapshot_ready"
  | "scheduled"
  | "running"
  | "completed"
  | "canceled"
  | "failed";

export type EngagementCampaignProgressSummary = {
  readonly campaignId: string;
  readonly snapshotId: string;
  readonly total: number;
  readonly queued: number;
  readonly suppressed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly completed: number;
  readonly undispatchedCanceled?: number;
  readonly status: "pending" | "running" | "completed" | "canceled" | "failed";
  readonly failureEvidence?: readonly {
    readonly recipientId: string;
    readonly reason: string;
    readonly maskedTokenOrAddress?: string;
  }[];
};

export type EngagementCampaignDescriptorRow = {
  readonly id: string;
  readonly name: string;
  readonly audienceId: string;
  readonly messageId: string;
  readonly status: EngagementCampaignStatus;
  readonly currentSnapshotId?: string;
  readonly snapshotMemberCount?: number;
  readonly scheduledAt?: Date;
  readonly progress?: EngagementCampaignProgressSummary;
};

export type EngagementCampaignSnapshotRequest = {
  readonly campaignId: string;
  readonly audienceId: string;
  readonly actorId: string;
  readonly reason: string;
};

export type EngagementCampaignSnapshotResult = {
  readonly snapshotId: string;
  readonly campaignId: string;
  readonly memberCount: number;
  readonly isImmutable: true;
  readonly frozenAt: Date;
};

export type EngagementCampaignRunRequest = {
  readonly campaignId: string;
  readonly snapshotId: string;
  readonly schedule?: { readonly runAt: Date };
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type EngagementCampaignRunResult = {
  readonly campaignId: string;
  readonly snapshotId: string;
  readonly status: "running" | "scheduled";
  readonly startedAt: Date;
  readonly scheduledAt?: Date;
  readonly initialProgress: EngagementCampaignProgressSummary;
  readonly auditEvidence: string;
};

export type EngagementCampaignCancelRequest = {
  readonly campaignId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type EngagementCampaignCancelResult = {
  readonly campaignId: string;
  readonly undispatchedCanceled: number;
  readonly acceptedNotRecalledNotice: string;
  readonly canceledAt: Date;
  readonly auditEvidence: string;
};

export type EngagementDeliveryFilter = {
  readonly tenantId: string;
  readonly recipientId?: string;
  readonly messageId?: string;
  readonly campaignId?: string;
  readonly channel?: EngagementChannel;
  readonly status?: EngagementDispatchStatus;
  readonly from?: Date;
  readonly to?: Date;
};

export type EngagementCreateSuppressionRequest = {
  readonly tenantId: string;
  readonly recipientId: string;
  readonly channel?: EngagementChannel;
  readonly topic?: string;
  readonly reason: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
};

export type EngagementRemoveSuppressionRequest = {
  readonly tenantId: string;
  readonly suppressionId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
};

export type EngagementReactivateEndpointRequest = {
  readonly tenantId: string;
  readonly endpointId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
};

export type EngagementRetryDispatchRequest = {
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
};

export type EngagementOperationsSnapshot = {
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly customer360?: Customer360CommunicationState;
  readonly messages: readonly EngagementMessageDescriptorRow[];
  readonly audiences: readonly EngagementAudienceDescriptorRow[];
  readonly campaigns: readonly EngagementCampaignDescriptorRow[];
  readonly dispatches: readonly EngagementDispatchSummary[];
  readonly deliveryEvents: readonly EngagementDeliveryEventSummary[];
};

export type EngagementOperationsSourceResult =
  | { readonly kind: "empty"; readonly message?: string }
  | { readonly kind: "ready"; readonly snapshot: EngagementOperationsSnapshot }
  | { readonly kind: "problem"; readonly problem: AdminProblemContract };

export interface EngagementOperationsSource {
  readonly requiredPermissions: readonly string[];
  load(input: {
    readonly tenantId: string;
    readonly recipientId?: string;
    readonly filter?: EngagementDeliveryFilter;
    readonly signal?: AbortSignal;
  }): Promise<EngagementOperationsSourceResult>;
}

export type EngagementOperationsState =
  | { readonly kind: "loading"; readonly tenantId: string; readonly recipientId?: string }
  | { readonly kind: "empty"; readonly tenantId: string; readonly message?: string }
  | {
      readonly kind: "permission-denied";
      readonly tenantId: string;
      readonly requiredPermissions: readonly string[];
      readonly grantedPermissions: readonly string[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly tenantId: string;
      readonly problem: AdminProblemContract;
      readonly retryable?: boolean;
    }
  | {
      readonly kind: "ready";
      readonly tenantId: string;
      readonly snapshot: EngagementOperationsSnapshot;
      readonly grantedPermissions: readonly string[];
    };

export type EngagementOperationsReadyState = Extract<
  EngagementOperationsState,
  { readonly kind: "ready" }
>;

export function assertCampaignRunValid(
  request: EngagementCampaignRunRequest,
  campaign: EngagementCampaignDescriptorRow,
): void {
  if (!request.campaignId.trim()) {
    throw new EngagementOperationsValidationProblem("campaignId", "campaignId cannot be empty");
  }
  if (!request.actorId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "actorId",
      "actorId is required for audit evidence",
    );
  }
  if (!request.reason.trim()) {
    throw new EngagementOperationsValidationProblem(
      "reason",
      "reason is required for audit evidence",
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new EngagementOperationsValidationProblem(
      "idempotencyKey",
      "idempotencyKey is required for campaign execution",
    );
  }
  if (
    !request.snapshotId.trim() ||
    request.snapshotId !== campaign.currentSnapshotId ||
    typeof campaign.snapshotMemberCount !== "number" ||
    campaign.snapshotMemberCount <= 0
  ) {
    throw new EngagementOperationsValidationProblem(
      "snapshotId",
      "a campaign cannot start before a complete immutable snapshot exists with a positive member count",
      { campaignId: request.campaignId, snapshotId: request.snapshotId },
    );
  }
}

export function assertCampaignCancelValid(
  request: EngagementCampaignCancelRequest,
  _campaign?: EngagementCampaignDescriptorRow,
): void {
  if (!request.campaignId.trim()) {
    throw new EngagementOperationsValidationProblem("campaignId", "campaignId cannot be empty");
  }
  if (!request.actorId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "actorId",
      "actorId is required for audit evidence",
    );
  }
  if (!request.reason.trim()) {
    throw new EngagementOperationsValidationProblem(
      "reason",
      "reason is required for audit evidence",
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new EngagementOperationsValidationProblem(
      "idempotencyKey",
      "idempotencyKey is required for campaign cancellation",
    );
  }
}

export function assertRetryDispatchValid(dispatch: EngagementDispatchSummary): void {
  if (dispatch.status !== "failed" || !dispatch.retryable) {
    throw new EngagementOperationsValidationProblem(
      "dispatchId",
      "retry/replay controls appear only for explicitly safe, retryable outcomes",
      { dispatchId: dispatch.id, dispatchStatus: dispatch.status, retryable: dispatch.retryable },
    );
  }
}

export function assertCreateSuppressionValid(request: EngagementCreateSuppressionRequest): void {
  if (!request.tenantId.trim()) {
    throw new EngagementOperationsValidationProblem("tenantId", "tenantId is required");
  }
  if (!request.recipientId.trim()) {
    throw new EngagementOperationsValidationProblem("recipientId", "recipientId is required");
  }
  if (!request.reason.trim()) {
    throw new EngagementOperationsValidationProblem(
      "reason",
      "audit reason is required for suppression write",
    );
  }
  if (!request.actorId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "actorId",
      "actorId is required for suppression write",
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new EngagementOperationsValidationProblem("idempotencyKey", "idempotencyKey is required");
  }
}

export function assertRemoveSuppressionValid(request: EngagementRemoveSuppressionRequest): void {
  if (!request.tenantId.trim()) {
    throw new EngagementOperationsValidationProblem("tenantId", "tenantId is required");
  }
  if (!request.suppressionId.trim()) {
    throw new EngagementOperationsValidationProblem("suppressionId", "suppressionId is required");
  }
  if (!request.reason.trim()) {
    throw new EngagementOperationsValidationProblem(
      "reason",
      "audit reason is required for suppression removal",
    );
  }
  if (!request.actorId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "actorId",
      "actorId is required for suppression removal",
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new EngagementOperationsValidationProblem("idempotencyKey", "idempotencyKey is required");
  }
}

export function assertEndpointReactivateValid(request: EngagementReactivateEndpointRequest): void {
  if (!request.tenantId.trim()) {
    throw new EngagementOperationsValidationProblem("tenantId", "tenantId is required");
  }
  if (!request.endpointId.trim()) {
    throw new EngagementOperationsValidationProblem("endpointId", "endpointId is required");
  }
  if (!request.reason.trim()) {
    throw new EngagementOperationsValidationProblem(
      "reason",
      "audit reason is required for endpoint reactivation",
    );
  }
  if (!request.actorId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "actorId",
      "actorId is required for endpoint reactivation",
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new EngagementOperationsValidationProblem("idempotencyKey", "idempotencyKey is required");
  }
}

export const assertReactivateEndpointValid = assertEndpointReactivateValid;

export function assertTestSendValid(request: EngagementTestSendRequest): void {
  if (!request.messageId.trim()) {
    throw new EngagementOperationsValidationProblem("messageId", "messageId is required");
  }
  if (!request.actorId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "actorId",
      "actorId is required for test send audit",
    );
  }
  if (!request.reason.trim()) {
    throw new EngagementOperationsValidationProblem(
      "reason",
      "reason is required for test send audit",
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new EngagementOperationsValidationProblem("idempotencyKey", "idempotencyKey is required");
  }
  if (request.target.type === "allowlisted-endpoint" && !request.target.endpoint.trim()) {
    throw new EngagementOperationsValidationProblem(
      "target.endpoint",
      "endpoint is required for allowlisted target",
    );
  }
  if (request.target.type === "recipient" && !request.target.recipientId.trim()) {
    throw new EngagementOperationsValidationProblem(
      "target.recipientId",
      "recipientId is required for recipient target",
    );
  }
}

export function filterEngagementDispatches(
  dispatches: readonly EngagementDispatchSummary[],
  filter?: EngagementDeliveryFilter,
): readonly EngagementDispatchSummary[] {
  if (!filter) {
    return dispatches;
  }
  return dispatches.filter((dispatch) => {
    if (filter.tenantId && dispatch.tenantId !== filter.tenantId) {
      return false;
    }
    if (filter.recipientId && dispatch.recipientId !== filter.recipientId) {
      return false;
    }
    if (filter.messageId && dispatch.messageId !== filter.messageId) {
      return false;
    }
    if (filter.campaignId && dispatch.campaignId !== filter.campaignId) {
      return false;
    }
    if (filter.channel && dispatch.channel !== filter.channel) {
      return false;
    }
    if (filter.status && dispatch.status !== filter.status) {
      return false;
    }
    if (filter.from && dispatch.createdAt < filter.from) {
      return false;
    }
    if (filter.to && dispatch.createdAt > filter.to) {
      return false;
    }
    return true;
  });
}

export function createEngagementTenantExtension(input: {
  readonly state: Customer360CommunicationState | { readonly recipientCount: number };
  readonly label?: string;
}): TenantWorkspaceExtension {
  return {
    contractId: "engagement/customer-360",
    extensionId: "engagement",
    kind: "extension",
    label: input.label ?? "Customer communication",
    slot: "tab",
    state: input.state,
  };
}

export async function loadEngagementOperations(input: {
  readonly tenantId: string;
  readonly recipientId?: string;
  readonly filter?: EngagementDeliveryFilter;
  readonly grantedPermissions: readonly string[];
  readonly source: EngagementOperationsSource;
  readonly signal?: AbortSignal;
}): Promise<EngagementOperationsState> {
  const missing = input.source.requiredPermissions.filter(
    (permission) => !input.grantedPermissions.includes(permission),
  );
  if (missing.length > 0) {
    return {
      grantedPermissions: input.grantedPermissions,
      kind: "permission-denied",
      problem: {
        code: "admin-core/engagement-permission-denied",
        detail: `Missing required engagement permissions: ${missing.join(", ")}.`,
        retryable: false,
        status: 403,
        title: "Engagement operations permission denied",
      },
      requiredPermissions: missing,
      tenantId: input.tenantId,
    };
  }

  let result: EngagementOperationsSourceResult;
  try {
    result = await input.source.load({
      filter: input.filter,
      recipientId: input.recipientId,
      signal: input.signal,
      tenantId: input.tenantId,
    });
  } catch (caught) {
    if (input.signal?.aborted) {
      throw input.signal.reason ?? caught;
    }
    return {
      kind: "problem",
      problem: {
        code: "admin-core/engagement-operations-source-failed",
        detail:
          "The engagement operations source failed to load. Inspect server-side provider evidence.",
        retryable: true,
        status: 503,
        title: "Engagement operations unavailable",
      },
      retryable: true,
      tenantId: input.tenantId,
    };
  }

  if (result.kind === "empty") {
    return {
      kind: "empty",
      message: result.message,
      tenantId: input.tenantId,
    };
  }

  if (result.kind === "problem") {
    return {
      kind: "problem",
      problem: result.problem,
      retryable: result.problem.retryable ?? false,
      tenantId: input.tenantId,
    };
  }

  return {
    grantedPermissions: input.grantedPermissions,
    kind: "ready",
    snapshot: result.snapshot,
    tenantId: input.tenantId,
  };
}

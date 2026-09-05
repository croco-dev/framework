import { describe, expect, it } from "vitest";

import {
  assertCampaignCancelValid,
  assertCampaignRunValid,
  assertCreateSuppressionValid,
  assertEndpointReactivateValid,
  assertReactivateEndpointValid,
  assertRemoveSuppressionValid,
  assertRetryDispatchValid,
  assertTestSendValid,
  createEngagementTenantExtension,
  ENGAGEMENT_PERMISSIONS,
  EngagementOperationsValidationProblem,
  filterEngagementDispatches,
  loadEngagementOperations,
  maskEmailAddress,
  maskPushToken,
  type Customer360CommunicationState,
  type EngagementCampaignDescriptorRow,
  type EngagementDispatchSummary,
  type EngagementOperationsSnapshot,
  type EngagementOperationsSource,
} from "../index";

const now = new Date("2026-08-01T00:00:00.000Z");

describe("EngagementOperations (admin-core)", () => {
  describe("maskEmailAddress", () => {
    it("masks email when pii read permission is absent", () => {
      expect(maskEmailAddress("operator@croco.dev", false)).toBe("o***r@croco.dev");
      expect(maskEmailAddress("a@b.com", false)).toBe("*@b.com");
      expect(maskEmailAddress("ab@b.com", false)).toBe("a*@b.com");
      expect(maskEmailAddress("abc@b.com", false)).toBe("a***c@b.com");
    });

    it("returns full email when pii read permission is granted", () => {
      expect(maskEmailAddress("operator@croco.dev", true)).toBe("operator@croco.dev");
    });

    it("handles invalid email strings safely", () => {
      expect(maskEmailAddress("invalid-email", false)).toBe("***");
    });
  });

  describe("maskPushToken", () => {
    it("always masks push token, never revealing full token under any permission", () => {
      const fullToken = "fcm_token_super_secret_device_identifier_987654321";
      const masked = maskPushToken(fullToken);
      expect(masked).toBe("fcm_...4321");
      expect(masked).not.toContain("super_secret");
      expect(masked).not.toBe(fullToken);
    });

    it("handles short push tokens safely", () => {
      expect(maskPushToken("short")).toBe("push_***");
      expect(maskPushToken("")).toBe("push_***");
    });
  });

  describe("filterEngagementDispatches", () => {
    const dispatches: readonly EngagementDispatchSummary[] = [
      {
        id: "dispatch-1",
        tenantId: "tenant-1",
        recipientId: "recipient-1",
        messageId: "msg-welcome",
        campaignId: "camp-summer",
        channel: "email",
        status: "delivered",
        providerAccepted: true,
        retryable: false,
        createdAt: new Date("2026-08-01T10:00:00.000Z"),
        updatedAt: new Date("2026-08-01T10:01:00.000Z"),
      },
      {
        id: "dispatch-2",
        tenantId: "tenant-1",
        recipientId: "recipient-1",
        messageId: "msg-promo",
        channel: "push",
        status: "failed",
        providerAccepted: false,
        failureReason: "Connection timeout",
        retryable: true,
        createdAt: new Date("2026-08-01T11:00:00.000Z"),
        updatedAt: new Date("2026-08-01T11:00:30.000Z"),
      },
      {
        id: "dispatch-3",
        tenantId: "tenant-1",
        recipientId: "recipient-2",
        messageId: "msg-newsletter",
        channel: "email",
        status: "suppressed",
        providerAccepted: false,
        suppressionReason: "User unsubscribed",
        retryable: false,
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
        updatedAt: new Date("2026-08-01T12:00:00.000Z"),
      },
      {
        id: "dispatch-4",
        tenantId: "tenant-2",
        recipientId: "recipient-3",
        messageId: "msg-welcome",
        channel: "email",
        status: "queued",
        providerAccepted: false,
        retryable: false,
        createdAt: new Date("2026-08-01T13:00:00.000Z"),
        updatedAt: new Date("2026-08-01T13:00:00.000Z"),
      },
    ];

    it("filters dispatches by recipient", () => {
      const result = filterEngagementDispatches(dispatches, {
        tenantId: "tenant-1",
        recipientId: "recipient-1",
      });
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual(["dispatch-1", "dispatch-2"]);
    });

    it("filters dispatches by status", () => {
      const result = filterEngagementDispatches(dispatches, {
        tenantId: "tenant-1",
        status: "failed",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("dispatch-2");
    });

    it("filters dispatches by channel", () => {
      const result = filterEngagementDispatches(dispatches, {
        tenantId: "tenant-1",
        channel: "push",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("dispatch-2");
    });

    it("filters dispatches by date range", () => {
      const result = filterEngagementDispatches(dispatches, {
        tenantId: "tenant-1",
        from: new Date("2026-08-01T10:30:00.000Z"),
        to: new Date("2026-08-01T11:30:00.000Z"),
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("dispatch-2");
    });
  });

  describe("Campaign and Delivery Action Validation", () => {
    const campaign: EngagementCampaignDescriptorRow = {
      id: "camp-1",
      name: "Q3 Product Update",
      audienceId: "aud-active-users",
      messageId: "msg-q3",
      status: "snapshot_ready",
      currentSnapshotId: "snap-100",
      snapshotMemberCount: 1500,
    };

    it("prevents starting a campaign without a complete immutable snapshot", () => {
      expect(() => {
        assertCampaignRunValid(
          {
            campaignId: "camp-1",
            snapshotId: "snap-wrong",
            actorId: "operator-1",
            reason: "Launch campaign",
            idempotencyKey: "idem-1",
          },
          campaign,
        );
      }).toThrow(EngagementOperationsValidationProblem);

      const draftCampaign: EngagementCampaignDescriptorRow = {
        ...campaign,
        currentSnapshotId: undefined,
        snapshotMemberCount: undefined,
        status: "draft",
      };

      expect(() => {
        assertCampaignRunValid(
          {
            campaignId: "camp-1",
            snapshotId: "snap-100",
            actorId: "operator-1",
            reason: "Launch draft",
            idempotencyKey: "idem-2",
          },
          draftCampaign,
        );
      }).toThrow(EngagementOperationsValidationProblem);
    });

    it("allows starting a campaign when complete immutable snapshot exists and audit info is valid", () => {
      expect(() => {
        assertCampaignRunValid(
          {
            campaignId: "camp-1",
            snapshotId: "snap-100",
            actorId: "operator-1",
            reason: "Launch campaign",
            idempotencyKey: "idem-1",
          },
          campaign,
        );
      }).not.toThrow();
      expect(() => {
        assertCampaignRunValid(
          {
            campaignId: "camp-1",
            snapshotId: "snap-100",
            actorId: "operator-1",
            reason: "Launch campaign",
            idempotencyKey: "idem-1",
          },
          { ...campaign, snapshotMemberCount: -1 },
        );
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertCampaignRunValid(
          {
            campaignId: "camp-1",
            snapshotId: "snap-100",
            actorId: "operator-1",
            reason: "Launch campaign",
            idempotencyKey: "idem-1",
          },
          { ...campaign, snapshotMemberCount: 0 },
        );
      }).toThrow(EngagementOperationsValidationProblem);
    });

    it("validates campaign cancellation audit requirements", () => {
      expect(() => {
        assertCampaignCancelValid({
          campaignId: "",
          actorId: "operator-1",
          reason: "Cancel broadcast",
          idempotencyKey: "idem-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertCampaignCancelValid({
          campaignId: "camp-1",
          actorId: "",
          reason: "Cancel broadcast",
          idempotencyKey: "idem-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertCampaignCancelValid({
          campaignId: "camp-1",
          actorId: "operator-1",
          reason: "",
          idempotencyKey: "idem-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertCampaignCancelValid({
          campaignId: "camp-1",
          actorId: "operator-1",
          reason: "Cancel broadcast",
          idempotencyKey: "",
        });
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertCampaignCancelValid({
          campaignId: "camp-1",
          actorId: "operator-1",
          reason: "Cancel broadcast",
          idempotencyKey: "idem-1",
        });
      }).not.toThrow();
    });

    it("allows retry only for explicitly safe retryable outcomes", () => {
      const retryableDispatch: EngagementDispatchSummary = {
        id: "dispatch-fail",
        tenantId: "tenant-1",
        recipientId: "rec-1",
        messageId: "msg-1",
        channel: "email",
        status: "failed",
        providerAccepted: false,
        failureReason: "Provider 503 service unavailable",
        retryable: true,
        createdAt: now,
        updatedAt: now,
      };

      expect(() => assertRetryDispatchValid(retryableDispatch)).not.toThrow();

      const deliveredDispatch: EngagementDispatchSummary = {
        ...retryableDispatch,
        id: "dispatch-delivered",
        status: "delivered",
        providerAccepted: true,
        failureReason: undefined,
        retryable: false,
      };
      expect(() => assertRetryDispatchValid(deliveredDispatch)).toThrow(
        EngagementOperationsValidationProblem,
      );

      const deliveredRetryableDispatch: EngagementDispatchSummary = {
        ...retryableDispatch,
        id: "dispatch-delivered-retryable",
        status: "delivered",
        providerAccepted: true,
        failureReason: undefined,
        retryable: true,
      };
      expect(() => assertRetryDispatchValid(deliveredRetryableDispatch)).toThrow(
        EngagementOperationsValidationProblem,
      );

      const suppressedDispatch: EngagementDispatchSummary = {
        ...retryableDispatch,
        id: "dispatch-suppressed",
        status: "suppressed",
        retryable: false,
      };
      expect(() => assertRetryDispatchValid(suppressedDispatch)).toThrow(
        EngagementOperationsValidationProblem,
      );
    });

    it("validates suppression and endpoint override audit requirements", () => {
      expect(() => {
        assertCreateSuppressionValid({
          tenantId: "tenant-1",
          recipientId: "rec-1",
          reason: "",
          actorId: "operator-1",
          idempotencyKey: "idem-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertRemoveSuppressionValid({
          tenantId: "tenant-1",
          suppressionId: "sup-1",
          reason: "",
          actorId: "operator-1",
          idempotencyKey: "idem-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);

      expect(() => {
        assertReactivateEndpointValid({
          tenantId: "tenant-1",
          endpointId: "ep-1",
          reason: "",
          actorId: "operator-1",
          idempotencyKey: "idem-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);
    });

    it("validates test send audit requirements", () => {
      expect(() => {
        assertTestSendValid({
          messageId: "msg-1",
          channel: "email",
          target: { type: "allowlisted-endpoint", endpoint: "tester@croco.dev" },
          data: {},
          actorId: "",
          reason: "Preview verify",
          idempotencyKey: "test-send-1",
        });
      }).toThrow(EngagementOperationsValidationProblem);
    });
  });

  describe("createEngagementTenantExtension", () => {
    it("generates a tenant workspace extension with engagement/customer-360 contract", () => {
      const state: Customer360CommunicationState = {
        recipient: { tenantId: "tenant-1", recipientId: "rec-1" },
        identitySummary: { displayName: "Alice" },
        endpoints: [],
        preferences: [],
        suppressions: [],
        recentSends: [],
        deliveryEvents: [],
        audienceMemberships: [],
      };

      const ext = createEngagementTenantExtension({ state });
      expect(ext.contractId).toBe("engagement/customer-360");
      expect(ext.extensionId).toBe("engagement");
      expect(ext.kind).toBe("extension");
      expect(ext.slot).toBe("tab");
    });
  });

  describe("loadEngagementOperations", () => {
    const snapshot: EngagementOperationsSnapshot = {
      tenantId: "tenant-1",
      generatedAt: now,
      messages: [],
      audiences: [],
      campaigns: [],
      dispatches: [],
      deliveryEvents: [],
    };

    const mockSource: EngagementOperationsSource = {
      requiredPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
      load: async () => ({ kind: "ready", snapshot }),
    };

    it("returns permission-denied when caller lacks required permissions", async () => {
      const state = await loadEngagementOperations({
        tenantId: "tenant-1",
        grantedPermissions: [],
        source: mockSource,
      });

      expect(state.kind).toBe("permission-denied");
      if (state.kind === "permission-denied") {
        expect(state.requiredPermissions).toContain(ENGAGEMENT_PERMISSIONS.CUSTOMER_READ);
      }
    });

    it("returns ready state with snapshot when permissions are satisfied", async () => {
      const state = await loadEngagementOperations({
        tenantId: "tenant-1",
        grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
        source: mockSource,
      });

      expect(state.kind).toBe("ready");
      if (state.kind === "ready") {
        expect(state.snapshot.tenantId).toBe("tenant-1");
      }
    });

    it("returns problem state when source reports problem", async () => {
      const failingSource: EngagementOperationsSource = {
        requiredPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
        load: async () => ({
          kind: "problem",
          problem: {
            code: "engagement/store-unavailable",
            detail: "Database unreachable",
            retryable: true,
          },
        }),
      };

      const state = await loadEngagementOperations({
        tenantId: "tenant-1",
        grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
        source: failingSource,
      });

      expect(state.kind).toBe("problem");
      if (state.kind === "problem") {
        expect(state.problem.code).toBe("engagement/store-unavailable");
        expect(state.retryable).toBe(true);
      }
    });

    it("catches thrown source errors and returns recoverable problem state", async () => {
      const throwingSource: EngagementOperationsSource = {
        requiredPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
        load: async () => {
          throw new Error("Network timeout connecting to engagement store");
        },
      };

      const state = await loadEngagementOperations({
        tenantId: "tenant-1",
        grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
        source: throwingSource,
      });

      expect(state.kind).toBe("problem");
      if (state.kind === "problem") {
        expect(state.problem.code).toBe("admin-core/engagement-operations-source-failed");
        expect(state.retryable).toBe(true);
      }
    });
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ENGAGEMENT_PERMISSIONS,
  type EngagementDispatchSummary,
  type EngagementOperationsSnapshot,
  type EngagementOperationsState,
} from "@croco/admin-core";
import {
  AudienceCampaignOperationsPanel,
  Customer360CommunicationPanel,
  DeliveryOperationsPanel,
  EngagementOperationsConsole,
  MessageOperationsPanel,
} from "../index";

const now = new Date("2026-08-01T12:00:00.000Z");

const sampleSnapshot: EngagementOperationsSnapshot = {
  audiences: [
    {
      estimatedSize: 5000,
      id: "aud-active",
      name: "Active Subscribers",
      scope: "tenant",
      source: "segmentation-query",
    },
  ],
  campaigns: [
    {
      audienceId: "aud-active",
      currentSnapshotId: "snap-100",
      id: "camp-summer",
      messageId: "msg-promo",
      name: "Summer Promo",
      progress: {
        campaignId: "camp-summer",
        completed: 1200,
        failed: 10,
        failureEvidence: [
          {
            maskedTokenOrAddress: "fcm_...1234",
            reason: "Token expired",
            recipientId: "rec-fail-1",
          },
        ],
        queued: 50,
        skipped: 5,
        snapshotId: "snap-100",
        status: "running",
        suppressed: 35,
        total: 1300,
        undispatchedCanceled: 0,
      },
      snapshotMemberCount: 1300,
      status: "running",
    },
    {
      audienceId: "aud-active",
      id: "camp-draft",
      messageId: "msg-welcome",
      name: "Draft Welcome Campaign",
      status: "draft",
    },
  ],
  customer360: {
    audienceMemberships: [
      {
        audienceId: "aud-active",
        audienceName: "Active Subscribers",
        campaignId: "camp-summer",
        snapshotId: "snap-100",
        status: "included",
      },
    ],
    customFields: {
      accountTier: "enterprise",
      lifetimeValue: 1500,
    },
    deliveryEvents: [
      {
        dispatchId: "disp-deliv",
        eventType: "delivered",
        id: "evt-1",
        occurredAt: now,
      },
      {
        dispatchId: "disp-fail",
        eventType: "bounced",
        id: "evt-2",
        occurredAt: now,
      },
    ],
    endpoints: [
      {
        channel: "email",
        displayAddress: "user@example.com",
        id: "ep-email-1",
        rawAddress: "user@example.com",
        status: "active",
        updatedAt: now,
      },
      {
        channel: "push",
        displayAddress: "fcm_token_super_secret_secret_1234567890",
        id: "ep-push-1",
        rawAddress: "fcm_token_super_secret_secret_1234567890",
        status: "invalidated",
        invalidationReason: "Unregistered device token",
        invalidatedAt: now,
        updatedAt: now,
      },
    ],
    identitySummary: {
      displayName: "Alice Explorer",
      externalId: "ext-usr-42",
    },
    preferences: [
      {
        channel: "email",
        decision: "allowed",
        source: "explicit",
        topic: "marketing",
        updatedAt: now,
      },
      {
        channel: "push",
        decision: "opted_out",
        source: "explicit",
        topic: "newsletter",
        updatedAt: now,
      },
    ],
    recipient: {
      recipientId: "rec-alice",
      tenantId: "tenant-acme",
    },
    recentSends: [
      {
        channel: "email",
        createdAt: now,
        id: "disp-deliv",
        messageId: "msg-promo",
        providerAccepted: true,
        recipientId: "rec-alice",
        retryable: false,
        status: "delivered",
        tenantId: "tenant-acme",
        updatedAt: now,
      },
      {
        channel: "email",
        createdAt: now,
        failureReason: "Provider 503 Service Unavailable",
        id: "disp-fail",
        messageId: "msg-alert",
        providerAccepted: false,
        recipientId: "rec-alice",
        retryable: true,
        status: "failed",
        tenantId: "tenant-acme",
        updatedAt: now,
      },
      {
        channel: "email",
        createdAt: now,
        id: "disp-supp",
        messageId: "msg-weekly",
        providerAccepted: false,
        recipientId: "rec-alice",
        retryable: false,
        status: "suppressed",
        suppressionReason: "Topic newsletter opted out",
        tenantId: "tenant-acme",
        updatedAt: now,
      },
    ],
    suppressions: [
      {
        active: true,
        channel: "push",
        createdAt: now,
        id: "sup-1",
        reason: "Repeated bounces",
        topic: "newsletter",
      },
    ],
  },
  deliveryEvents: [
    {
      dispatchId: "disp-deliv",
      eventType: "delivered",
      id: "evt-1",
      occurredAt: now,
    },
  ],
  dispatches: [
    {
      channel: "email",
      createdAt: now,
      id: "disp-deliv",
      messageId: "msg-promo",
      providerAccepted: true,
      recipientId: "rec-alice",
      retryable: false,
      status: "delivered",
      tenantId: "tenant-acme",
      updatedAt: now,
    },
    {
      channel: "email",
      createdAt: now,
      failureReason: "Provider 503 Service Unavailable",
      id: "disp-fail",
      messageId: "msg-alert",
      providerAccepted: false,
      recipientId: "rec-alice",
      retryable: true,
      status: "failed",
      tenantId: "tenant-acme",
      updatedAt: now,
    },
  ],
  generatedAt: now,
  messages: [
    {
      channels: ["email", "push"],
      description: "Promotional announcement with discount",
      hasEmailRenderer: true,
      hasPushRenderer: true,
      id: "msg-promo",
      topic: "marketing",
    },
  ],
  tenantId: "tenant-acme",
};

describe("EngagementOperationsConsole", () => {
  it("renders loading state accessibly with aria-busy", () => {
    const loadingState: EngagementOperationsState = {
      kind: "loading",
      tenantId: "tenant-acme",
    };

    const markup = renderToStaticMarkup(
      createElement(EngagementOperationsConsole, { state: loadingState }),
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('data-state="loading"');
    expect(markup).toContain("Loading engagement operations");
  });

  it("renders empty state accessibly", () => {
    const emptyState: EngagementOperationsState = {
      kind: "empty",
      message: "No engagement data configured for this tenant.",
      tenantId: "tenant-acme",
    };

    const markup = renderToStaticMarkup(
      createElement(EngagementOperationsConsole, { state: emptyState }),
    );
    expect(markup).toContain('data-state="empty"');
    expect(markup).toContain("No engagement data configured");
  });

  it("renders permission-denied state with role alert and missing permissions", () => {
    const deniedState: EngagementOperationsState = {
      grantedPermissions: [],
      kind: "permission-denied",
      problem: {
        code: "engagement-denied",
        detail: "Caller lacks engagement:customer:read",
        status: 403,
      },
      requiredPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
      tenantId: "tenant-acme",
    };

    const markup = renderToStaticMarkup(
      createElement(EngagementOperationsConsole, { state: deniedState }),
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-state="permission-denied"');
    expect(markup).toContain("engagement:customer:read");
  });

  it("renders problem state with role alert and retry button", () => {
    const onRefresh = vi.fn();
    const problemState: EngagementOperationsState = {
      kind: "problem",
      problem: {
        code: "store-unavailable",
        detail: "Failed to contact engagement store",
        status: 503,
      },
      retryable: true,
      tenantId: "tenant-acme",
    };

    const markup = renderToStaticMarkup(
      createElement(EngagementOperationsConsole, { onRefresh, state: problemState }),
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-state="problem"');
    expect(markup).toContain("Problem store-unavailable");
    expect(markup).toContain("Retry loading operations");
  });

  it("renders ready state with navigation tabs for all engagement sections", () => {
    const readyState: EngagementOperationsState = {
      grantedPermissions: Object.values(ENGAGEMENT_PERMISSIONS),
      kind: "ready",
      snapshot: sampleSnapshot,
      tenantId: "tenant-acme",
    };

    const markup = renderToStaticMarkup(
      createElement(EngagementOperationsConsole, { state: readyState }),
    );
    expect(markup).toContain('data-state="ready"');
    expect(markup).toContain("Tenant: tenant-acme");
    expect(markup).toContain("Customer 360");
    expect(markup).toContain("Messages");
    expect(markup).toContain("Audiences &amp; Campaigns");
    expect(markup).toContain("Deliveries");
  });

  describe("Customer360CommunicationPanel", () => {
    it("masks email without engagement:pii:read and always masks push token under all permissions", () => {
      const markupWithoutPii = renderToStaticMarkup(
        createElement(Customer360CommunicationPanel, {
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.CUSTOMER_READ,
            ENGAGEMENT_PERMISSIONS.ENDPOINT_REACTIVATE,
          ],
          state: sampleSnapshot.customer360,
          tenantId: "tenant-acme",
        }),
      );

      // Email should be masked without pii read permission
      expect(markupWithoutPii).toContain("u***r@example.com");
      expect(markupWithoutPii).not.toContain("user@example.com");

      // Push token should ALWAYS be masked!
      expect(markupWithoutPii).toContain("fcm_...7890");
      expect(markupWithoutPii).not.toContain("super_secret_secret");

      const markupWithPii = renderToStaticMarkup(
        createElement(Customer360CommunicationPanel, {
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.CUSTOMER_READ,
            ENGAGEMENT_PERMISSIONS.PII_READ,
          ],
          state: sampleSnapshot.customer360,
          tenantId: "tenant-acme",
        }),
      );

      // Email unmasked when pii:read is granted
      expect(markupWithPii).toContain("user@example.com");

      // Push token MUST STILL BE MASKED even with pii:read permission!
      expect(markupWithPii).toContain("fcm_...7890");
      expect(markupWithPii).not.toContain("super_secret_secret");
    });

    it("displays custom customer fields adapter output", () => {
      const markup = renderToStaticMarkup(
        createElement(Customer360CommunicationPanel, {
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
          state: sampleSnapshot.customer360,
          tenantId: "tenant-acme",
        }),
      );

      expect(markup).toContain("accountTier");
      expect(markup).toContain("enterprise");
      expect(markup).toContain("lifetimeValue");
      expect(markup).toContain("1500");
    });

    it("explains why each recent message was queued, suppressed, failed, or delivered", () => {
      const markup = renderToStaticMarkup(
        createElement(Customer360CommunicationPanel, {
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
          state: sampleSnapshot.customer360,
          tenantId: "tenant-acme",
        }),
      );

      // Delivered
      expect(markup).toContain("delivered");
      expect(markup).toContain("Accepted");

      // Failed with reason
      expect(markup).toContain("failed");
      expect(markup).toContain("Provider 503 Service Unavailable");

      // Suppressed with reason
      expect(markup).toContain("suppressed");
      expect(markup).toContain("Topic newsletter opted out");
    });

    it("enables retry button only for failed retryable dispatches and disables for non-retryable outcomes", () => {
      const markup = renderToStaticMarkup(
        createElement(Customer360CommunicationPanel, {
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
          state: sampleSnapshot.customer360,
          tenantId: "tenant-acme",
        }),
      );

      // Retry controls should be disabled for delivered or suppressed dispatches
      expect(markup).toContain("Retry controls appear only for explicitly safe retryable outcomes");
    });

    it("lists preferences, suppressions, delivery events, and audience memberships", () => {
      const markup = renderToStaticMarkup(
        createElement(Customer360CommunicationPanel, {
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.CUSTOMER_READ],
          state: sampleSnapshot.customer360,
          tenantId: "tenant-acme",
        }),
      );

      expect(markup).toContain("marketing");
      expect(markup).toContain("newsletter");
      expect(markup).toContain("Repeated bounces");
      expect(markup).toContain("DELIVERED");
      expect(markup).toContain("Active Subscribers");
    });
  });

  describe("MessageOperationsPanel", () => {
    it("renders registered message descriptors table", () => {
      const markup = renderToStaticMarkup(
        createElement(MessageOperationsPanel, {
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW],
          messages: sampleSnapshot.messages,
        }),
      );

      expect(markup).toContain("msg-promo");
      expect(markup).toContain("marketing");
      expect(markup).toContain("email, push");
      expect(markup).toContain("Available");
    });

    it("renders email preview in an isolated iframe with sandbox and push preview in neutral surface", () => {
      const markup = renderToStaticMarkup(
        createElement(MessageOperationsPanel, {
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW,
            ENGAGEMENT_PERMISSIONS.MESSAGE_TEST_SEND,
          ],
          messages: sampleSnapshot.messages,
          previewResult: {
            channel: "email",
            htmlContent: "<h1>Summer Sale 50% Off</h1><p>Enjoy your summer</p>",
            messageId: "msg-promo",
            renderedAt: now,
            subject: "Summer Sale!",
          },
          selectedMessageId: "msg-promo",
        }),
      );

      expect(markup).toContain("iframe");
      expect(markup).toContain('sandbox=""');
      expect(markup).toContain("Summer Sale!");

      const pushMarkup = renderToStaticMarkup(
        createElement(MessageOperationsPanel, {
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW],
          messages: sampleSnapshot.messages,
          previewResult: {
            channel: "push",
            messageId: "msg-promo",
            pushContent: {
              body: "50% off everything today only",
              title: "Summer Flash Sale",
            },
            renderedAt: now,
          },
          selectedMessageId: "msg-promo",
        }),
      );

      expect(pushMarkup).toContain('data-testid="push-preview-surface"');
      expect(pushMarkup).toContain("Summer Flash Sale");
      expect(pushMarkup).toContain("50% off everything today only");
    });

    it("renders audited test send form requiring actor and reason", () => {
      const markup = renderToStaticMarkup(
        createElement(MessageOperationsPanel, {
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW,
            ENGAGEMENT_PERMISSIONS.MESSAGE_TEST_SEND,
          ],
          messages: sampleSnapshot.messages,
          selectedMessageId: "msg-promo",
        }),
      );

      expect(markup).toContain("Audited test send");
      expect(markup).toContain("Audit reason for test send");
      expect(markup).toContain("Send test message");
    });
  });

  describe("AudienceCampaignOperationsPanel", () => {
    it("renders bounded audience estimate results explaining complete audience is not materialized", () => {
      const markup = renderToStaticMarkup(
        createElement(AudienceCampaignOperationsPanel, {
          audienceEstimateResult: {
            audienceId: "aud-active",
            isSampleBounded: true,
            sampleRecipients: [
              { maskedEmail: "u***1@croco.dev", recipientId: "rec-1" },
              { maskedEmail: "u***2@croco.dev", recipientId: "rec-2" },
            ],
            totalCount: 5000,
          },
          audiences: sampleSnapshot.audiences,
          campaigns: sampleSnapshot.campaigns,
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.AUDIENCE_READ,
            ENGAGEMENT_PERMISSIONS.CAMPAIGN_RUN,
          ],
        }),
      );

      expect(markup).toContain("Total estimated count: 5000");
      expect(markup).toContain("full audience cannot be materialized in browser");
      expect(markup).toContain("rec-1");
      expect(markup).toContain("u***1@croco.dev");
    });

    it("prevents starting a campaign before a complete immutable snapshot exists", () => {
      const markup = renderToStaticMarkup(
        createElement(AudienceCampaignOperationsPanel, {
          audiences: sampleSnapshot.audiences,
          campaigns: sampleSnapshot.campaigns,
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.CAMPAIGN_RUN],
          selectedCampaignId: "camp-draft",
        }),
      );

      expect(markup).toContain(
        "A campaign cannot start before a complete immutable snapshot exists",
      );
      expect(markup).toContain("Create immutable snapshot");
    });

    it("displays campaign execution progress and cancellation semantics", () => {
      const markup = renderToStaticMarkup(
        createElement(AudienceCampaignOperationsPanel, {
          audiences: sampleSnapshot.audiences,
          campaigns: sampleSnapshot.campaigns,
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.CAMPAIGN_RUN,
            ENGAGEMENT_PERMISSIONS.CAMPAIGN_CANCEL,
          ],
          selectedCampaignId: "camp-summer",
        }),
      );

      expect(markup).toContain("Progress: RUNNING");
      expect(markup).toContain("1200"); // completed
      expect(markup).toContain("10"); // failed
      expect(markup).toContain("Cancel undispatched work");
      expect(markup).toContain(
        "Accepted notifications are already with downstream providers and are not recalled",
      );
      expect(markup).toContain("fcm_...1234"); // protected token
    });
  });

  describe("DeliveryOperationsPanel", () => {
    it("renders filtered dispatches and distinguishes provider acceptance from delivery status", () => {
      const markup = renderToStaticMarkup(
        createElement(DeliveryOperationsPanel, {
          deliveryEvents: sampleSnapshot.deliveryEvents,
          dispatches: sampleSnapshot.dispatches,
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.DELIVERY_READ],
        }),
      );

      expect(markup).toContain("disp-deliv");
      expect(markup).toContain("disp-fail");
      expect(markup).toContain("Accepted");
      expect(markup).toContain("Not accepted");
      expect(markup).toContain("Provider 503 Service Unavailable");
    });

    it("displays providerStatus when failure and suppression reasons are absent", () => {
      const queuedDispatch: EngagementDispatchSummary = {
        id: "disp-queued-1",
        tenantId: "tenant-acme",
        recipientId: "rec-1",
        messageId: "msg-welcome",
        channel: "email",
        status: "queued",
        providerAccepted: true,
        providerStatus: "queued_at_sendgrid_gateway",
        retryable: false,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      };

      const markup = renderToStaticMarkup(
        createElement(DeliveryOperationsPanel, {
          deliveryEvents: [],
          dispatches: [queuedDispatch],
          grantedPermissions: [ENGAGEMENT_PERMISSIONS.DELIVERY_READ],
        }),
      );

      expect(markup).toContain("queued_at_sendgrid_gateway");
    });
  });

  describe("MessageOperationsPanel channel restrictions", () => {
    it("renders only configured channels for the selected message", () => {
      const pushOnlyMessage = {
        channels: ["push" as const],
        description: "Promotional push alert",
        hasEmailRenderer: false,
        hasPushRenderer: true,
        id: "msg-push-only",
        topic: "promotions",
      };

      const markup = renderToStaticMarkup(
        createElement(MessageOperationsPanel, {
          grantedPermissions: [
            ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW,
            ENGAGEMENT_PERMISSIONS.MESSAGE_TEST_SEND,
          ],
          messages: [pushOnlyMessage],
          selectedMessageId: "msg-push-only",
        }),
      );

      expect(markup).toContain('value="push"');
      expect(markup).not.toContain('value="email"');
    });
  });
});

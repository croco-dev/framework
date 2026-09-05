import {
  ENGAGEMENT_PERMISSIONS,
  type EngagementAudienceEstimateRequest,
  type EngagementAudienceEstimateResult,
  type EngagementCampaignCancelRequest,
  type EngagementCampaignRunRequest,
  type EngagementCampaignSnapshotRequest,
  type EngagementCreateSuppressionRequest,
  type EngagementMessagePreviewRequest,
  type EngagementMessagePreviewResult,
  type EngagementOperationsReadyState,
  type EngagementReactivateEndpointRequest,
  type EngagementRemoveSuppressionRequest,
  type EngagementRetryDispatchRequest,
  type EngagementTestSendRequest,
  type EngagementTestSendResult,
} from "@croco/admin-core";
import { EngagementOperationsConsole } from "@croco/admin-react";
import { useState } from "react";

const generatedAt = new Date("2026-08-01T10:00:00.000Z");

export function EngagementOperationsDemo({ tenantId }: { readonly tenantId: string }) {
  const [selectedRecipientId, setSelectedRecipientId] = useState("rec_operator_demo");
  const [lastAction, setLastAction] = useState("No engagement mutation requested.");
  const [previewResult, setPreviewResult] = useState<EngagementMessagePreviewResult | undefined>();
  const [testSendResult, setTestSendResult] = useState<EngagementTestSendResult | undefined>();
  const [estimateResult, setEstimateResult] = useState<
    EngagementAudienceEstimateResult | undefined
  >();

  function handleCancelCampaign(req: EngagementCampaignCancelRequest) {
    setLastAction(
      `Campaign ${req.campaignId} canceled: accepted notifications not recalled; audit ${req.reason}`,
    );
  }

  function handleCreateSnapshot(req: EngagementCampaignSnapshotRequest) {
    setLastAction(`Snapshot for campaign ${req.campaignId} created: immutable membership frozen.`);
  }

  function handleCreateSuppression(req: EngagementCreateSuppressionRequest) {
    setLastAction(`Suppression added for recipient ${req.recipientId}: reason ${req.reason}`);
  }

  function handleEstimateAudience(req: EngagementAudienceEstimateRequest) {
    setEstimateResult({
      audienceId: req.audienceId,
      isSampleBounded: true,
      sampleRecipients: [
        { maskedEmail: "u***1@example.test", recipientId: "rec_sample_1" },
        { maskedEmail: "u***2@example.test", recipientId: "rec_sample_2" },
      ],
      totalCount: 2450,
    });
    setLastAction(`Estimated audience ${req.audienceId}: total 2450 (bounded sample returned).`);
  }

  function handlePreviewMessage(req: EngagementMessagePreviewRequest) {
    setPreviewResult({
      channel: req.channel,
      htmlContent: "<h1>Welcome to Croco SaaS</h1><p>Your subscription is active.</p>",
      messageId: req.messageId,
      pushContent: {
        body: "Your workspace is ready to explore.",
        title: "Welcome aboard!",
      },
      renderedAt: new Date(),
      subject: "Welcome to your new workspace",
    });
    setLastAction(`Preview generated for message ${req.messageId} on channel ${req.channel}`);
  }

  function handleReactivateEndpoint(req: EngagementReactivateEndpointRequest) {
    setLastAction(`Endpoint ${req.endpointId} reactivated: audit reason ${req.reason}`);
  }

  function handleRemoveSuppression(req: EngagementRemoveSuppressionRequest) {
    setLastAction(`Suppression ${req.suppressionId} removed: audit reason ${req.reason}`);
  }

  function handleRetryDispatch(req: EngagementRetryDispatchRequest) {
    setLastAction(
      `Safe retry triggered for dispatch ${req.dispatchId}: idempotency ${req.idempotencyKey}`,
    );
  }

  function handleRunCampaign(req: EngagementCampaignRunRequest) {
    setLastAction(
      `Campaign ${req.campaignId} started broadcast from immutable snapshot ${req.snapshotId}`,
    );
  }

  function handleTestSend(req: EngagementTestSendRequest) {
    setTestSendResult({
      auditEvidence: `actor=${req.actorId};reason=${req.reason}`,
      dispatchedAt: new Date(),
      dispatchId: `disp_test_${Date.now()}`,
      status: "accepted",
    });
    setLastAction(`Audited test send dispatched for message ${req.messageId}`);
  }

  const state: EngagementOperationsReadyState = {
    grantedPermissions: [
      ENGAGEMENT_PERMISSIONS.CUSTOMER_READ,
      ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW,
      ENGAGEMENT_PERMISSIONS.MESSAGE_TEST_SEND,
      ENGAGEMENT_PERMISSIONS.AUDIENCE_READ,
      ENGAGEMENT_PERMISSIONS.CAMPAIGN_RUN,
      ENGAGEMENT_PERMISSIONS.CAMPAIGN_CANCEL,
      ENGAGEMENT_PERMISSIONS.DELIVERY_READ,
      ENGAGEMENT_PERMISSIONS.SUPPRESSION_WRITE,
      ENGAGEMENT_PERMISSIONS.ENDPOINT_REACTIVATE,
    ],
    kind: "ready",
    snapshot: {
      audiences: [
        {
          estimatedSize: 2450,
          id: "aud_active_subscribers",
          name: "Active Subscribers",
          scope: "tenant",
          source: "drizzle-query",
        },
      ],
      campaigns: [
        {
          audienceId: "aud_active_subscribers",
          currentSnapshotId: "snap_frozen_v1",
          id: "camp_autumn_digest",
          messageId: "msg_welcome",
          name: "Autumn Digest Broadcast",
          progress: {
            campaignId: "camp_autumn_digest",
            completed: 2400,
            failed: 5,
            failureEvidence: [
              {
                maskedTokenOrAddress: "push_...9876",
                reason: "Token unregistered",
                recipientId: "rec_inactive_1",
              },
            ],
            queued: 10,
            skipped: 15,
            snapshotId: "snap_frozen_v1",
            status: "running",
            suppressed: 20,
            total: 2450,
            undispatchedCanceled: 0,
          },
          snapshotMemberCount: 2450,
          status: "running",
        },
      ],
      customer360: {
        audienceMemberships: [
          {
            audienceId: "aud_active_subscribers",
            audienceName: "Active Subscribers",
            campaignId: "camp_autumn_digest",
            snapshotId: "snap_frozen_v1",
            status: "included",
          },
        ],
        customFields: {
          accountPlan: "Enterprise SaaS",
          contractRenewal: "2027-01-01",
        },
        deliveryEvents: [
          {
            dispatchId: "disp_demo_delivered",
            eventType: "delivered",
            id: "evt_deliv_1",
            occurredAt: generatedAt,
          },
        ],
        endpoints: [
          {
            channel: "email",
            displayAddress: "operator@example.test",
            id: "ep_email_demo",
            rawAddress: "operator@example.test",
            status: "active",
            updatedAt: generatedAt,
          },
          {
            channel: "push",
            displayAddress: "fcm_token_device_demo_super_secret_987654321",
            id: "ep_push_demo",
            rawAddress: "fcm_token_device_demo_super_secret_987654321",
            status: "invalidated",
            invalidationReason: "Device unregistered",
            invalidatedAt: generatedAt,
            updatedAt: generatedAt,
          },
        ],
        identitySummary: {
          displayName: "Demo Recipient",
          externalId: "ext_usr_demo",
        },
        preferences: [
          {
            channel: "email",
            decision: "allowed",
            source: "explicit",
            topic: "product_updates",
            updatedAt: generatedAt,
          },
        ],
        recipient: {
          recipientId: selectedRecipientId,
          tenantId,
        },
        recentSends: [
          {
            channel: "email",
            createdAt: generatedAt,
            id: "disp_demo_delivered",
            messageId: "msg_welcome",
            providerAccepted: true,
            recipientId: selectedRecipientId,
            retryable: false,
            status: "delivered",
            tenantId,
            updatedAt: generatedAt,
          },
          {
            channel: "push",
            createdAt: generatedAt,
            failureReason: "503 Service Unavailable upstream provider",
            id: "disp_demo_failed",
            messageId: "msg_flash_alert",
            providerAccepted: false,
            recipientId: selectedRecipientId,
            retryable: true,
            status: "failed",
            tenantId,
            updatedAt: generatedAt,
          },
        ],
        suppressions: [
          {
            active: true,
            channel: "push",
            createdAt: generatedAt,
            id: "sup_demo_1",
            reason: "Excessive push bounces",
            topic: "promotions",
          },
        ],
      },
      deliveryEvents: [
        {
          dispatchId: "disp_demo_delivered",
          eventType: "delivered",
          id: "evt_deliv_1",
          occurredAt: generatedAt,
        },
      ],
      dispatches: [
        {
          channel: "email",
          createdAt: generatedAt,
          id: "disp_demo_delivered",
          messageId: "msg_welcome",
          providerAccepted: true,
          recipientId: selectedRecipientId,
          retryable: false,
          status: "delivered",
          tenantId,
          updatedAt: generatedAt,
        },
        {
          channel: "push",
          createdAt: generatedAt,
          failureReason: "503 Service Unavailable upstream provider",
          id: "disp_demo_failed",
          messageId: "msg_flash_alert",
          providerAccepted: false,
          recipientId: selectedRecipientId,
          retryable: true,
          status: "failed",
          tenantId,
          updatedAt: generatedAt,
        },
      ],
      generatedAt,
      messages: [
        {
          channels: ["email", "push"],
          description: "Standard product welcome and onboarding message",
          hasEmailRenderer: true,
          hasPushRenderer: true,
          id: "msg_welcome",
          topic: "product_updates",
        },
      ],
      tenantId,
    },
    tenantId,
  };

  const deliveryFilter = { tenantId };

  return (
    <section aria-label="Tenant-scoped engagement operations">
      <EngagementOperationsConsole
        audienceEstimateResult={estimateResult}
        filter={deliveryFilter}
        onCancelCampaign={handleCancelCampaign}
        onCreateSnapshot={handleCreateSnapshot}
        onCreateSuppression={handleCreateSuppression}
        onEstimateAudience={handleEstimateAudience}
        onPreviewMessage={handlePreviewMessage}
        onReactivateEndpoint={handleReactivateEndpoint}
        onRemoveSuppression={handleRemoveSuppression}
        onRetryDispatch={handleRetryDispatch}
        onRunCampaign={handleRunCampaign}
        onSelectRecipient={setSelectedRecipientId}
        onTestSend={handleTestSend}
        previewResult={previewResult}
        selectedRecipientId={selectedRecipientId}
        state={state}
        testSendResult={testSendResult}
      />
      <output aria-live="polite">{lastAction}</output>
    </section>
  );
}

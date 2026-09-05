import {
  createElement,
  Fragment,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  useState,
} from "react";
import {
  assertCampaignCancelValid,
  assertCampaignRunValid,
  assertCreateSuppressionValid,
  assertEndpointReactivateValid,
  assertRemoveSuppressionValid,
  assertRetryDispatchValid,
  assertTestSendValid,
  ENGAGEMENT_PERMISSIONS,
  filterEngagementDispatches,
  maskEmailAddress,
  maskPushToken,
} from "@croco/admin-core";
import type {
  Customer360CommunicationState,
  EngagementAudienceDescriptorRow,
  EngagementAudienceEstimateRequest,
  EngagementAudienceEstimateResult,
  EngagementCampaignCancelRequest,
  EngagementCampaignDescriptorRow,
  EngagementCampaignProgressSummary,
  EngagementCampaignRunRequest,
  EngagementCampaignSnapshotRequest,
  EngagementChannel,
  EngagementCreateSuppressionRequest,
  EngagementDeliveryEventSummary,
  EngagementDeliveryFilter,
  EngagementDispatchSummary,
  EngagementMessageDescriptorRow,
  EngagementMessagePreviewRequest,
  EngagementMessagePreviewResult,
  EngagementOperationsState,
  EngagementReactivateEndpointRequest,
  EngagementRemoveSuppressionRequest,
  EngagementRetryDispatchRequest,
  EngagementTestSendRequest,
  EngagementTestSendResult,
} from "@croco/admin-core";

export type EngagementConsoleSection = "customer-360" | "messages" | "campaigns" | "deliveries";

export type EngagementOperationsConsoleProps = {
  readonly state: EngagementOperationsState;
  readonly activeSection?: EngagementConsoleSection;
  readonly onSectionChange?: (section: EngagementConsoleSection) => void;
  readonly selectedRecipientId?: string;
  readonly onSelectRecipient?: (recipientId: string) => void;
  readonly filter?: EngagementDeliveryFilter;
  readonly onFilterChange?: (filter: EngagementDeliveryFilter) => void;
  readonly selectedMessageId?: string;
  readonly onSelectMessage?: (messageId: string) => void;
  readonly selectedCampaignId?: string;
  readonly onSelectCampaign?: (campaignId: string) => void;
  readonly previewResult?: EngagementMessagePreviewResult;
  readonly testSendResult?: EngagementTestSendResult;
  readonly audienceEstimateResult?: EngagementAudienceEstimateResult;
  readonly onPreviewMessage?: (request: EngagementMessagePreviewRequest) => void;
  readonly onTestSend?: (request: EngagementTestSendRequest) => void;
  readonly onEstimateAudience?: (request: EngagementAudienceEstimateRequest) => void;
  readonly onCreateSnapshot?: (request: EngagementCampaignSnapshotRequest) => void;
  readonly onRunCampaign?: (request: EngagementCampaignRunRequest) => void;
  readonly onCancelCampaign?: (request: EngagementCampaignCancelRequest) => void;
  readonly onCreateSuppression?: (request: EngagementCreateSuppressionRequest) => void;
  readonly onRemoveSuppression?: (request: EngagementRemoveSuppressionRequest) => void;
  readonly onReactivateEndpoint?: (request: EngagementReactivateEndpointRequest) => void;
  readonly onRetryDispatch?: (request: EngagementRetryDispatchRequest) => void;
  readonly onRefresh?: () => void;
};

export function EngagementOperationsConsole({
  activeSection,
  audienceEstimateResult,
  filter,
  onCancelCampaign,
  onCreateSnapshot,
  onCreateSuppression,
  onEstimateAudience,
  onFilterChange,
  onPreviewMessage,
  onReactivateEndpoint,
  onRefresh,
  onRemoveSuppression,
  onRetryDispatch,
  onRunCampaign,
  onSectionChange,
  onSelectCampaign,
  onSelectMessage,
  onSelectRecipient,
  onTestSend,
  previewResult,
  selectedCampaignId,
  selectedMessageId,
  selectedRecipientId,
  state,
  testSendResult,
}: EngagementOperationsConsoleProps): ReactElement {
  const [internalSection, setInternalSection] = useState<EngagementConsoleSection>("customer-360");
  const currentSection = activeSection ?? internalSection;

  const changeSection = (section: EngagementConsoleSection) => {
    if (activeSection === undefined) {
      setInternalSection(section);
    }
    onSectionChange?.(section);
  };

  if (state.kind === "loading") {
    return createElement(
      "section",
      {
        "aria-busy": true,
        "aria-label": "Engagement operations console",
        "data-state": "loading",
      },
      createElement("h1", null, "Engagement operations"),
      createElement("p", null, "Loading engagement operations"),
    );
  }

  if (state.kind === "empty") {
    return createElement(
      "section",
      {
        "aria-label": "Engagement operations console",
        "data-state": "empty",
      },
      createElement("h1", null, "Engagement operations"),
      createElement(
        "p",
        null,
        state.message ?? "No engagement records configured for this tenant.",
      ),
    );
  }

  if (state.kind === "permission-denied") {
    return createElement(
      "section",
      {
        "aria-label": "Engagement operations console",
        "data-state": "permission-denied",
        role: "alert",
      },
      createElement("h1", null, state.problem.title ?? "Engagement operations permission denied"),
      createElement("p", null, state.problem.detail),
      createElement("p", null, `Required permissions: ${state.requiredPermissions.join(", ")}`),
      createElement("p", null, `Granted permissions: ${state.grantedPermissions.join(", ")}`),
    );
  }

  if (state.kind === "problem") {
    return createElement(
      "section",
      {
        "aria-label": "Engagement operations console",
        "data-state": "problem",
        role: "alert",
      },
      createElement("h1", null, state.problem.title ?? "Engagement operations problem"),
      createElement(
        "p",
        null,
        `Problem ${state.problem.code}: ${state.problem.detail ?? state.problem.title}`,
      ),
      state.retryable && onRefresh
        ? createElement(
            "button",
            { onClick: onRefresh, type: "button" },
            "Retry loading operations",
          )
        : null,
    );
  }

  const { snapshot, tenantId, grantedPermissions } = state;

  return createElement(
    "section",
    {
      "aria-label": "Engagement operations console",
      "data-state": "ready",
      "data-tenant-id": tenantId,
    },
    createElement(
      "header",
      null,
      createElement("h1", null, "Engagement operations"),
      createElement("p", null, `Tenant: ${tenantId}`),
      createElement(
        "nav",
        { "aria-label": "Engagement console sections" },
        createElement(
          "button",
          {
            "aria-current": currentSection === "customer-360" ? "page" : undefined,
            onClick: () => changeSection("customer-360"),
            type: "button",
          },
          "Customer 360",
        ),
        createElement(
          "button",
          {
            "aria-current": currentSection === "messages" ? "page" : undefined,
            onClick: () => changeSection("messages"),
            type: "button",
          },
          "Messages",
        ),
        createElement(
          "button",
          {
            "aria-current": currentSection === "campaigns" ? "page" : undefined,
            onClick: () => changeSection("campaigns"),
            type: "button",
          },
          "Audiences & Campaigns",
        ),
        createElement(
          "button",
          {
            "aria-current": currentSection === "deliveries" ? "page" : undefined,
            onClick: () => changeSection("deliveries"),
            type: "button",
          },
          "Deliveries",
        ),
      ),
    ),
    currentSection === "customer-360"
      ? createElement(Customer360CommunicationPanel, {
          grantedPermissions,
          onCreateSuppression,
          onReactivateEndpoint,
          onRemoveSuppression,
          onRetryDispatch,
          onSelectRecipient,
          selectedRecipientId,
          state: snapshot.customer360,
          tenantId,
        })
      : null,
    currentSection === "messages"
      ? createElement(MessageOperationsPanel, {
          grantedPermissions,
          messages: snapshot.messages,
          onPreviewMessage,
          onSelectMessage,
          onTestSend,
          previewResult,
          selectedMessageId,
          testSendResult,
        })
      : null,
    currentSection === "campaigns"
      ? createElement(AudienceCampaignOperationsPanel, {
          audienceEstimateResult,
          audiences: snapshot.audiences,
          campaigns: snapshot.campaigns,
          grantedPermissions,
          onCancelCampaign,
          onCreateSnapshot,
          onEstimateAudience,
          onRunCampaign,
          onSelectCampaign,
          selectedCampaignId,
        })
      : null,
    currentSection === "deliveries"
      ? createElement(DeliveryOperationsPanel, {
          deliveryEvents: snapshot.deliveryEvents,
          dispatches: snapshot.dispatches,
          filter,
          grantedPermissions,
          onFilterChange,
          onRetryDispatch,
        })
      : null,
  );
}

export type Customer360CommunicationPanelProps = {
  readonly state?: Customer360CommunicationState;
  readonly tenantId: string;
  readonly grantedPermissions: readonly string[];
  readonly selectedRecipientId?: string;
  readonly onSelectRecipient?: (recipientId: string) => void;
  readonly onReactivateEndpoint?: (request: EngagementReactivateEndpointRequest) => void;
  readonly onCreateSuppression?: (request: EngagementCreateSuppressionRequest) => void;
  readonly onRemoveSuppression?: (request: EngagementRemoveSuppressionRequest) => void;
  readonly onRetryDispatch?: (request: EngagementRetryDispatchRequest) => void;
};

export function Customer360CommunicationPanel({
  grantedPermissions,
  onCreateSuppression,
  onReactivateEndpoint,
  onRemoveSuppression,
  onRetryDispatch,
  onSelectRecipient,
  selectedRecipientId,
  state,
  tenantId,
}: Customer360CommunicationPanelProps): ReactElement {
  const [recipientInput, setRecipientInput] = useState(selectedRecipientId ?? "");
  const [suppressionReason, setSuppressionReason] = useState("");
  const [suppressionChannel, setSuppressionChannel] = useState<EngagementChannel | "">("");
  const [reactivateReason] = useState("Operator requested endpoint reactivation");

  const hasPiiPermission = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.PII_READ);
  const canWriteSuppression = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.SUPPRESSION_WRITE);
  const canReactivateEndpoint = grantedPermissions.includes(
    ENGAGEMENT_PERMISSIONS.ENDPOINT_REACTIVATE,
  );

  const handleRecipientSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (recipientInput.trim()) {
      onSelectRecipient?.(recipientInput.trim());
    }
  };

  const handleCreateSuppression = (e: FormEvent) => {
    e.preventDefault();
    if (!state || !suppressionReason.trim()) return;
    const req: EngagementCreateSuppressionRequest = {
      actorId: "operator",
      channel: suppressionChannel ? suppressionChannel : undefined,
      idempotencyKey: `sup-create-${state.recipient.recipientId}-${Date.now()}`,
      reason: suppressionReason.trim(),
      recipientId: state.recipient.recipientId,
      tenantId,
    };
    assertCreateSuppressionValid(req);
    onCreateSuppression?.(req);
    setSuppressionReason("");
  };

  return createElement(
    "section",
    {
      "aria-label": "Customer 360 communication",
      "data-testid": "customer-360-panel",
    },
    createElement("h2", null, "Customer 360 communication"),
    createElement(
      "form",
      {
        "aria-label": "Recipient search",
        onSubmit: handleRecipientSubmit,
      },
      createElement("label", { htmlFor: "recipient-id-input" }, "Recipient ID"),
      createElement("input", {
        id: "recipient-id-input",
        onChange: (e: ChangeEvent<HTMLInputElement>) => setRecipientInput(e.target.value),
        placeholder: "Enter recipient ID",
        type: "text",
        value: recipientInput,
      }),
      createElement("button", { type: "submit" }, "Find recipient"),
    ),
    !state
      ? createElement(
          "p",
          { "data-state": "empty" },
          "Enter a recipient ID to inspect communication state.",
        )
      : createElement(
          Fragment,
          null,
          createElement(
            "section",
            { "aria-label": "Identity summary", "data-testid": "customer-identity-summary" },
            createElement("h3", null, "Identity summary"),
            createElement("p", null, `Recipient: ${state.recipient.recipientId}`),
            state.identitySummary.displayName
              ? createElement("p", null, `Name: ${state.identitySummary.displayName}`)
              : null,
            state.identitySummary.externalId
              ? createElement("p", null, `External ID: ${state.identitySummary.externalId}`)
              : null,
            state.customFields && Object.keys(state.customFields).length > 0
              ? createElement(
                  "dl",
                  { "aria-label": "Custom customer fields" },
                  Object.entries(state.customFields).map(([k, v]) =>
                    createElement(
                      Fragment,
                      { key: k },
                      createElement("dt", null, k),
                      createElement("dd", null, String(v)),
                    ),
                  ),
                )
              : null,
          ),
          createElement(
            "section",
            { "aria-label": "Endpoints" },
            createElement("h3", null, "Communication endpoints"),
            state.endpoints.length === 0
              ? createElement("p", { "data-state": "empty" }, "No endpoints registered.")
              : createElement(
                  "ul",
                  null,
                  state.endpoints.map((ep) => {
                    const maskedAddress =
                      ep.channel === "push"
                        ? maskPushToken(ep.rawAddress ?? ep.displayAddress)
                        : maskEmailAddress(ep.rawAddress ?? ep.displayAddress, hasPiiPermission);

                    return createElement(
                      "li",
                      { key: ep.id },
                      createElement("strong", null, `${ep.channel.toUpperCase()}: `),
                      createElement(
                        "span",
                        { "data-testid": `endpoint-address-${ep.id}` },
                        maskedAddress,
                      ),
                      createElement("span", null, ` · Status: ${ep.status}`),
                      ep.invalidationReason
                        ? createElement("p", null, `Invalidation reason: ${ep.invalidationReason}`)
                        : null,
                      ep.status === "invalidated"
                        ? createElement(
                            "button",
                            {
                              disabled: !canReactivateEndpoint,
                              onClick: () => {
                                const req: EngagementReactivateEndpointRequest = {
                                  actorId: "operator",
                                  endpointId: ep.id,
                                  idempotencyKey: `reactivate-${ep.id}-${Date.now()}`,
                                  reason: reactivateReason,
                                  tenantId,
                                };
                                assertEndpointReactivateValid(req);
                                onReactivateEndpoint?.(req);
                              },
                              title: canReactivateEndpoint
                                ? "Reactivate invalidated endpoint"
                                : "Missing permission: engagement:endpoint:reactivate",
                              type: "button",
                            },
                            "Reactivate endpoint",
                          )
                        : null,
                    );
                  }),
                ),
          ),
          createElement(
            "section",
            { "aria-label": "Topic preferences" },
            createElement("h3", null, "Preferences"),
            state.preferences.length === 0
              ? createElement("p", { "data-state": "empty" }, "No preferences recorded.")
              : createElement(
                  "table",
                  null,
                  createElement(
                    "thead",
                    null,
                    createElement(
                      "tr",
                      null,
                      createElement("th", { scope: "col" }, "Topic"),
                      createElement("th", { scope: "col" }, "Channel"),
                      createElement("th", { scope: "col" }, "Decision"),
                      createElement("th", { scope: "col" }, "Source"),
                    ),
                  ),
                  createElement(
                    "tbody",
                    null,
                    state.preferences.map((pref) =>
                      createElement(
                        "tr",
                        { key: `${pref.topic}:${pref.channel}` },
                        createElement("td", null, pref.topic),
                        createElement("td", null, pref.channel),
                        createElement("td", null, pref.decision),
                        createElement("td", null, pref.source),
                      ),
                    ),
                  ),
                ),
          ),
          createElement(
            "section",
            { "aria-label": "Active suppressions" },
            createElement("h3", null, "Suppressions"),
            state.suppressions.length === 0
              ? createElement(
                  "p",
                  { "data-state": "empty" },
                  "No active suppressions for this recipient.",
                )
              : createElement(
                  "ul",
                  null,
                  state.suppressions.map((sup) =>
                    createElement(
                      "li",
                      { key: sup.id },
                      createElement(
                        "span",
                        null,
                        `${sup.reason} (Topic: ${sup.topic ?? "all"}, Channel: ${sup.channel ?? "all"})`,
                      ),
                      sup.active
                        ? createElement(
                            "button",
                            {
                              disabled: !canWriteSuppression,
                              onClick: () => {
                                const req: EngagementRemoveSuppressionRequest = {
                                  actorId: "operator",
                                  idempotencyKey: `sup-remove-${sup.id}-${Date.now()}`,
                                  reason: "Operator removed suppression",
                                  suppressionId: sup.id,
                                  tenantId,
                                };
                                assertRemoveSuppressionValid(req);
                                onRemoveSuppression?.(req);
                              },
                              title: canWriteSuppression
                                ? "Remove suppression"
                                : "Missing permission: engagement:suppression:write",
                              type: "button",
                            },
                            "Remove suppression",
                          )
                        : null,
                    ),
                  ),
                ),
            createElement(
              "form",
              {
                "aria-label": "Add suppression",
                onSubmit: handleCreateSuppression,
              },
              createElement("h4", null, "Create manual suppression"),
              createElement("input", {
                onChange: (e: ChangeEvent<HTMLInputElement>) =>
                  setSuppressionReason(e.target.value),
                placeholder: "Suppression reason",
                required: true,
                type: "text",
                value: suppressionReason,
              }),
              createElement(
                "select",
                {
                  onChange: (e: ChangeEvent<HTMLSelectElement>) =>
                    setSuppressionChannel(e.target.value as EngagementChannel | ""),
                  value: suppressionChannel,
                },
                createElement("option", { value: "" }, "All channels"),
                createElement("option", { value: "email" }, "Email"),
                createElement("option", { value: "push" }, "Push"),
              ),
              createElement(
                "button",
                {
                  disabled: !canWriteSuppression || !suppressionReason.trim(),
                  title: canWriteSuppression
                    ? "Apply suppression"
                    : "Missing permission: engagement:suppression:write",
                  type: "submit",
                },
                "Apply suppression",
              ),
            ),
          ),
          createElement(
            "section",
            { "aria-label": "Recent sends" },
            createElement("h3", null, "Recent logical sends and outcomes"),
            state.recentSends.length === 0
              ? createElement("p", { "data-state": "empty" }, "No recent message sends.")
              : createElement(
                  "table",
                  null,
                  createElement(
                    "thead",
                    null,
                    createElement(
                      "tr",
                      null,
                      createElement("th", { scope: "col" }, "Message"),
                      createElement("th", { scope: "col" }, "Channel"),
                      createElement("th", { scope: "col" }, "Status"),
                      createElement("th", { scope: "col" }, "Provider Accepted"),
                      createElement("th", { scope: "col" }, "Reason / Problem"),
                      createElement("th", { scope: "col" }, "Actions"),
                    ),
                  ),
                  createElement(
                    "tbody",
                    null,
                    state.recentSends.map((send) => {
                      const isRetryable = send.status === "failed" && send.retryable;
                      return createElement(
                        "tr",
                        { key: send.id },
                        createElement("td", null, send.messageId),
                        createElement("td", null, send.channel),
                        createElement("td", null, send.status),
                        createElement(
                          "td",
                          null,
                          send.providerAccepted ? "Accepted" : "Not accepted",
                        ),
                        createElement(
                          "td",
                          null,
                          send.failureReason ??
                            send.suppressionReason ??
                            send.providerStatus ??
                            "None",
                        ),
                        createElement(
                          "td",
                          null,
                          createElement(
                            "button",
                            {
                              disabled: !isRetryable,
                              onClick: () => {
                                assertRetryDispatchValid(send);
                                onRetryDispatch?.({
                                  actorId: "operator",
                                  dispatchId: send.id,
                                  idempotencyKey: `retry-${send.id}-${Date.now()}`,
                                  reason: "Operator triggered safe retry",
                                  tenantId,
                                });
                              },
                              title: isRetryable
                                ? "Retry failed dispatch"
                                : "Retry controls appear only for explicitly safe retryable outcomes",
                              type: "button",
                            },
                            "Retry",
                          ),
                        ),
                      );
                    }),
                  ),
                ),
          ),
          createElement(
            "section",
            { "aria-label": "Normalized delivery events" },
            createElement("h3", null, "Normalized delivery events"),
            state.deliveryEvents.length === 0
              ? createElement("p", { "data-state": "empty" }, "No delivery events recorded.")
              : createElement(
                  "ol",
                  null,
                  state.deliveryEvents.map((evt) =>
                    createElement(
                      "li",
                      { key: evt.id },
                      createElement("strong", null, `${evt.eventType.toUpperCase()}`),
                      createElement(
                        "span",
                        null,
                        ` at ${evt.occurredAt.toISOString()} (Dispatch: ${evt.dispatchId})`,
                      ),
                    ),
                  ),
                ),
          ),
          createElement(
            "section",
            { "aria-label": "Audience memberships" },
            createElement("h3", null, "Audience memberships and campaigns"),
            state.audienceMemberships.length === 0
              ? createElement("p", { "data-state": "empty" }, "No audience memberships found.")
              : createElement(
                  "ul",
                  null,
                  state.audienceMemberships.map((m) =>
                    createElement(
                      "li",
                      { key: `${m.audienceId}:${m.snapshotId ?? "live"}` },
                      `${m.audienceName} (${m.audienceId}) · Snapshot: ${m.snapshotId ?? "none"} · Status: ${m.status}`,
                    ),
                  ),
                ),
          ),
        ),
  );
}

export type MessageOperationsPanelProps = {
  readonly messages: readonly EngagementMessageDescriptorRow[];
  readonly selectedMessageId?: string;
  readonly onSelectMessage?: (messageId: string) => void;
  readonly previewResult?: EngagementMessagePreviewResult;
  readonly testSendResult?: EngagementTestSendResult;
  readonly onPreviewMessage?: (request: EngagementMessagePreviewRequest) => void;
  readonly onTestSend?: (request: EngagementTestSendRequest) => void;
  readonly grantedPermissions: readonly string[];
};

export function MessageOperationsPanel({
  grantedPermissions,
  messages,
  onPreviewMessage,
  onSelectMessage,
  onTestSend,
  previewResult,
  selectedMessageId,
  testSendResult,
}: MessageOperationsPanelProps): ReactElement {
  const selectedMessage = messages.find((m) => m.id === selectedMessageId) ?? messages[0];
  const availableChannels: readonly EngagementChannel[] =
    selectedMessage && selectedMessage.channels.length > 0
      ? selectedMessage.channels
      : (["email", "push"] as const);
  const [channel, setChannel] = useState<EngagementChannel>(availableChannels[0] ?? "email");
  const activeChannel = availableChannels.includes(channel)
    ? channel
    : (availableChannels[0] ?? "email");
  const [mode, setMode] = useState<"fixture" | "recipient">("fixture");
  const [recipientId, setRecipientId] = useState("");
  const [testTargetType, setTestTargetType] = useState<"allowlisted-endpoint" | "recipient">(
    "allowlisted-endpoint",
  );
  const [testEndpoint, setTestEndpoint] = useState("");
  const [testRecipientId, setTestRecipientId] = useState("");
  const [testReason, setTestReason] = useState("Operator verification test send");

  const canPreview = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.MESSAGE_PREVIEW);
  const canTestSend = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.MESSAGE_TEST_SEND);

  const handlePreview = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMessage) return;
    onPreviewMessage?.({
      channel: activeChannel,
      data: {},
      messageId: selectedMessage.id,
      mode,
      recipientId: mode === "recipient" ? recipientId : undefined,
    });
  };

  const handleTestSend = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMessage) return;
    const req: EngagementTestSendRequest = {
      actorId: "operator",
      channel: activeChannel,
      data: {},
      idempotencyKey: `test-send-${selectedMessage.id}-${Date.now()}`,
      messageId: selectedMessage.id,
      reason: testReason,
      target:
        testTargetType === "allowlisted-endpoint"
          ? { endpoint: testEndpoint, type: "allowlisted-endpoint" }
          : { recipientId: testRecipientId, type: "recipient" },
    };
    assertTestSendValid(req);
    onTestSend?.(req);
  };

  return createElement(
    "section",
    {
      "aria-label": "Message operations",
      "data-testid": "message-operations-panel",
    },
    createElement("h2", null, "Message descriptors and previews"),
    messages.length === 0
      ? createElement(
          "p",
          { "data-state": "empty" },
          "No registered messages in engagement registry.",
        )
      : createElement(
          "table",
          { "aria-label": "Registered messages" },
          createElement(
            "thead",
            null,
            createElement(
              "tr",
              null,
              createElement("th", { scope: "col" }, "Message ID"),
              createElement("th", { scope: "col" }, "Topic"),
              createElement("th", { scope: "col" }, "Channels"),
              createElement("th", { scope: "col" }, "Email Renderer"),
              createElement("th", { scope: "col" }, "Push Renderer"),
              createElement("th", { scope: "col" }, "Select"),
            ),
          ),
          createElement(
            "tbody",
            null,
            messages.map((msg) =>
              createElement(
                "tr",
                { key: msg.id },
                createElement("td", null, msg.id),
                createElement("td", null, msg.topic),
                createElement("td", null, msg.channels.join(", ")),
                createElement("td", null, msg.hasEmailRenderer ? "Available" : "None"),
                createElement("td", null, msg.hasPushRenderer ? "Available" : "None"),
                createElement(
                  "td",
                  null,
                  createElement(
                    "button",
                    {
                      "aria-current": msg.id === selectedMessage?.id ? "true" : undefined,
                      onClick: () => onSelectMessage?.(msg.id),
                      type: "button",
                    },
                    "Select",
                  ),
                ),
              ),
            ),
          ),
        ),
    selectedMessage
      ? createElement(
          Fragment,
          null,
          createElement(
            "section",
            { "aria-label": `Preview message ${selectedMessage.id}` },
            createElement("h3", null, `Preview: ${selectedMessage.id}`),
            createElement(
              "form",
              { onSubmit: handlePreview },
              createElement(
                "label",
                null,
                "Channel: ",
                createElement(
                  "select",
                  {
                    onChange: (e: ChangeEvent<HTMLSelectElement>) =>
                      setChannel(e.target.value as EngagementChannel),
                    value: activeChannel,
                  },
                  ...availableChannels.map((ch) =>
                    createElement(
                      "option",
                      { key: ch, value: ch },
                      ch === "email" ? "Email" : "Push",
                    ),
                  ),
                ),
              ),
              createElement(
                "label",
                null,
                "Mode: ",
                createElement(
                  "select",
                  {
                    onChange: (e: ChangeEvent<HTMLSelectElement>) =>
                      setMode(e.target.value as "fixture" | "recipient"),
                    value: mode,
                  },
                  createElement("option", { value: "fixture" }, "Fixture"),
                  createElement("option", { value: "recipient" }, "Recipient"),
                ),
              ),
              mode === "recipient"
                ? createElement("input", {
                    onChange: (e: ChangeEvent<HTMLInputElement>) => setRecipientId(e.target.value),
                    placeholder: "Recipient ID",
                    required: true,
                    type: "text",
                    value: recipientId,
                  })
                : null,
              createElement(
                "button",
                {
                  disabled: !canPreview,
                  title: canPreview
                    ? "Preview message"
                    : "Missing permission: engagement:message:preview",
                  type: "submit",
                },
                "Generate preview",
              ),
            ),
            previewResult && previewResult.messageId === selectedMessage.id
              ? createElement(
                  "div",
                  {
                    "aria-label": "Rendered message preview",
                    "data-testid": "message-preview-container",
                  },
                  previewResult.subject
                    ? createElement("h4", null, `Subject: ${previewResult.subject}`)
                    : null,
                  previewResult.channel === "email" && previewResult.htmlContent
                    ? createElement("iframe", {
                        "aria-label": "Isolated email HTML preview",
                        sandbox: "",
                        srcDoc: previewResult.htmlContent,
                        title: "Email preview",
                      })
                    : null,
                  previewResult.channel === "push" && previewResult.pushContent
                    ? createElement(
                        "div",
                        {
                          "aria-label": "Device-neutral push preview",
                          "data-testid": "push-preview-surface",
                          role: "region",
                        },
                        createElement("strong", null, previewResult.pushContent.title),
                        createElement("p", null, previewResult.pushContent.body),
                      )
                    : null,
                )
              : null,
          ),
          createElement(
            "section",
            { "aria-label": `Test send message ${selectedMessage.id}` },
            createElement("h3", null, "Audited test send"),
            createElement(
              "form",
              { onSubmit: handleTestSend },
              createElement(
                "label",
                null,
                "Target type: ",
                createElement(
                  "select",
                  {
                    onChange: (e: ChangeEvent<HTMLSelectElement>) =>
                      setTestTargetType(e.target.value as "allowlisted-endpoint" | "recipient"),
                    value: testTargetType,
                  },
                  createElement(
                    "option",
                    { value: "allowlisted-endpoint" },
                    "Allowlisted endpoint",
                  ),
                  createElement("option", { value: "recipient" }, "Selected recipient"),
                ),
              ),
              testTargetType === "allowlisted-endpoint"
                ? createElement("input", {
                    onChange: (e: ChangeEvent<HTMLInputElement>) => setTestEndpoint(e.target.value),
                    placeholder: "Allowlisted test email/phone",
                    required: true,
                    type: "text",
                    value: testEndpoint,
                  })
                : createElement("input", {
                    onChange: (e: ChangeEvent<HTMLInputElement>) =>
                      setTestRecipientId(e.target.value),
                    placeholder: "Recipient ID",
                    required: true,
                    type: "text",
                    value: testRecipientId,
                  }),
              createElement("input", {
                onChange: (e: ChangeEvent<HTMLInputElement>) => setTestReason(e.target.value),
                placeholder: "Audit reason for test send",
                required: true,
                type: "text",
                value: testReason,
              }),
              createElement(
                "button",
                {
                  disabled: !canTestSend,
                  title: canTestSend
                    ? "Send test message"
                    : "Missing permission: engagement:message:test-send",
                  type: "submit",
                },
                "Send test message",
              ),
            ),
            testSendResult
              ? createElement(
                  "div",
                  { "aria-label": "Test send result", role: "status" },
                  createElement("p", null, `Status: ${testSendResult.status}`),
                  createElement("p", null, `Dispatch ID: ${testSendResult.dispatchId}`),
                  createElement("p", null, `Audit evidence: ${testSendResult.auditEvidence}`),
                )
              : null,
          ),
        )
      : null,
  );
}

export type AudienceCampaignOperationsPanelProps = {
  readonly audiences: readonly EngagementAudienceDescriptorRow[];
  readonly campaigns: readonly EngagementCampaignDescriptorRow[];
  readonly selectedAudienceId?: string;
  readonly selectedCampaignId?: string;
  readonly onSelectAudience?: (audienceId: string) => void;
  readonly onSelectCampaign?: (campaignId: string) => void;
  readonly audienceEstimateResult?: EngagementAudienceEstimateResult;
  readonly onEstimateAudience?: (request: EngagementAudienceEstimateRequest) => void;
  readonly onCreateSnapshot?: (request: EngagementCampaignSnapshotRequest) => void;
  readonly onRunCampaign?: (request: EngagementCampaignRunRequest) => void;
  readonly onCancelCampaign?: (request: EngagementCampaignCancelRequest) => void;
  readonly grantedPermissions: readonly string[];
};

export function AudienceCampaignOperationsPanel({
  audienceEstimateResult,
  audiences,
  campaigns,
  grantedPermissions,
  onCancelCampaign,
  onCreateSnapshot,
  onEstimateAudience,
  onRunCampaign,
  onSelectAudience,
  onSelectCampaign,
  selectedAudienceId,
  selectedCampaignId,
}: AudienceCampaignOperationsPanelProps): ReactElement {
  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? audiences[0];
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? campaigns[0];

  const [campaignReason, setCampaignReason] = useState("Quarterly broadcast execution");
  const [cancelReason, setCancelReason] = useState("Operator cancellation");

  const canRunCampaign = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.CAMPAIGN_RUN);
  const canCancelCampaign = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.CAMPAIGN_CANCEL);
  const canReadAudience = grantedPermissions.includes(ENGAGEMENT_PERMISSIONS.AUDIENCE_READ);

  const handleRunCampaign = () => {
    if (!selectedCampaign) return;
    const req: EngagementCampaignRunRequest = {
      actorId: "operator",
      campaignId: selectedCampaign.id,
      idempotencyKey: `run-${selectedCampaign.id}-${Date.now()}`,
      reason: campaignReason,
      snapshotId: selectedCampaign.currentSnapshotId ?? "",
    };
    assertCampaignRunValid(req, selectedCampaign);
    onRunCampaign?.(req);
  };

  const handleCancelCampaign = () => {
    if (!selectedCampaign) return;
    const req: EngagementCampaignCancelRequest = {
      actorId: "operator",
      campaignId: selectedCampaign.id,
      idempotencyKey: `cancel-${selectedCampaign.id}-${Date.now()}`,
      reason: cancelReason,
    };
    assertCampaignCancelValid(req, selectedCampaign);
    onCancelCampaign?.(req);
  };

  const hasSnapshot = Boolean(
    selectedCampaign?.currentSnapshotId && selectedCampaign?.snapshotMemberCount,
  );

  return createElement(
    "section",
    {
      "aria-label": "Audience and campaign operations",
      "data-testid": "audience-campaign-panel",
    },
    createElement("h2", null, "Audiences & Campaigns"),
    createElement(
      "section",
      { "aria-label": "Audience operations" },
      createElement("h3", null, "Audiences"),
      audiences.length === 0
        ? createElement("p", { "data-state": "empty" }, "No audiences registered.")
        : createElement(
            "table",
            { "aria-label": "Audiences table" },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                null,
                createElement("th", { scope: "col" }, "Audience ID"),
                createElement("th", { scope: "col" }, "Name"),
                createElement("th", { scope: "col" }, "Scope"),
                createElement("th", { scope: "col" }, "Source"),
                createElement("th", { scope: "col" }, "Actions"),
              ),
            ),
            createElement(
              "tbody",
              null,
              audiences.map((aud) =>
                createElement(
                  "tr",
                  { key: aud.id },
                  createElement("td", null, aud.id),
                  createElement("td", null, aud.name),
                  createElement("td", null, aud.scope),
                  createElement("td", null, aud.source),
                  createElement(
                    "td",
                    null,
                    createElement(
                      "button",
                      {
                        "aria-current": aud.id === selectedAudience?.id ? "true" : undefined,
                        disabled: !canReadAudience,
                        onClick: () => {
                          onSelectAudience?.(aud.id);
                          onEstimateAudience?.({ audienceId: aud.id, sampleLimit: 10 });
                        },
                        title: canReadAudience
                          ? "Request bounded estimate and sample"
                          : "Missing permission: engagement:audience:read",
                        type: "button",
                      },
                      "Estimate & Sample",
                    ),
                  ),
                ),
              ),
            ),
          ),
      audienceEstimateResult
        ? createElement(
            "div",
            {
              "aria-label": "Audience estimate results",
              "data-testid": "audience-estimate-box",
            },
            createElement("h4", null, `Audience estimate: ${audienceEstimateResult.audienceId}`),
            createElement("p", null, `Total estimated count: ${audienceEstimateResult.totalCount}`),
            createElement(
              "p",
              null,
              `Sample recipients (bounded limit: ${audienceEstimateResult.sampleRecipients.length}, full audience cannot be materialized in browser):`,
            ),
            createElement(
              "ul",
              null,
              audienceEstimateResult.sampleRecipients.map((s) =>
                createElement(
                  "li",
                  { key: s.recipientId },
                  `${s.recipientId} · ${s.maskedEmail ?? "no email"}`,
                ),
              ),
            ),
          )
        : null,
    ),
    createElement(
      "section",
      { "aria-label": "Campaign operations" },
      createElement("h3", null, "Campaigns"),
      campaigns.length === 0
        ? createElement("p", { "data-state": "empty" }, "No campaigns configured.")
        : createElement(
            "table",
            { "aria-label": "Campaigns table" },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                null,
                createElement("th", { scope: "col" }, "Campaign ID"),
                createElement("th", { scope: "col" }, "Name"),
                createElement("th", { scope: "col" }, "Status"),
                createElement("th", { scope: "col" }, "Snapshot members"),
                createElement("th", { scope: "col" }, "Select"),
              ),
            ),
            createElement(
              "tbody",
              null,
              campaigns.map((camp) =>
                createElement(
                  "tr",
                  { key: camp.id },
                  createElement("td", null, camp.id),
                  createElement("td", null, camp.name),
                  createElement("td", null, camp.status),
                  createElement("td", null, String(camp.snapshotMemberCount ?? "No snapshot")),
                  createElement(
                    "td",
                    null,
                    createElement(
                      "button",
                      {
                        "aria-current": camp.id === selectedCampaign?.id ? "true" : undefined,
                        onClick: () => onSelectCampaign?.(camp.id),
                        type: "button",
                      },
                      "Inspect",
                    ),
                  ),
                ),
              ),
            ),
          ),
      selectedCampaign
        ? createElement(
            "article",
            {
              "aria-label": `Campaign details for ${selectedCampaign.name}`,
              "data-testid": "campaign-detail-card",
            },
            createElement(
              "h4",
              null,
              `Campaign: ${selectedCampaign.name} (${selectedCampaign.id})`,
            ),
            createElement("p", null, `Status: ${selectedCampaign.status}`),
            createElement("p", null, `Audience: ${selectedCampaign.audienceId}`),
            createElement("p", null, `Message: ${selectedCampaign.messageId}`),
            createElement(
              "div",
              { "aria-label": "Snapshot inspection" },
              createElement("h5", null, "Audience Snapshot"),
              hasSnapshot
                ? createElement(
                    "p",
                    null,
                    `Immutable snapshot ${selectedCampaign.currentSnapshotId} frozen with ${selectedCampaign.snapshotMemberCount} members.`,
                  )
                : createElement(
                    Fragment,
                    null,
                    createElement(
                      "p",
                      null,
                      "No snapshot created yet. A campaign cannot start before a complete immutable snapshot exists.",
                    ),
                    createElement(
                      "button",
                      {
                        onClick: () =>
                          onCreateSnapshot?.({
                            actorId: "operator",
                            audienceId: selectedCampaign.audienceId,
                            campaignId: selectedCampaign.id,
                            reason: "Prepare campaign immutable snapshot",
                          }),
                        type: "button",
                      },
                      "Create immutable snapshot",
                    ),
                  ),
            ),
            createElement(
              "div",
              { "aria-label": "Campaign execution controls" },
              createElement("h5", null, "Execution"),
              createElement("input", {
                onChange: (e: ChangeEvent<HTMLInputElement>) => setCampaignReason(e.target.value),
                placeholder: "Audit reason for running campaign",
                type: "text",
                value: campaignReason,
              }),
              createElement(
                "button",
                {
                  disabled:
                    !hasSnapshot || !canRunCampaign || selectedCampaign.status === "running",
                  onClick: handleRunCampaign,
                  title: !hasSnapshot
                    ? "A campaign cannot start before a complete immutable snapshot exists"
                    : canRunCampaign
                      ? "Execute broadcast"
                      : "Missing permission: engagement:campaign:run",
                  type: "button",
                },
                "Start broadcast",
              ),
              selectedCampaign.status === "running" || selectedCampaign.status === "scheduled"
                ? createElement(
                    Fragment,
                    null,
                    createElement("input", {
                      onChange: (e: ChangeEvent<HTMLInputElement>) =>
                        setCancelReason(e.target.value),
                      placeholder: "Reason for cancellation",
                      type: "text",
                      value: cancelReason,
                    }),
                    createElement(
                      "button",
                      {
                        disabled: !canCancelCampaign || !cancelReason.trim(),
                        onClick: handleCancelCampaign,
                        title: !canCancelCampaign
                          ? "Missing permission: engagement:campaign:cancel"
                          : !cancelReason.trim()
                            ? "Reason is required for cancellation audit"
                            : "Cancel campaign",
                        type: "button",
                      },
                      "Cancel undispatched work",
                    ),
                    createElement(
                      "p",
                      { "data-testid": "accepted-not-recalled-notice" },
                      "Notice: Accepted notifications are already with downstream providers and are not recalled. Undispatched notifications will be canceled.",
                    ),
                  )
                : null,
            ),
            selectedCampaign.progress
              ? createElement(CampaignProgressCard, { progress: selectedCampaign.progress })
              : null,
          )
        : null,
    ),
  );
}

function CampaignProgressCard({
  progress,
}: {
  readonly progress: EngagementCampaignProgressSummary;
}): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Campaign execution progress",
      "data-testid": "campaign-progress-card",
    },
    createElement("h5", null, `Progress: ${progress.status.toUpperCase()}`),
    createElement(
      "dl",
      null,
      createElement("dt", null, "Total"),
      createElement("dd", null, String(progress.total)),
      createElement("dt", null, "Completed"),
      createElement("dd", null, String(progress.completed)),
      createElement("dt", null, "Queued"),
      createElement("dd", null, String(progress.queued)),
      createElement("dt", null, "Suppressed"),
      createElement("dd", null, String(progress.suppressed)),
      createElement("dt", null, "Skipped"),
      createElement("dd", null, String(progress.skipped)),
      createElement("dt", null, "Failed"),
      createElement("dd", null, String(progress.failed)),
      progress.undispatchedCanceled !== undefined
        ? createElement(
            Fragment,
            null,
            createElement("dt", null, "Undispatched Canceled"),
            createElement("dd", null, String(progress.undispatchedCanceled)),
          )
        : null,
    ),
    progress.failureEvidence && progress.failureEvidence.length > 0
      ? createElement(
          "div",
          { "aria-label": "Per-member failure evidence" },
          createElement("h6", null, "Failure evidence (tokens and PII protected)"),
          createElement(
            "ul",
            null,
            progress.failureEvidence.map((fe) =>
              createElement(
                "li",
                { key: fe.recipientId },
                `${fe.recipientId}: ${fe.reason}${fe.maskedTokenOrAddress ? ` (${fe.maskedTokenOrAddress})` : ""}`,
              ),
            ),
          ),
        )
      : null,
  );
}

export type DeliveryOperationsPanelProps = {
  readonly dispatches: readonly EngagementDispatchSummary[];
  readonly deliveryEvents: readonly EngagementDeliveryEventSummary[];
  readonly filter?: EngagementDeliveryFilter;
  readonly onFilterChange?: (filter: EngagementDeliveryFilter) => void;
  readonly onRetryDispatch?: (request: EngagementRetryDispatchRequest) => void;
  readonly grantedPermissions: readonly string[];
};

export function DeliveryOperationsPanel({
  deliveryEvents,
  dispatches,
  filter,
  onFilterChange,
  onRetryDispatch,
}: DeliveryOperationsPanelProps): ReactElement {
  const filteredDispatches = filterEngagementDispatches(dispatches, filter);

  return createElement(
    "section",
    {
      "aria-label": "Delivery and suppression operations",
      "data-testid": "delivery-operations-panel",
    },
    createElement("h2", null, "Delivery & suppression operations"),
    createElement(
      "section",
      { "aria-label": "Delivery filters" },
      createElement("h3", null, "Filters"),
      createElement(
        "div",
        null,
        createElement("input", {
          onChange: (e: ChangeEvent<HTMLInputElement>) =>
            onFilterChange?.({
              ...filter,
              recipientId: e.target.value.trim() || undefined,
              tenantId: filter?.tenantId ?? "",
            }),
          placeholder: "Filter by recipient ID",
          type: "text",
          value: filter?.recipientId ?? "",
        }),
        createElement("input", {
          onChange: (e: ChangeEvent<HTMLInputElement>) =>
            onFilterChange?.({
              ...filter,
              messageId: e.target.value.trim() || undefined,
              tenantId: filter?.tenantId ?? "",
            }),
          placeholder: "Filter by message ID",
          type: "text",
          value: filter?.messageId ?? "",
        }),
      ),
    ),
    createElement(
      "section",
      { "aria-label": "Dispatches table" },
      createElement("h3", null, "Dispatches"),
      filteredDispatches.length === 0
        ? createElement("p", { "data-state": "empty" }, "No dispatches match the active filter.")
        : createElement(
            "table",
            null,
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                null,
                createElement("th", { scope: "col" }, "Dispatch ID"),
                createElement("th", { scope: "col" }, "Recipient"),
                createElement("th", { scope: "col" }, "Message"),
                createElement("th", { scope: "col" }, "Channel"),
                createElement("th", { scope: "col" }, "Status"),
                createElement("th", { scope: "col" }, "Provider Accepted"),
                createElement("th", { scope: "col" }, "Failure/Suppression Reason"),
                createElement("th", { scope: "col" }, "Actions"),
              ),
            ),
            createElement(
              "tbody",
              null,
              filteredDispatches.map((d) => {
                const canRetry = d.status === "failed" && d.retryable;
                return createElement(
                  "tr",
                  { key: d.id },
                  createElement("td", null, d.id),
                  createElement("td", null, d.recipientId),
                  createElement("td", null, d.messageId),
                  createElement("td", null, d.channel),
                  createElement("td", null, d.status),
                  createElement("td", null, d.providerAccepted ? "Accepted" : "Not accepted"),
                  createElement(
                    "td",
                    null,
                    d.failureReason ?? d.suppressionReason ?? d.providerStatus ?? "None",
                  ),
                  createElement(
                    "td",
                    null,
                    createElement(
                      "button",
                      {
                        disabled: !canRetry,
                        onClick: () => {
                          assertRetryDispatchValid(d);
                          onRetryDispatch?.({
                            actorId: "operator",
                            dispatchId: d.id,
                            idempotencyKey: `retry-${d.id}-${Date.now()}`,
                            reason: "Operator triggered safe retry",
                            tenantId: d.tenantId,
                          });
                        },
                        title: canRetry
                          ? "Retry failed dispatch"
                          : "Retry/replay controls appear only for explicitly safe outcomes",
                        type: "button",
                      },
                      "Retry",
                    ),
                  ),
                );
              }),
            ),
          ),
    ),
    createElement(
      "section",
      { "aria-label": "Recent delivery events" },
      createElement("h3", null, "Recent delivery events"),
      deliveryEvents.length === 0
        ? createElement("p", { "data-state": "empty" }, "No delivery events recorded.")
        : createElement(
            "ol",
            null,
            deliveryEvents.map((evt) =>
              createElement(
                "li",
                { key: evt.id },
                `${evt.eventType.toUpperCase()} · Dispatch: ${evt.dispatchId} · ${evt.occurredAt.toISOString()}`,
              ),
            ),
          ),
    ),
  );
}

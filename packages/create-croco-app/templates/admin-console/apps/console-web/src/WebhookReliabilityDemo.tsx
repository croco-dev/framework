import {
  createWebhookDeliveryAction,
  createWebhookEndpointActions,
  createWebhookEndpointCreationAction,
  type WebhookOperationsReadyState,
} from "@croco/admin-core";
import { WebhookReliabilityConsole } from "@croco/admin-react";
import { useState } from "react";

const generatedAt = new Date("2026-07-26T00:00:00.000Z");
const endpoint = {
  id: "endpoint_demo",
  tenantId: "tenant_acme",
  maskedUrl: "https://hooks.example.test",
  subscriptions: [{ name: "order.created", schemaVersion: "v1" }],
  status: "active",
  successRate: 0.75,
  lastSuccessAt: generatedAt,
  lastFailureAt: generatedAt,
  secret: {
    activeVersion: "secret-v2",
    previousVersion: "secret-v1",
    previousValidUntil: new Date("2026-07-27T00:00:00.000Z"),
  },
} as const;
const delivery = {
  id: "delivery_timeout",
  eventId: "event_demo",
  endpointId: endpoint.id,
  tenantId: endpoint.tenantId,
  status: "acceptance-unknown",
  attemptCount: 2,
  createdAt: generatedAt,
  updatedAt: generatedAt,
  correlationId: "correlation_demo",
  problem: {
    code: "webhooks-core/outbound-acceptance-unknown",
    retryable: false,
  },
  replay: {
    allowed: false,
    reason: "Operator confirmation is required before the core contract allows replay",
  },
} as const;

const state: WebhookOperationsReadyState = {
  kind: "ready",
  tenantId: endpoint.tenantId,
  generatedAt,
  endpoints: [endpoint],
  events: [
    {
      id: "event_demo",
      tenantId: endpoint.tenantId,
      name: "order.created",
      schemaVersion: "v1",
      subject: "order/demo",
      occurredAt: generatedAt,
      committedAt: generatedAt,
    },
  ],
  deliveries: [delivery],
  attempts: [
    {
      id: "attempt_timeout",
      deliveryId: delivery.id,
      number: 1,
      secretVersion: "secret-v2",
      startedAt: generatedAt,
      completedAt: new Date(generatedAt.getTime() + 5000),
      durationMs: 5000,
      classification: "retryable",
      problem: {
        code: "webhooks-core/outbound-retryable-failure",
        retryable: true,
      },
    },
    {
      id: "attempt_unknown",
      deliveryId: delivery.id,
      number: 2,
      secretVersion: "secret-v2",
      startedAt: generatedAt,
      completedAt: new Date(generatedAt.getTime() + 5100),
      durationMs: 100,
      classification: "acceptance-unknown",
      correlationId: delivery.correlationId,
      redactedResponseExcerpt: "[redacted response]",
      problem: delivery.problem,
    },
  ],
  actions: [
    createWebhookEndpointCreationAction(endpoint.tenantId, ["webhooks:write"]),
    ...createWebhookEndpointActions(
      endpoint,
      ["webhooks:write", "webhooks:secrets:rotate"],
      generatedAt,
    ),
    createWebhookDeliveryAction(delivery, endpoint, ["webhooks:replay"]),
  ],
};
const filter = { tenantId: state.tenantId };

export function WebhookReliabilityDemo({ tenantId }: { readonly tenantId: string }) {
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>(delivery.id);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(endpoint.id);
  const [lastAction, setLastAction] = useState("No webhook mutation requested.");
  const tenantEndpoint = { ...endpoint, tenantId };
  const tenantDelivery = { ...delivery, tenantId };
  const tenantState: WebhookOperationsReadyState = {
    ...state,
    tenantId,
    endpoints: [tenantEndpoint],
    events: state.events.map((event) => ({ ...event, tenantId })),
    deliveries: [tenantDelivery],
    actions: [
      createWebhookEndpointCreationAction(tenantId, ["webhooks:write"]),
      ...createWebhookEndpointActions(
        tenantEndpoint,
        ["webhooks:write", "webhooks:secrets:rotate"],
        generatedAt,
      ),
      createWebhookDeliveryAction(tenantDelivery, tenantEndpoint, ["webhooks:replay"]),
    ],
  };

  return (
    <section aria-label="Tenant-scoped webhook operations">
      <WebhookReliabilityConsole
        filter={Object.assign({}, filter, { tenantId })}
        onAcknowledgeSecret={() => setLastAction("One-time secret stored.")}
        onAction={(action) =>
          setLastAction(
            `${action.auditEvent} requested; submit actor, reason, and idempotency evidence to the API.`,
          )
        }
        onSelectDelivery={setSelectedDeliveryId}
        onSelectEndpoint={setSelectedEndpointId}
        selectedDeliveryId={selectedDeliveryId}
        selectedEndpointId={selectedEndpointId}
        state={tenantState}
      />
      <output aria-live="polite">{lastAction}</output>
    </section>
  );
}

import {
  createWebhookDeliveryAction,
  createWebhookEndpointActions,
  executeWebhookOperationsAction,
  type WebhookEndpointOperationsRow,
} from "@croco/admin-core";
import {
  classifyOutboundWebhookOutcome,
  createOutboundWebhookUrlPolicy,
  FakeOutboundWebhookTransport,
  InMemoryOutboundWebhookEndpointStore,
  InMemoryOutboundWebhookSecretStore,
  InMemoryOutboundWebhookStore,
  OutboundWebhookRuntime,
  type OutboundWebhookEndpoint,
  type OutboundWebhookAttemptOutcome,
} from "@croco/webhooks-core";

const endpoint: WebhookEndpointOperationsRow = {
  id: "endpoint_demo",
  tenantId: "tenant_acme",
  maskedUrl: "https://hooks.example.test",
  subscriptions: [{ name: "order.created", schemaVersion: "v1" }],
  status: "active",
  secret: {
    activeVersion: "secret-v2",
    previousVersion: "secret-v1",
    previousValidUntil: new Date("2026-07-27T00:00:00.000Z"),
  },
};

const scenarios = [
  ["success", { kind: "http", status: 204 }, "delivered"],
  ["timeout", { kind: "timeout" }, "retryable"],
  ["429 retry", { kind: "http", status: 429 }, "retryable"],
  ["permanent 4xx", { kind: "http", status: 400 }, "permanent"],
] as const satisfies readonly [
  string,
  OutboundWebhookAttemptOutcome,
  ReturnType<typeof classifyOutboundWebhookOutcome>["policy"],
][];

async function main(): Promise<void> {
  const transport = new FakeOutboundWebhookTransport(scenarios.map(([, outcome]) => outcome));
  for (const [name, , expectedPolicy] of scenarios) {
    const outcome = await transport.send({
      body: new TextEncoder().encode(`{"scenario":"${name}"}`),
      headers: {},
      resolvedAddresses: ["203.0.113.10"],
      url: endpoint.maskedUrl,
    });
    const classification = classifyOutboundWebhookOutcome("delivery_demo", outcome);
    if (classification.policy !== expectedPolicy) {
      throw new Error(
        `Expected ${name} to classify as ${expectedPolicy}, got ${classification.policy}`,
      );
    }
  }

  const actions = createWebhookEndpointActions(
    endpoint,
    ["webhooks:write", "webhooks:secrets:rotate"],
    new Date("2026-07-26T00:00:00.000Z"),
  );
  if (!actions.some((action) => action.kind === "rotate-secret" && action.allowed)) {
    throw new Error("Expected the fake endpoint to expose an audited secret rotation action");
  }

  const replay = createWebhookDeliveryAction(
    {
      id: "delivery_demo",
      eventId: "event_demo",
      endpointId: endpoint.id,
      tenantId: endpoint.tenantId,
      status: "dead",
      attemptCount: 3,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
      updatedAt: new Date("2026-07-26T00:01:00.000Z"),
      replay: {
        allowed: true,
        reason: "Core delivery state allows terminal replay",
      },
    },
    endpoint,
    ["webhooks:replay"],
  );
  if (!replay.allowed || replay.targetId !== "delivery_demo") {
    throw new Error("Expected replay to target the existing logical delivery");
  }

  const runtimeEndpoint: OutboundWebhookEndpoint = {
    activeSecretVersion: "secret-v2",
    id: endpoint.id,
    signingAlgorithm: "hmac-sha256",
    status: "active",
    subscribedEventNames: ["order.created"],
    tenantId: endpoint.tenantId,
    url: "https://hooks.example.test/deliver",
  };
  const store = new InMemoryOutboundWebhookStore();
  const endpointStore = new InMemoryOutboundWebhookEndpointStore([runtimeEndpoint]);
  const secretStore = new InMemoryOutboundWebhookSecretStore([
    {
      endpointId: endpoint.id,
      material: new TextEncoder().encode("active-secret"),
      tenantId: endpoint.tenantId,
      version: "secret-v2",
    },
  ]);
  const runtime = new OutboundWebhookRuntime({
    createId: () => "attempt_demo",
    endpointStore,
    now: () => new Date("2026-07-26T00:00:00.000Z"),
    secretStore,
    store,
    taskPublisher: { publish: async () => undefined },
    transport: new FakeOutboundWebhookTransport([{ kind: "http", status: 400 }]),
    urlPolicy: createOutboundWebhookUrlPolicy({
      resolveHostname: async () => ["1.1.1.1"],
    }),
  });
  const committed = await runtime.publish({
    id: "event_demo",
    name: "order.created",
    occurredAt: new Date("2026-07-26T00:00:00.000Z"),
    payload: { orderId: "order_demo" },
    schemaVersion: "v1",
    subject: "order/order_demo",
    tenantId: endpoint.tenantId,
  });
  const [committedDelivery] = committed.deliveries;
  if (committedDelivery === undefined) {
    throw new Error("Expected the core runtime to commit a delivery");
  }
  const terminalDelivery = await runtime.dispatch(endpoint.tenantId, committedDelivery.id);
  const replayAction = createWebhookDeliveryAction(
    {
      ...terminalDelivery,
      replay: { allowed: true, reason: "Core delivery status is terminal" },
    },
    endpoint,
    ["webhooks:replay"],
  );
  const auditEvents: string[] = [];
  const replayed = await executeWebhookOperationsAction({
    action: replayAction,
    expectedTenantId: endpoint.tenantId,
    grantedPermissions: ["webhooks:replay"],
    request: {
      action: "replay-delivery",
      actorId: "operator_demo",
      idempotencyKey: "replay_demo",
      reason: "Generated smoke verifies audited replay",
      targetId: terminalDelivery.id,
      tenantId: endpoint.tenantId,
    },
    executor: {
      execute: async ({ action, request }) => {
        const result = await runtime.replay(
          request.tenantId,
          request.targetId,
          request.idempotencyKey,
        );
        auditEvents.push(`${action.auditEvent}:${request.actorId}:${request.reason}`);
        return result;
      },
    },
  });
  const duplicateReplay = await runtime.replay(
    endpoint.tenantId,
    terminalDelivery.id,
    "replay_demo",
  );
  const deliveries = await store.listDeliveries(endpoint.tenantId, "event_demo");
  if (
    replayed.id !== duplicateReplay.id ||
    replayed.eventId !== "event_demo" ||
    deliveries.length !== 1 ||
    auditEvents.length !== 1
  ) {
    throw new Error("Expected replay to retain event identity and idempotent audit evidence");
  }

  const rotatedEndpoint = {
    ...runtimeEndpoint,
    activeSecretVersion: "secret-v3",
    previousSecretValidUntil: new Date("2026-07-27T00:00:00.000Z"),
    previousSecretVersion: "secret-v2",
  };
  endpointStore.set(rotatedEndpoint);
  secretStore.set({
    endpointId: endpoint.id,
    material: new TextEncoder().encode("rotated-secret"),
    tenantId: endpoint.tenantId,
    version: "secret-v3",
  });
  const storedRotation = await endpointStore.getEndpoint(endpoint.tenantId, endpoint.id);
  const storedSecret = await secretStore.getSecret(endpoint.tenantId, endpoint.id, "secret-v3");
  if (
    storedRotation?.activeSecretVersion !== "secret-v3" ||
    storedRotation.previousSecretVersion !== "secret-v2" ||
    storedSecret?.version !== "secret-v3"
  ) {
    throw new Error("Expected secret rotation metadata and material version to advance together");
  }

  console.log("admin-console outbound webhook reliability smoke passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

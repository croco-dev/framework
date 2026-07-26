import type { WebhookOperationsState } from "@croco/admin-core";
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WebhookReliabilityConsole } from "../index";

const generatedAt = new Date("2026-07-26T00:00:00.000Z");
const ready: Extract<WebhookOperationsState, { kind: "ready" }> = {
  kind: "ready",
  tenantId: "tenant-1",
  generatedAt,
  endpoints: [
    {
      id: "endpoint-1",
      tenantId: "tenant-1",
      maskedUrl: "https://hooks.example.com",
      subscriptions: [{ name: "order.created", schemaVersion: "v1" }],
      status: "active",
      successRate: 0.75,
      lastSuccessAt: generatedAt,
      lastFailureAt: new Date("2026-07-25T00:00:00.000Z"),
      secret: {
        activeVersion: "v2",
        previousVersion: "v1",
        previousValidUntil: new Date("2026-07-27T00:00:00.000Z"),
      },
    },
  ],
  events: [
    {
      id: "event-1",
      tenantId: "tenant-1",
      name: "order.created",
      schemaVersion: "v1",
      subject: "order-42",
      occurredAt: generatedAt,
      committedAt: generatedAt,
    },
  ],
  deliveries: [
    {
      id: "delivery-1",
      eventId: "event-1",
      endpointId: "endpoint-1",
      tenantId: "tenant-1",
      status: "acceptance-unknown",
      attemptCount: 1,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      nextAttemptAt: new Date("2026-07-26T00:05:00.000Z"),
      correlationId: "correlation-1",
      problem: { code: "webhooks-core/outbound-acceptance-unknown" },
    },
  ],
  attempts: [
    {
      id: "attempt-1",
      deliveryId: "delivery-1",
      number: 1,
      secretVersion: "v2",
      startedAt: generatedAt,
      completedAt: new Date(generatedAt.getTime() + 120),
      durationMs: 120,
      classification: "acceptance-unknown",
      nextRetryAt: new Date("2026-07-26T00:05:00.000Z"),
      correlationId: "correlation-1",
      redactedResponseExcerpt:
        "authorization: Bearer hostile-token; cookie=session-value; safe response context",
      problem: { code: "webhooks-core/outbound-acceptance-unknown" },
    },
  ],
  actions: [
    {
      kind: "create-endpoint",
      targetId: "tenant-1",
      permission: "webhooks:write",
      allowed: true,
      reason: "An endpoint can be created",
      auditEvent: "webhook.create-endpoint",
    },
    {
      kind: "replay-delivery",
      targetId: "delivery-1",
      permission: "webhooks:replay",
      allowed: false,
      reason: "Endpoint must be active before replay confirmation",
      auditEvent: "webhook.replay-delivery",
    },
  ],
};

function render(state: WebhookOperationsState): string {
  return renderToStaticMarkup(createElement(WebhookReliabilityConsole, { state }));
}

describe("WebhookReliabilityConsole", () => {
  it("separates endpoint, logical event, delivery, and partial attempt evidence accessibly", () => {
    const markup = render(ready);

    expect(markup).toContain('aria-label="Webhook endpoints"');
    expect(markup).toContain("order.created (v1)");
    expect(markup).toContain("Logical event event-1");
    expect(markup).toContain("Delivery acceptance-unknown");
    expect(markup).toContain("Create endpoint");
    expect(markup).toContain("Last success: 2026-07-26T00:00:00.000Z");
    expect(markup).toContain("Last failure: 2026-07-25T00:00:00.000Z");
    expect(markup).toContain("Correlation: correlation-1");
    expect(markup).toContain("Next retry: 2026-07-26T00:05:00.000Z");
    expect(markup).toContain('aria-label="Delivery attempt history"');
    expect(markup).toContain("Attempt 1: acceptance-unknown");
    expect(markup).toContain("Secret version v2");
    expect(markup).toContain("[redacted");
    expect(markup).not.toContain("hostile-token");
    expect(markup).not.toContain("session-value");
    expect(markup).not.toContain("signature");
    expect(markup).not.toContain("authorization");
  });

  it.each([
    ["loading", { kind: "loading", tenantId: "tenant-1" }],
    ["empty", { kind: "empty", tenantId: "tenant-1" }],
    [
      "permission-denied",
      {
        kind: "permission-denied",
        tenantId: "tenant-1",
        problem: { code: "admin/permission-denied" },
        requiredPermissions: ["webhooks:read"],
      },
    ],
    [
      "problem",
      {
        kind: "problem",
        tenantId: "tenant-1",
        problem: { code: "webhooks/store-unavailable", retryable: true },
      },
    ],
  ] as const)("renders the %s state explicitly", (kind, state) => {
    expect(render(state)).toContain(`data-state="${kind}"`);
  });

  it("renders one-time secret creation separately from endpoint tables", () => {
    const markup = render({
      kind: "secret-created",
      tenantId: "tenant-1",
      endpointId: "endpoint-1",
      secretVersion: "v3",
      oneTimeSecret: "one-time-value",
    });

    expect(markup).toContain('data-state="secret-created"');
    expect(markup).toContain("cannot be recovered");
    expect(markup).toContain('aria-label="One-time secret value"');
    expect(markup).toContain("one-time-value");
    expect(markup).not.toContain('aria-label="Webhook endpoints"');
  });

  it("does not expose unsafe replay controls as enabled", () => {
    const markup = render(ready);

    expect(markup).toContain("<button");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Endpoint must be active before replay confirmation");
  });

  it("applies delivery filters to rendered evidence instead of only summarizing them", () => {
    const markup = renderToStaticMarkup(
      createElement(WebhookReliabilityConsole, {
        filter: { eventName: "invoice.paid", tenantId: "tenant-1" },
        state: ready,
      }),
    );

    expect(markup).toContain("No deliveries match the current filters.");
    expect(markup).not.toContain("Logical event event-1");
  });

  it("dispatches the selected eligible action through the controlled interaction", () => {
    const selected: string[] = [];
    const consoleElement = WebhookReliabilityConsole({
      onAction: (action) => selected.push(action.kind),
      state: ready,
    });
    const button = findButton(consoleElement, "Create endpoint");

    button.props.onClick?.();

    expect(selected).toEqual(["create-endpoint"]);
  });

  it.each([
    ["retryable", 429, "webhooks-core/outbound-retryable-failure"],
    ["permanent", 400, "webhooks-core/outbound-permanent-failure"],
    ["acceptance-unknown", undefined, "webhooks-core/outbound-acceptance-unknown"],
  ] as const)("renders %s attempt diagnosis explicitly", (classification, status, code) => {
    const [baseAttempt] = ready.attempts;
    if (baseAttempt === undefined) {
      throw new Error("Expected the ready fixture to include an attempt");
    }
    const attempt = {
      ...baseAttempt,
      classification,
      responseStatus: status,
      problem: { code },
    };
    const markup = render({ ...ready, attempts: [attempt] });

    expect(markup).toContain(`data-classification="${classification}"`);
    expect(markup).toContain(`Problem ${code}`);
    expect(markup).toContain(status === undefined ? "no response status" : `HTTP ${status}`);
  });
});

function findButton(
  node: ReactNode,
  label: string,
): ReactElement<{ readonly onClick?: () => void }> {
  if (isValidElement(node)) {
    const props = node.props as { readonly children?: ReactNode };
    if (node.type === "button" && Children.toArray(props.children).join("") === label) {
      return node as ReactElement<{ readonly onClick?: () => void }>;
    }
    for (const child of Children.toArray(props.children)) {
      try {
        return findButton(child, label);
      } catch {
        // Continue through sibling elements until the labelled button is found.
      }
    }
  }
  throw new Error(`Expected button '${label}'`);
}

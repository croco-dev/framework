import type {
  WebhookAttemptOperationsRow,
  WebhookDeliveryOperationsFilter,
  WebhookDeliveryOperationsRow,
  WebhookEndpointOperationsRow,
  WebhookLogicalEventOperationsRow,
  WebhookOperationsAction,
  WebhookOperationsReadyState,
  WebhookOperationsState,
} from "@croco/admin-core";
import { filterWebhookDeliveries, redactWebhookOperationsText } from "@croco/admin-core";
import { createElement, Fragment, type ReactElement } from "react";

export type WebhookReliabilityConsoleProps = {
  readonly state: WebhookOperationsState;
  readonly filter?: WebhookDeliveryOperationsFilter;
  readonly selectedEndpointId?: string;
  readonly selectedDeliveryId?: string;
  readonly onAction?: (action: WebhookOperationsAction) => void;
  readonly onAcknowledgeSecret?: () => void;
  readonly onSelectDelivery?: (deliveryId: string) => void;
  readonly onSelectEndpoint?: (endpointId: string) => void;
};

export function WebhookReliabilityConsole({
  filter,
  onAcknowledgeSecret,
  onAction,
  onSelectDelivery,
  onSelectEndpoint,
  selectedDeliveryId,
  selectedEndpointId,
  state,
}: WebhookReliabilityConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      {
        "aria-busy": true,
        "aria-label": "Outbound webhook reliability console",
        "data-state": "loading",
      },
      createElement("p", null, "Loading webhook operations"),
    );
  }

  if (state.kind === "empty") {
    return createElement(
      "section",
      {
        "aria-label": "Outbound webhook reliability console",
        "data-state": "empty",
      },
      createElement("p", null, state.message ?? "No outbound webhook endpoints are configured."),
    );
  }

  if (state.kind === "permission-denied" || state.kind === "problem") {
    return createElement(
      "section",
      {
        "aria-label": "Outbound webhook reliability console",
        "data-state": state.kind,
        role: "alert",
      },
      createProblemNotice(state.problem),
      state.kind === "permission-denied"
        ? createElement("p", null, `Required permissions: ${state.requiredPermissions.join(", ")}`)
        : state.partial
          ? createReadyConsole({
              filter,
              onAction,
              onSelectDelivery,
              onSelectEndpoint,
              selectedDeliveryId,
              selectedEndpointId,
              state: state.partial,
            })
          : null,
    );
  }

  if (state.kind === "secret-created") {
    return createElement(
      "section",
      {
        "aria-label": "One-time outbound webhook secret",
        "data-endpoint-id": state.endpointId,
        "data-state": "secret-created",
        role: "alert",
      },
      createElement("h2", null, "Copy the new secret now"),
      createElement(
        "p",
        null,
        `Secret version ${state.secretVersion} cannot be recovered after this view is dismissed.`,
      ),
      createElement("output", { "aria-label": "One-time secret value" }, state.oneTimeSecret),
      state.expiresAt
        ? createElement("p", null, `This presentation expires at ${state.expiresAt.toISOString()}.`)
        : null,
      createElement(
        "button",
        { onClick: onAcknowledgeSecret, type: "button" },
        "I have stored the secret",
      ),
    );
  }

  return createReadyConsole({
    filter,
    onAction,
    onSelectDelivery,
    onSelectEndpoint,
    selectedDeliveryId,
    selectedEndpointId,
    state,
  });
}

function createReadyConsole({
  filter,
  onAction,
  onSelectDelivery,
  onSelectEndpoint,
  selectedDeliveryId,
  selectedEndpointId,
  state,
}: Omit<WebhookReliabilityConsoleProps, "state" | "onAcknowledgeSecret"> & {
  readonly state: WebhookOperationsReadyState;
}): ReactElement {
  const selectedEndpoint =
    state.endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? state.endpoints[0];
  const visibleDeliveries = filter ? filterWebhookDeliveries(state, filter) : state.deliveries;
  const selectedDelivery =
    visibleDeliveries.find((delivery) => delivery.id === selectedDeliveryId) ??
    visibleDeliveries[0];
  const selectedEvent = selectedDelivery
    ? state.events.find((event) => event.id === selectedDelivery.eventId)
    : undefined;
  const attempts = selectedDelivery
    ? state.attempts.filter((attempt) => attempt.deliveryId === selectedDelivery.id)
    : [];

  return createElement(
    "section",
    {
      "aria-label": "Outbound webhook reliability console",
      "data-state": "ready",
      "data-tenant-id": state.tenantId,
    },
    createElement("h1", null, "Outbound webhook reliability"),
    createFilterSummary(filter),
    createActionList(
      state.actions.filter((action) => action.targetId === state.tenantId),
      onAction,
    ),
    createEndpointList(state.endpoints, selectedEndpoint?.id, onSelectEndpoint),
    selectedEndpoint ? createEndpointDetail(selectedEndpoint, state.actions, onAction) : null,
    createDeliveryList(visibleDeliveries, selectedDelivery?.id, onSelectDelivery),
    selectedDelivery
      ? createDeliveryInspection(selectedDelivery, selectedEvent, attempts, state.actions, onAction)
      : null,
  );
}

function createFilterSummary(filter?: WebhookDeliveryOperationsFilter): ReactElement {
  const values = filter
    ? [
        ["Tenant", filter.tenantId],
        ["Endpoint", filter.endpointId],
        ["Event", filter.eventName],
        ["Schema", filter.schemaVersion],
        ["Subject", filter.subject],
        ["States", filter.states?.join(", ")],
        ["Problem", filter.problemCode],
        ["From", filter.from?.toISOString()],
        ["To", filter.to?.toISOString()],
      ].filter((entry): entry is [string, string] => entry[1] !== undefined)
    : [];

  return createElement(
    "section",
    { "aria-label": "Delivery filters" },
    createElement("h2", null, "Filters"),
    values.length === 0
      ? createElement("p", null, "No delivery filters applied.")
      : createElement(
          "dl",
          null,
          values.map(([label, value]) =>
            createElement(
              Fragment,
              { key: label },
              createElement("dt", null, label),
              createElement("dd", null, value),
            ),
          ),
        ),
  );
}

function createEndpointList(
  endpoints: readonly WebhookEndpointOperationsRow[],
  selectedEndpointId: string | undefined,
  onSelectEndpoint: WebhookReliabilityConsoleProps["onSelectEndpoint"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Webhook endpoints" },
    createElement("h2", null, "Endpoints"),
    createElement(
      "ul",
      null,
      endpoints.map((endpoint) =>
        createElement(
          "li",
          { key: endpoint.id },
          createElement(
            "button",
            {
              "aria-current": endpoint.id === selectedEndpointId ? "true" : undefined,
              onClick: () => onSelectEndpoint?.(endpoint.id),
              type: "button",
            },
            `${endpoint.maskedUrl} · ${endpoint.status}`,
          ),
        ),
      ),
    ),
  );
}

function createEndpointDetail(
  endpoint: WebhookEndpointOperationsRow,
  actions: readonly WebhookOperationsAction[],
  onAction: WebhookReliabilityConsoleProps["onAction"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": `Endpoint ${endpoint.id} details` },
    createElement("h2", null, "Endpoint details"),
    createElement("p", null, endpoint.maskedUrl),
    createElement(
      "p",
      null,
      `Status: ${endpoint.status}. Success rate: ${
        endpoint.successRate === undefined
          ? "unavailable"
          : `${Math.round(endpoint.successRate * 100)}%`
      }.`,
    ),
    createElement(
      "p",
      null,
      `Last success: ${endpoint.lastSuccessAt?.toISOString() ?? "Never"}. Last failure: ${
        endpoint.lastFailureAt?.toISOString() ?? "Never"
      }.`,
    ),
    createElement(
      "ul",
      { "aria-label": "Subscribed webhook events" },
      endpoint.subscriptions.map((subscription) =>
        createElement(
          "li",
          { key: `${subscription.name}:${subscription.schemaVersion}` },
          `${subscription.name} (${subscription.schemaVersion})`,
        ),
      ),
    ),
    createElement(
      "p",
      { "aria-label": "Secret rotation status" },
      `Active secret ${endpoint.secret.activeVersion}. ${
        endpoint.secret.previousVersion
          ? `Previous ${endpoint.secret.previousVersion} valid until ${
              endpoint.secret.previousValidUntil?.toISOString() ?? "revoked"
            }.`
          : "No previous secret version."
      }`,
    ),
    createActionList(
      actions.filter((action) => action.targetId === endpoint.id),
      onAction,
    ),
  );
}

function createDeliveryList(
  deliveries: readonly WebhookDeliveryOperationsRow[],
  selectedDeliveryId: string | undefined,
  onSelectDelivery: WebhookReliabilityConsoleProps["onSelectDelivery"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Webhook deliveries" },
    createElement("h2", null, "Deliveries"),
    deliveries.length === 0
      ? createElement("p", null, "No deliveries match the current filters.")
      : createElement(
          "table",
          null,
          createElement(
            "thead",
            null,
            createElement(
              "tr",
              null,
              createElement("th", { scope: "col" }, "Delivery"),
              createElement("th", { scope: "col" }, "Endpoint"),
              createElement("th", { scope: "col" }, "State"),
              createElement("th", { scope: "col" }, "Attempts"),
              createElement("th", { scope: "col" }, "Next retry"),
            ),
          ),
          createElement(
            "tbody",
            null,
            deliveries.map((delivery) =>
              createElement(
                "tr",
                { key: delivery.id },
                createElement(
                  "th",
                  { scope: "row" },
                  createElement(
                    "button",
                    {
                      "aria-current": delivery.id === selectedDeliveryId ? "true" : undefined,
                      onClick: () => onSelectDelivery?.(delivery.id),
                      type: "button",
                    },
                    delivery.id,
                  ),
                ),
                createElement("td", null, delivery.endpointId),
                createElement("td", null, delivery.status),
                createElement("td", null, String(delivery.attemptCount)),
                createElement("td", null, delivery.nextAttemptAt?.toISOString() ?? "None"),
              ),
            ),
          ),
        ),
  );
}

function createDeliveryInspection(
  delivery: WebhookDeliveryOperationsRow,
  event: WebhookLogicalEventOperationsRow | undefined,
  attempts: readonly WebhookAttemptOperationsRow[],
  actions: readonly WebhookOperationsAction[],
  onAction: WebhookReliabilityConsoleProps["onAction"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": `Delivery ${delivery.id} inspection` },
    createElement("h2", null, "Delivery inspection"),
    createElement(
      "p",
      null,
      event
        ? `Logical event ${event.id}: ${event.name} ${event.schemaVersion}, subject ${event.subject}.`
        : `Logical event ${delivery.eventId} is unavailable.`,
    ),
    createElement(
      "p",
      null,
      `Delivery ${delivery.status}. ${
        delivery.problem ? `Problem ${delivery.problem.code}.` : "No delivery Problem."
      }`,
    ),
    createElement(
      "p",
      null,
      `Correlation: ${delivery.correlationId ?? "Unavailable"}. Next retry: ${
        delivery.nextAttemptAt?.toISOString() ?? "None"
      }.`,
    ),
    createElement(
      "ol",
      { "aria-label": "Delivery attempt history" },
      attempts.length === 0
        ? createElement("li", null, "Attempt history is not available.")
        : attempts.map((attempt) =>
            createElement(
              "li",
              {
                "data-classification": attempt.classification,
                key: attempt.id,
              },
              createElement(
                "p",
                null,
                `Attempt ${attempt.number}: ${attempt.classification}; ${
                  attempt.responseStatus === undefined
                    ? "no response status"
                    : `HTTP ${attempt.responseStatus}`
                }; ${attempt.durationMs} ms.`,
              ),
              createElement(
                "p",
                null,
                `Secret version ${attempt.secretVersion}; correlation ${
                  attempt.correlationId ?? "unavailable"
                }; next retry ${attempt.nextRetryAt?.toISOString() ?? "none"}.`,
              ),
              attempt.problem ? createElement("p", null, `Problem ${attempt.problem.code}`) : null,
              attempt.redactedResponseExcerpt
                ? createElement(
                    "blockquote",
                    null,
                    redactWebhookOperationsText(attempt.redactedResponseExcerpt),
                  )
                : null,
            ),
          ),
    ),
    createActionList(
      actions.filter((action) => action.targetId === delivery.id),
      onAction,
    ),
  );
}

function createActionList(
  actions: readonly WebhookOperationsAction[],
  onAction: WebhookReliabilityConsoleProps["onAction"],
): ReactElement {
  return createElement(
    "div",
    { "aria-label": "Webhook operations actions" },
    actions.map((action) =>
      createElement(
        "button",
        {
          "aria-describedby": `${action.kind}-${action.targetId}-reason`,
          disabled: !action.allowed,
          key: `${action.kind}:${action.targetId}`,
          onClick: () => onAction?.(action),
          type: "button",
        },
        actionLabel(action.kind),
      ),
    ),
    actions.map((action) =>
      createElement(
        "p",
        {
          hidden: action.allowed,
          id: `${action.kind}-${action.targetId}-reason`,
          key: `${action.kind}:${action.targetId}:reason`,
        },
        action.reason,
      ),
    ),
  );
}

function createProblemNotice(problem: {
  readonly code: string;
  readonly detail?: string;
}): ReactElement {
  return createElement(
    "div",
    null,
    createElement("p", null, `Problem ${problem.code}`),
    problem.detail ? createElement("p", null, redactWebhookOperationsText(problem.detail)) : null,
  );
}

function actionLabel(kind: WebhookOperationsAction["kind"]): string {
  return kind
    .split("-")
    .map((part, index) => (index === 0 ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

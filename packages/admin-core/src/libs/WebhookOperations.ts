import { Problem, ProblemCategory } from "@croco/problems-core";

import type { AdminProblemContract } from "./types";

export type WebhookEndpointOperationalStatus = "active" | "paused" | "failing";

export type WebhookEventSubscription = {
  readonly name: string;
  readonly schemaVersion: string;
};

export type WebhookSecretVersionMetadata = {
  readonly activeVersion: string;
  readonly previousVersion?: string;
  readonly previousValidUntil?: Date;
};

export type WebhookEndpointOperationsRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly maskedUrl: string;
  readonly subscriptions: readonly WebhookEventSubscription[];
  readonly status: WebhookEndpointOperationalStatus;
  readonly successRate?: number;
  readonly lastSuccessAt?: Date;
  readonly lastFailureAt?: Date;
  readonly secret: WebhookSecretVersionMetadata;
};

export type WebhookDeliveryOperationsStatus =
  | "pending"
  | "accepted"
  | "delivered"
  | "retrying"
  | "dead"
  | "canceled"
  | "acceptance-unknown";

export type WebhookLogicalEventOperationsRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly schemaVersion: string;
  readonly subject: string;
  readonly occurredAt: Date;
  readonly committedAt: Date;
};

export type WebhookDeliveryOperationsRow = {
  readonly id: string;
  readonly eventId: string;
  readonly endpointId: string;
  readonly tenantId: string;
  readonly status: WebhookDeliveryOperationsStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly correlationId?: string;
  readonly problem?: AdminProblemContract;
  readonly replay?: {
    readonly allowed: boolean;
    readonly reason: string;
  };
};

export type WebhookAttemptRetryClassification =
  | "accepted"
  | "delivered"
  | "permanent"
  | "retryable"
  | "acceptance-unknown";

export type WebhookAttemptOperationsRow = {
  readonly id: string;
  readonly deliveryId: string;
  readonly number: number;
  readonly secretVersion: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly responseStatus?: number;
  readonly classification: WebhookAttemptRetryClassification;
  readonly nextRetryAt?: Date;
  readonly correlationId?: string;
  readonly redactedResponseExcerpt?: string;
  readonly problem?: AdminProblemContract;
};

export type WebhookDeliveryOperationsFilter = {
  readonly tenantId: string;
  readonly endpointId?: string;
  readonly eventName?: string;
  readonly schemaVersion?: string;
  readonly subject?: string;
  readonly states?: readonly WebhookDeliveryOperationsStatus[];
  readonly problemCode?: string;
  readonly from?: Date;
  readonly to?: Date;
};

export type WebhookOperationsActionKind =
  | "create-endpoint"
  | "update-subscriptions"
  | "pause-endpoint"
  | "resume-endpoint"
  | "rotate-secret"
  | "revoke-previous-secret"
  | "replay-delivery";

export type WebhookOperationsAction = {
  readonly kind: WebhookOperationsActionKind;
  readonly targetId: string;
  readonly permission: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditEvent: string;
};

export type WebhookOperationsWriteEvidence = {
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type WebhookOperationsActionRequest = WebhookOperationsWriteEvidence & {
  readonly tenantId: string;
  readonly action: WebhookOperationsActionKind;
  readonly targetId: string;
};

export type WebhookOperationsMutationExecutor<TResult> = {
  /**
   * Implementations must apply the mutation, idempotency claim, and audit append atomically.
   */
  execute(input: {
    readonly request: WebhookOperationsActionRequest;
    readonly action: WebhookOperationsAction;
  }): Promise<TResult>;
};

export type WebhookOperationsReadyState = {
  readonly kind: "ready";
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly endpoints: readonly WebhookEndpointOperationsRow[];
  readonly events: readonly WebhookLogicalEventOperationsRow[];
  readonly deliveries: readonly WebhookDeliveryOperationsRow[];
  readonly attempts: readonly WebhookAttemptOperationsRow[];
  readonly actions: readonly WebhookOperationsAction[];
};

export type WebhookOperationsState =
  | {
      readonly kind: "loading";
      readonly tenantId: string;
    }
  | {
      readonly kind: "empty";
      readonly tenantId: string;
      readonly message?: string;
    }
  | {
      readonly kind: "permission-denied";
      readonly tenantId: string;
      readonly problem: AdminProblemContract;
      readonly requiredPermissions: readonly string[];
    }
  | {
      readonly kind: "problem";
      readonly tenantId: string;
      readonly problem: AdminProblemContract;
      readonly partial?: WebhookOperationsReadyState;
    }
  | {
      readonly kind: "secret-created";
      readonly tenantId: string;
      readonly endpointId: string;
      readonly secretVersion: string;
      readonly oneTimeSecret: string;
      readonly expiresAt?: Date;
    }
  | WebhookOperationsReadyState;

export class WebhookOperationsActionValidationProblem extends Problem {
  constructor(field: keyof WebhookOperationsWriteEvidence) {
    super(
      "admin-core/webhook-action-validation-failed",
      ProblemCategory.ValidationError,
      `Outbound webhook operation requires a non-empty ${field}`,
      {
        extensions: { field },
      },
    );
  }
}

export function maskWebhookEndpointUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return "[invalid endpoint URL]";
  }
}

const AUTHORIZATION_HEADER = /(?:proxy-)?authorization/;
const COOKIE_HEADER = /(?:set-)?cookie/;
const NON_SIGNATURE_HEADER = `(?:${AUTHORIZATION_HEADER.source}|${COOKIE_HEADER.source}|x-api-key)`;
const SENSITIVE_WEBHOOK_HEADER = `(?:${NON_SIGNATURE_HEADER}|webhook-signature)`;
const SENSITIVE_DIAGNOSTIC_FIELD = /password|secret|token/;
const DOUBLE_QUOTED_CONTENT = /(?:\\[\s\S]|[^"\\])*/;
const SINGLE_QUOTED_CONTENT = /(?:\\[\s\S]|[^'\\])*/;
const QUOTED_FIELD_LABEL = `(?:"${DOUBLE_QUOTED_CONTENT.source}"|'${SINGLE_QUOTED_CONTENT.source}')`;
const QUOTED_DIAGNOSTIC_VALUE = String.raw`(?:"${DOUBLE_QUOTED_CONTENT.source}(?:"|\\?$)|'${SINGLE_QUOTED_CONTENT.source}(?:'|\\?$))`;
const TOKEN68 = /[a-z\d._~+/-]+=*/;
const HTTP_TOKEN = /[\w!#$%&'*+.^`|~-]+/;
const DIAGNOSTIC_FIELD = String.raw`(?:[\w.-]+|${QUOTED_FIELD_LABEL})[ \t]*[:=]`;
const SINGLE_TOKEN_END = /(?=[ \t]*(?:[,;\r\n]|$))/;
const FOLDED_AUTHORIZATION_SCHEME = String.raw`(?:${HTTP_TOKEN.source}[ \t]*\r?\n[ \t]+|(?:bearer|basic|digest|apikey)[ \t]*\r?\n)`;
const SIGNED_CREDENTIAL_SCOPE = String.raw`credential\s*=\s*${HTTP_TOKEN.source}(?:/${HTTP_TOKEN.source})+`;
const SIGNED_HEADER_NAMES = String.raw`signedheaders\s*=\s*${HTTP_TOKEN.source}(?:;${HTTP_TOKEN.source})*(?!;${HTTP_TOKEN.source})`;
// Unquoted names can be authorization parameters, even when they resemble response headers.
const AUTHORIZATION_PARAMETER = String.raw`(?:${SIGNED_CREDENTIAL_SCOPE}|${SIGNED_HEADER_NAMES}|(?!signedheaders\s*=)${HTTP_TOKEN.source}\s*=\s*(?:${QUOTED_FIELD_LABEL}|${HTTP_TOKEN.source}))${SINGLE_TOKEN_END.source}`;
const AUTHORIZATION_LIST_ELEMENT = String.raw`(?:,\s*)*${AUTHORIZATION_PARAMETER}`;
const AUTHORIZATION_CREDENTIALS = String.raw`(?:${AUTHORIZATION_LIST_ELEMENT}(?:\s*,\s*${AUTHORIZATION_LIST_ELEMENT})*(?!\s*,\s*${AUTHORIZATION_LIST_ELEMENT})|${TOKEN68.source})${SINGLE_TOKEN_END.source}`;
const AUTHORIZATION_TOKEN_BEFORE_PROSE = String.raw`${TOKEN68.source}(?=[ \t]+\S)`;
const FOLDED_AUTHORIZATION_BEFORE_PROSE = String.raw`(?:bearer|basic)[ \t]*\r?\n[ \t]*${AUTHORIZATION_TOKEN_BEFORE_PROSE}`;
const AUTHORIZATION_BEFORE_PROSE = String.raw`(?:(?:bearer|basic)[ \t]+${AUTHORIZATION_TOKEN_BEFORE_PROSE}|${FOLDED_AUTHORIZATION_BEFORE_PROSE})`;
const SIGNATURE_COMPONENT_NAME = /v\d+|t/;
const SIGNATURE_COMPONENT_LABEL = `(?:${SIGNATURE_COMPONENT_NAME.source}|"(?:${SIGNATURE_COMPONENT_NAME.source})"|'(?:${SIGNATURE_COMPONENT_NAME.source})')`;
const VERSIONED_SIGNATURE_CONTINUATION = String.raw`${SIGNATURE_COMPONENT_LABEL}\s*=`;
const SIGNATURE_COMPONENT = String.raw`${VERSIONED_SIGNATURE_CONTINUATION}\s*(?:${TOKEN68.source}|${QUOTED_DIAGNOSTIC_VALUE})`;
const STANDARD_SIGNATURE_VERSION = /v\d+[a-z]*/;
const SIGNATURE_WORD = `(?:${SIGNATURE_COMPONENT}|${TOKEN68.source})`;
const SIGNATURE_PART = `(?:${SIGNATURE_WORD}|${QUOTED_DIAGNOSTIC_VALUE})`;
const STANDARD_SIGNATURE_SEPARATOR = String.raw`\s+(?=${STANDARD_SIGNATURE_VERSION.source}\s*,)`;
const SIGNATURE_SEPARATOR = String.raw`(?:\s*,\s*|${STANDARD_SIGNATURE_SEPARATOR})`;
const SIGNATURE_CONTINUATION = `(?:${VERSIONED_SIGNATURE_CONTINUATION}|${SIGNATURE_PART}(?:${SINGLE_TOKEN_END.source}|(?=${STANDARD_SIGNATURE_SEPARATOR})))`;
const QUOTED_SIGNATURE_END = String.raw`(?!(?:${SIGNATURE_SEPARATOR}${SIGNATURE_CONTINUATION}|\s*;\s*${VERSIONED_SIGNATURE_CONTINUATION}))`;
const SIGNATURE_END = `${QUOTED_SIGNATURE_END}${SINGLE_TOKEN_END.source}`;
const BOUNDED_SIGNATURE_VALUE = String.raw`${SIGNATURE_PART}(?:${SIGNATURE_SEPARATOR}${SIGNATURE_PART})*${SIGNATURE_END}`;
const HEADER_EQUALS = /\s*=\s*/;
const HEADER_COLON = /\s*:\s*/;
const HEADER_ASSIGNMENT = /\s*[:=]\s*/;
const LEGACY_COLON_BOUNDARY = /(?<![^\s,;[{])/;
const QUOTED_MAP_FIELD = String.raw`(?:"${DOUBLE_QUOTED_CONTENT.source}"|(?<=[\s:=,\[{])'${SINGLE_QUOTED_CONTENT.source}')`;
const MAP_APOSTROPHE = /(?<![\s:=,[{])'/;
const MAP_STRUCTURE_TOKEN = new RegExp(
  String.raw`"${DOUBLE_QUOTED_CONTENT.source}(?:(")|\\?$)|(?<=[\s:=,\[{])'${SINGLE_QUOTED_CONTENT.source}(?:(')|\\?$)|[\[\]{},]`,
  "g",
);
const MAP_TERMINATOR = /(?=$|[\s,;)}\]]|[.!?:]+(?=$|\s))/y;
const DISTINCT_DIAGNOSTIC_FIELD = String.raw`(?:(?:[a-z][\w.-]*|'${SINGLE_QUOTED_CONTENT.source}')[ \t]*:|"${DOUBLE_QUOTED_CONTENT.source}"[ \t]*[:=])`;
const DISTINCT_MAP_FIELD = new RegExp(String.raw`\s*${DISTINCT_DIAGNOSTIC_FIELD}`, "iy");
const NEXT_COOKIE_DIAGNOSTIC_FIELD = String.raw`,\s*${DIAGNOSTIC_FIELD}`;
const NEXT_SET_COOKIE_DIAGNOSTIC_FIELD = String.raw`,\s*${DISTINCT_DIAGNOSTIC_FIELD}`;
const SENSITIVE_SCALAR_ASSIGNMENT = String.raw`["']?(?:${SENSITIVE_DIAGNOSTIC_FIELD.source})["']?${HEADER_ASSIGNMENT.source}`;
const SCALAR_VALUE = String.raw`(?:${QUOTED_DIAGNOSTIC_VALUE}|[^,\s;]+)`;
const ADJACENT_QUOTED_SENSITIVE_FIELD = String.raw`(?:[,;][ \t]*|[ \t](?=\S))(?:${SENSITIVE_SCALAR_ASSIGNMENT}|["']?${SENSITIVE_WEBHOOK_HEADER}["']?${HEADER_ASSIGNMENT.source})${QUOTED_DIAGNOSTIC_VALUE}`;
const WRAPPED_HEADER_VALUE = String.raw`(?:${ADJACENT_QUOTED_SENSITIVE_FIELD}|(?![,;][ \t]*${DISTINCT_DIAGNOSTIC_FIELD})[^\r\n])*`;

function boundedHeaderAssignments(separator: RegExp, context?: "quoted" | "map"): string {
  const label = (header: string) =>
    context === "quoted" ? `(?:"${header}"|'${header}')` : `["']?${header}["']?`;
  const scalarEnd = context === "map" ? SINGLE_TOKEN_END.source : "";
  return (
    String.raw`${label(AUTHORIZATION_HEADER.source)}${separator.source}(?:(?:${HTTP_TOKEN.source}[ \t]+|${FOLDED_AUTHORIZATION_SCHEME})${AUTHORIZATION_CREDENTIALS}|${AUTHORIZATION_BEFORE_PROSE}|${TOKEN68.source}${SINGLE_TOKEN_END.source})|` +
    `${label("webhook-signature")}${separator.source}${BOUNDED_SIGNATURE_VALUE}|` +
    `${label("x-api-key")}${separator.source}${SCALAR_VALUE}${scalarEnd}`
  );
}

function wrappedHeaderAssignment(header: string): string {
  return String.raw`(?:(?:"${header}"|'${header}')\s*[:=]|${header}\s*=)\s*`;
}

function cookieHeaderValue(nextField: string): string {
  return String.raw`(?:${QUOTED_MAP_FIELD}|${MAP_APOSTROPHE.source}|(?!${nextField})[^"'\r\n])+`;
}

const COOKIE_HEADER_VALUE = cookieHeaderValue(NEXT_COOKIE_DIAGNOSTIC_FIELD);
const SET_COOKIE_HEADER_VALUE = cookieHeaderValue(NEXT_SET_COOKIE_DIAGNOSTIC_FIELD);
const MAP_HEADER_ASSIGNMENT = new RegExp(
  String.raw`(\s*)["']?${SENSITIVE_WEBHOOK_HEADER}["']?${HEADER_ASSIGNMENT.source}`,
  "iy",
);
const SENSITIVE_MAP_FIELD = new RegExp(
  String.raw`\s*(?:["']?${NON_SIGNATURE_HEADER}["']?${HEADER_ASSIGNMENT.source}${QUOTED_DIAGNOSTIC_VALUE}${SINGLE_TOKEN_END.source}|["']?webhook-signature["']?${HEADER_ASSIGNMENT.source}${QUOTED_DIAGNOSTIC_VALUE}${SIGNATURE_END}|${boundedHeaderAssignments(HEADER_ASSIGNMENT, "map")}|["']?cookie["']?${HEADER_ASSIGNMENT.source}${COOKIE_HEADER_VALUE}(?=$|${NEXT_COOKIE_DIAGNOSTIC_FIELD})|["']?set-cookie["']?${HEADER_ASSIGNMENT.source}${SET_COOKIE_HEADER_VALUE}(?=$|${NEXT_SET_COOKIE_DIAGNOSTIC_FIELD}))`,
  "iy",
);
const SENSITIVE_WEBHOOK_TEXT = new RegExp(
  `${wrappedHeaderAssignment(NON_SIGNATURE_HEADER)}${QUOTED_DIAGNOSTIC_VALUE}|` +
    `${wrappedHeaderAssignment("webhook-signature")}${QUOTED_DIAGNOSTIC_VALUE}${QUOTED_SIGNATURE_END}|` +
    String.raw`${LEGACY_COLON_BOUNDARY.source}${AUTHORIZATION_HEADER.source}${HEADER_COLON.source}(?:${FOLDED_AUTHORIZATION_SCHEME}${AUTHORIZATION_CREDENTIALS}|${FOLDED_AUTHORIZATION_BEFORE_PROSE})|` +
    `${LEGACY_COLON_BOUNDARY.source}webhook-signature${HEADER_COLON.source}${BOUNDED_SIGNATURE_VALUE}|` +
    `${boundedHeaderAssignments(HEADER_EQUALS)}|` +
    `${boundedHeaderAssignments(HEADER_COLON, "quoted")}|` +
    `${wrappedHeaderAssignment("cookie")}${COOKIE_HEADER_VALUE}(?=${NEXT_COOKIE_DIAGNOSTIC_FIELD})|` +
    `${wrappedHeaderAssignment("set-cookie")}${SET_COOKIE_HEADER_VALUE}(?=${NEXT_SET_COOKIE_DIAGNOSTIC_FIELD})|` +
    `${wrappedHeaderAssignment(SENSITIVE_WEBHOOK_HEADER)}${WRAPPED_HEADER_VALUE}|` +
    String.raw`${LEGACY_COLON_BOUNDARY.source}${SENSITIVE_WEBHOOK_HEADER}\s*:[^\r\n]*|` +
    String.raw`${SENSITIVE_WEBHOOK_HEADER}\s*:\s*${SCALAR_VALUE}|` +
    `${SENSITIVE_SCALAR_ASSIGNMENT}${SCALAR_VALUE}|` +
    String.raw`\b(?:bearer|basic|digest|apikey)\s+[^\s,;]+`,
  "gi",
);

type DiagnosticContainerStart = { start: number; fieldStarts: number[] };

function* diagnosticContainers(
  value: string,
  tokens: readonly RegExpExecArray[],
): Generator<DiagnosticContainerStart & { end: number }> {
  const openers: DiagnosticContainerStart[] = [];
  const terminator = new RegExp(MAP_TERMINATOR);

  for (const token of tokens) {
    const symbol = token[0];
    if (symbol === "[" || symbol === "{") {
      openers.push({ start: token.index, fieldStarts: [token.index + 1] });
      continue;
    }
    if (symbol === ",") {
      openers.at(-1)?.fieldStarts.push(token.index + 1);
      continue;
    }
    if (symbol !== "]" && symbol !== "}") continue;

    const opener = openers.pop();
    if (!opener) continue;
    if (value[opener.start] !== (symbol === "]" ? "[" : "{")) {
      openers.length = 0;
      continue;
    }

    const end = token.index + 1;
    terminator.lastIndex = end;
    if (terminator.test(value)) yield { ...opener, end };
  }
}

function structuredHeaderFieldEnds(
  value: string,
  tokens: readonly RegExpExecArray[],
): Map<number, number> {
  const containers = [...diagnosticContainers(value, tokens)];
  const containerEnds = new Map(containers.map(({ start, end }) => [start, end]));
  const mapFieldEnds = new Map<number, number>();
  const assignment = new RegExp(MAP_HEADER_ASSIGNMENT);
  const field = new RegExp(SENSITIVE_MAP_FIELD);
  const distinctField = new RegExp(DISTINCT_MAP_FIELD);

  for (const container of containers) {
    const bodyStart = container.start + 1;
    const body = value.slice(bodyStart, container.end - 1);
    const distinctStarts = container.fieldStarts.slice(1).filter((start) => {
      distinctField.lastIndex = start - bodyStart;
      return distinctField.test(body);
    });
    let distinctIndex = 0;
    let coveredThrough = bodyStart;
    for (const fieldStart of container.fieldStarts) {
      // Combined values can cover several comma positions, including other sensitive-looking labels.
      if (fieldStart < coveredThrough) continue;
      const offset = fieldStart - bodyStart;
      assignment.lastIndex = offset;
      const header = assignment.exec(body);
      if (!header) continue;

      const start = fieldStart + (header[1]?.length ?? 0);
      const nestedEnd = containerEnds.get(bodyStart + assignment.lastIndex);
      if (nestedEnd !== undefined && nestedEnd < container.end) {
        mapFieldEnds.set(start, nestedEnd);
        coveredThrough = nestedEnd;
        continue;
      }

      field.lastIndex = offset;
      if (field.test(body)) {
        coveredThrough = bodyStart + field.lastIndex;
      } else {
        let nextDistinct = distinctStarts[distinctIndex];
        while (nextDistinct !== undefined && nextDistinct <= fieldStart) {
          nextDistinct = distinctStarts[++distinctIndex];
        }
        // Only a structurally distinct assignment ends an opaque value before the closing delimiter.
        coveredThrough = (nextDistinct ?? container.end) - 1;
      }
      mapFieldEnds.set(start, coveredThrough);
    }
  }
  return mapFieldEnds;
}

export function redactWebhookOperationsText(value: string): string {
  const tokens = [...value.matchAll(MAP_STRUCTURE_TOKEN)];
  const mapFieldEnds = structuredHeaderFieldEnds(value, tokens);
  const quotedText = tokens.filter((token) => token[1] || token[2]);
  const fields = new RegExp(SENSITIVE_WEBHOOK_TEXT);
  const redacted: string[] = [];
  let copiedThrough = 0;
  let quoteIndex = 0;
  for (let match = fields.exec(value); match; match = fields.exec(value)) {
    redacted.push(value.slice(copiedThrough, match.index), "[redacted]");
    copiedThrough = mapFieldEnds.get(match.index) ?? fields.lastIndex;
    let quote = quotedText[quoteIndex];
    while (quote && quote.index + quote[0].length - 1 <= match.index) {
      quote = quotedText[++quoteIndex];
    }
    if (quote && quote.index < match.index) {
      copiedThrough = Math.min(copiedThrough, quote.index + quote[0].length - 1);
    }
    fields.lastIndex = copiedThrough;
  }
  redacted.push(value.slice(copiedThrough));
  return redacted.join("");
}

export function createWebhookEndpointActions(
  endpoint: WebhookEndpointOperationsRow,
  grantedPermissions: readonly string[],
  now: Date = new Date(),
): readonly WebhookOperationsAction[] {
  const writeAllowed = grantedPermissions.includes("webhooks:write");
  const rotateAllowed = grantedPermissions.includes("webhooks:secrets:rotate");
  const previousSecretActive =
    endpoint.secret.previousVersion !== undefined &&
    (endpoint.secret.previousValidUntil === undefined || endpoint.secret.previousValidUntil > now);

  return [
    createAction(
      "update-subscriptions",
      endpoint.id,
      "webhooks:write",
      writeAllowed,
      writeAllowed ? "Subscriptions can be updated" : "Missing webhooks:write permission",
    ),
    createAction(
      endpoint.status === "paused" ? "resume-endpoint" : "pause-endpoint",
      endpoint.id,
      "webhooks:write",
      writeAllowed,
      writeAllowed
        ? endpoint.status === "paused"
          ? "After activation, resume can schedule pending deliveries and retrying deliveries whose retry time has passed"
          : "New delivery dispatch can be paused; already accepted work is not canceled"
        : "Missing webhooks:write permission",
    ),
    createAction(
      "rotate-secret",
      endpoint.id,
      "webhooks:secrets:rotate",
      rotateAllowed,
      rotateAllowed
        ? "A new secret can be presented once; existing secret values remain unavailable"
        : "Missing webhooks:secrets:rotate permission",
    ),
    createAction(
      "revoke-previous-secret",
      endpoint.id,
      "webhooks:secrets:rotate",
      rotateAllowed && previousSecretActive,
      !rotateAllowed
        ? "Missing webhooks:secrets:rotate permission"
        : previousSecretActive
          ? "The previous secret version can be revoked"
          : "No active previous secret version exists",
    ),
  ];
}

export function createWebhookEndpointCreationAction(
  tenantId: string,
  grantedPermissions: readonly string[],
): WebhookOperationsAction {
  const permission = "webhooks:write";
  const allowed = grantedPermissions.includes(permission);
  return createAction(
    "create-endpoint",
    tenantId,
    permission,
    allowed,
    allowed
      ? "An endpoint can be created with one-time secret presentation"
      : `Missing ${permission} permission`,
  );
}

export function createWebhookDeliveryAction(
  delivery: WebhookDeliveryOperationsRow,
  endpoint: WebhookEndpointOperationsRow | undefined,
  grantedPermissions: readonly string[],
): WebhookOperationsAction {
  const permission = "webhooks:replay";
  const replayableStatuses: readonly WebhookDeliveryOperationsStatus[] = [
    "delivered",
    "dead",
    "canceled",
    "acceptance-unknown",
  ];
  const replayable =
    replayableStatuses.includes(delivery.status) && delivery.replay?.allowed === true;
  const allowed =
    grantedPermissions.includes(permission) && endpoint?.status === "active" && replayable;
  const reason = !grantedPermissions.includes(permission)
    ? `Missing ${permission} permission`
    : endpoint?.status !== "active"
      ? "Endpoint must be active before replay"
      : !replayableStatuses.includes(delivery.status)
        ? `Delivery state ${delivery.status} is not replayable`
        : replayable
          ? "Core delivery state allows replay of the existing logical event"
          : (delivery.replay?.reason ??
            "Core webhook contract did not declare this delivery safe to replay");

  return createAction("replay-delivery", delivery.id, permission, allowed, reason);
}

export function assertWebhookOperationsActionRequest(
  request: WebhookOperationsActionRequest,
): WebhookOperationsActionRequest {
  for (const field of ["actorId", "reason", "idempotencyKey"] as const) {
    if (request[field].trim() === "") {
      throw new WebhookOperationsActionValidationProblem(field);
    }
  }
  return request;
}

export async function executeWebhookOperationsAction<TResult>(input: {
  readonly request: WebhookOperationsActionRequest;
  readonly action: WebhookOperationsAction;
  readonly expectedTenantId: string;
  readonly grantedPermissions: readonly string[];
  readonly executor: WebhookOperationsMutationExecutor<TResult>;
}): Promise<TResult> {
  const request = assertWebhookOperationsActionRequest(input.request);
  const matchesAction =
    request.action === input.action.kind && request.targetId === input.action.targetId;
  if (
    request.tenantId !== input.expectedTenantId ||
    !matchesAction ||
    !input.action.allowed ||
    !input.grantedPermissions.includes(input.action.permission)
  ) {
    throw new WebhookOperationsActionValidationProblem("reason");
  }
  return input.executor.execute({ action: input.action, request });
}

export function filterWebhookDeliveries(
  state: WebhookOperationsReadyState,
  filter: WebhookDeliveryOperationsFilter,
): readonly WebhookDeliveryOperationsRow[] {
  const events = new Map(state.events.map((event) => [event.id, event]));
  return state.deliveries.filter((delivery) => {
    const event = events.get(delivery.eventId);
    return (
      delivery.tenantId === filter.tenantId &&
      (filter.endpointId === undefined || delivery.endpointId === filter.endpointId) &&
      (filter.eventName === undefined || event?.name === filter.eventName) &&
      (filter.schemaVersion === undefined || event?.schemaVersion === filter.schemaVersion) &&
      (filter.subject === undefined || event?.subject === filter.subject) &&
      (filter.states === undefined || filter.states.includes(delivery.status)) &&
      (filter.problemCode === undefined || delivery.problem?.code === filter.problemCode) &&
      (filter.from === undefined || delivery.updatedAt >= filter.from) &&
      (filter.to === undefined || delivery.updatedAt <= filter.to)
    );
  });
}

function createAction(
  kind: WebhookOperationsActionKind,
  targetId: string,
  permission: string,
  allowed: boolean,
  reason: string,
): WebhookOperationsAction {
  return {
    allowed,
    auditEvent: `webhook.${kind}`,
    kind,
    permission,
    reason,
    targetId,
  };
}

import { Problem, ProblemCategory } from "@croco/problems-core";
import type { MessageChannel } from "./MessageContracts";
import type { RecipientRef } from "./RecipientContracts";

export type EngagementEndpointChannel = Extract<MessageChannel, "email" | "push">;

export type EngagementEvidence = Readonly<{
  providerCategory?: string;
  providerCode?: string;
  bounceKind?: "hard" | "soft";
}>;

const ENGAGEMENT_EVIDENCE_FIELDS = new Set(["providerCategory", "providerCode", "bounceKind"]);
const ENGAGEMENT_EVIDENCE_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type EndpointInvalidationReason =
  | "hard-bounce"
  | "complaint"
  | "unsubscribe"
  | "token-invalid"
  | "manual"
  | "other";

type ContactEndpointBase = Readonly<{
  id: string;
  tenantId: string;
  recipientId: string;
  lastSeenAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  invalidatedAt?: Date;
  invalidationReason?: EndpointInvalidationReason;
}>;

export type EmailContactEndpoint = ContactEndpointBase &
  Readonly<{
    kind: "email";
    address: string;
  }>;

export type PushContactEndpoint = ContactEndpointBase &
  Readonly<{
    kind: "push";
    provider: string;
    app: string;
    platform: string;
    environment: string;
    tokenReference: string;
  }>;

export type ContactEndpoint = EmailContactEndpoint | PushContactEndpoint;

export type SaveContactEndpointInput =
  | Readonly<{
      id: string;
      tenantId: string;
      recipientId: string;
      kind: "email";
      address: string;
      lastSeenAt: Date;
    }>
  | Readonly<{
      id: string;
      tenantId: string;
      recipientId: string;
      kind: "push";
      provider: string;
      app: string;
      platform: string;
      environment: string;
      tokenReference: string;
      lastSeenAt: Date;
    }>;

export type InvalidateContactEndpointInput = Readonly<{
  tenantId: string;
  endpointId: string;
  expectedVersion: number;
  reason: EndpointInvalidationReason;
  invalidatedAt: Date;
}>;

export type ContactEndpointInvalidationResult =
  | Readonly<{ status: "invalidated"; endpoint: ContactEndpoint }>
  | Readonly<{ status: "already-invalid"; endpoint: ContactEndpoint }>
  | Readonly<{ status: "version-mismatch"; endpoint: ContactEndpoint }>
  | Readonly<{ status: "not-found" }>;

export interface ContactEndpointStore {
  saveEndpoint(input: SaveContactEndpointInput): Promise<ContactEndpoint>;
  getEndpoint(tenantId: string, endpointId: string): Promise<ContactEndpoint | undefined>;
  listActiveEndpoints(tenantId: string, recipientId: string): Promise<readonly ContactEndpoint[]>;
  invalidateEndpoint(
    input: InvalidateContactEndpointInput,
  ): Promise<ContactEndpointInvalidationResult>;
}

export type EngagementPreferenceState = "allow" | "deny";
export type EngagementPreferenceScope = "recipient" | "tenant";

export type EngagementPreference = Readonly<{
  tenantId: string;
  recipientId?: string;
  scope: EngagementPreferenceScope;
  topic: string;
  channel: MessageChannel;
  state: EngagementPreferenceState;
  source: string;
  changedAt: Date;
  evidence?: EngagementEvidence;
}>;

export type EngagementPreferenceLookup = Readonly<{
  tenantId: string;
  recipientId: string;
  topic: string;
  channel: MessageChannel;
}>;

export interface EngagementPreferenceStore {
  setPreference(preference: EngagementPreference): Promise<void>;
  resolvePreference(input: EngagementPreferenceLookup): Promise<EngagementPreference | undefined>;
}

export type EngagementSuppression = Readonly<{
  id: string;
  tenantId: string;
  recipientId?: string;
  endpointId?: string;
  channel: MessageChannel;
  topic?: string;
  reason: string;
  source: string;
  createdAt: Date;
  expiresAt?: Date;
  evidence?: EngagementEvidence;
}>;

export type EngagementSuppressionLookup = Readonly<{
  tenantId: string;
  recipientId: string;
  endpointId: string;
  channel: MessageChannel;
  topic: string;
  at: Date;
}>;

export interface SuppressionStore {
  saveSuppression(suppression: EngagementSuppression): Promise<void>;
  findActiveSuppressions(
    input: EngagementSuppressionLookup,
  ): Promise<readonly EngagementSuppression[]>;
}

export type EngagementDispatchOutcome =
  | Readonly<{
      kind: "queued";
      executionIds: readonly string[];
      providerMessageIds?: readonly string[];
    }>
  | Readonly<{ kind: "suppressed"; reason: "preference" | "suppression" }>
  | Readonly<{ kind: "unavailable"; reason: "no-endpoint" }>
  | Readonly<{ kind: "skipped"; reason: "policy" }>
  | Readonly<{
      kind: "failed";
      stage: "preparation" | "render" | "provider" | "network" | "persistence";
      failureCode: string;
      retryable: boolean;
      executionIds: readonly string[];
    }>;

export type EngagementDispatchIdentity = Readonly<{
  tenantId: string;
  messageId: string;
  recipientId: string;
  channel: MessageChannel;
  semanticKey: string;
}>;

export type EngagementDispatchTarget = Readonly<{
  endpointId: string;
  endpointVersion: number;
  executionId?: string;
  provider?: string;
  providerMessageId?: string;
}>;

export type EngagementDispatch = EngagementDispatchIdentity &
  Readonly<{
    id: string;
    topic: string;
    targets: readonly EngagementDispatchTarget[];
    outcome: EngagementDispatchOutcome;
    createdAt: Date;
    updatedAt: Date;
  }>;

export type RecordEngagementDispatchInput = EngagementDispatchIdentity &
  Readonly<{
    topic: string;
    targets: readonly EngagementDispatchTarget[];
    outcome: EngagementDispatchOutcome;
    recordedAt: Date;
  }>;

export type EngagementDispatchHistoryCursor = Readonly<{
  updatedAt: Date;
  dispatchId: string;
}>;

export type EngagementDispatchHistoryPage = Readonly<{
  items: readonly EngagementDispatch[];
  nextCursor?: EngagementDispatchHistoryCursor;
}>;

export interface EngagementDispatchStore {
  recordDispatch(input: RecordEngagementDispatchInput): Promise<EngagementDispatch>;
  getDispatch(tenantId: string, dispatchId: string): Promise<EngagementDispatch | undefined>;
  findByIdentity(identity: EngagementDispatchIdentity): Promise<EngagementDispatch | undefined>;
  listByRecipient(
    tenantId: string,
    recipientId: string,
    options: Readonly<{ limit: number; after?: EngagementDispatchHistoryCursor }>,
  ): Promise<EngagementDispatchHistoryPage>;
}

export const ENGAGEMENT_DELIVERY_EVENT_TYPES = [
  "accepted",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "token-invalid",
  "expired",
  "failed",
] as const;

export type EngagementDeliveryEventType = (typeof ENGAGEMENT_DELIVERY_EVENT_TYPES)[number];

export type EngagementDeliveryEvent = Readonly<{
  id: string;
  tenantId: string;
  provider: string;
  providerEventId: string;
  dispatchId: string;
  endpointId: string;
  type: EngagementDeliveryEventType;
  occurredAt: Date;
  evidence?: EngagementEvidence;
  recordedAt: Date;
}>;

export type RecordEngagementDeliveryEventInput = Omit<
  EngagementDeliveryEvent,
  "id" | "recordedAt"
> &
  Readonly<{ recordedAt: Date }>;

export type EngagementDeliveryEventRecordResult = Readonly<{
  event: EngagementDeliveryEvent;
  duplicate: boolean;
}>;

export interface EngagementDeliveryEventStore {
  recordDeliveryEvent(
    input: RecordEngagementDeliveryEventInput,
  ): Promise<EngagementDeliveryEventRecordResult>;
  listByDispatch(tenantId: string, dispatchId: string): Promise<readonly EngagementDeliveryEvent[]>;
}

export interface EngagementStoreTransaction
  extends
    ContactEndpointStore,
    EngagementPreferenceStore,
    SuppressionStore,
    EngagementDispatchStore,
    EngagementDeliveryEventStore {}

export interface EngagementPersistence extends EngagementStoreTransaction {
  transaction<TResult>(
    operation: (stores: EngagementStoreTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export function createEngagementDispatchIdentityKey(identity: EngagementDispatchIdentity): string {
  return [
    identity.tenantId,
    identity.messageId,
    identity.recipientId,
    identity.channel,
    identity.semanticKey,
  ]
    .map(encodeURIComponent)
    .join(":");
}

export function createEngagementDispatchId(identity: EngagementDispatchIdentity): string {
  return `engagement-dispatch:${createEngagementDispatchIdentityKey(identity)}`;
}

export function createEngagementDeliveryEventId(
  tenantId: string,
  provider: string,
  providerEventId: string,
): string {
  return ["engagement-event", tenantId, provider, providerEventId]
    .map(encodeURIComponent)
    .join(":");
}

export function recipientRefForEndpoint(endpoint: ContactEndpoint): RecipientRef {
  return { tenantId: endpoint.tenantId, userId: endpoint.recipientId };
}

export class EngagementStoreValidationProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/store-input-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { retryable: false },
    });
  }
}

export class EngagementPersistenceProblem extends Problem {
  constructor(operation: string, tenantId: string, cause: Error) {
    super(
      "engagement-core/persistence-failed",
      ProblemCategory.InternalServerError,
      `Engagement persistence operation ${operation} failed for tenant ${tenantId}`,
      {
        cause,
        extensions: { operation, tenantId, retryable: true },
      },
    );
  }
}

export function assertEngagementStoreText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new EngagementStoreValidationProblem(`${field} must not be empty`);
  }
}

export function assertEngagementPreference(preference: EngagementPreference): void {
  assertEngagementStoreText(preference.tenantId, "Preference tenantId");
  assertEngagementStoreText(preference.topic, "Preference topic");
  assertEngagementStoreText(preference.source, "Preference source");
  if (preference.scope === "recipient") {
    assertEngagementStoreText(preference.recipientId ?? "", "Recipient preference recipientId");
  } else if (preference.recipientId !== undefined) {
    throw new EngagementStoreValidationProblem("Tenant preference must not declare a recipientId");
  }
}

export function assertEngagementSuppression(suppression: EngagementSuppression): void {
  assertEngagementStoreText(suppression.id, "Suppression id");
  assertEngagementStoreText(suppression.tenantId, "Suppression tenantId");
  if (suppression.recipientId === undefined && suppression.endpointId === undefined) {
    throw new EngagementStoreValidationProblem("Suppression must target a recipient or endpoint");
  }
}

export function normalizeEngagementEvidence(
  evidence: EngagementEvidence | undefined,
): EngagementEvidence | undefined {
  if (evidence === undefined) return undefined;
  if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new EngagementStoreValidationProblem("Engagement evidence must be an object");
  }

  const record = evidence as Readonly<Record<string, unknown>>;
  const unsupportedField = Object.keys(record).find(
    (field) => !ENGAGEMENT_EVIDENCE_FIELDS.has(field),
  );
  if (unsupportedField !== undefined) {
    throw new EngagementStoreValidationProblem("Engagement evidence contains an unsupported field");
  }

  const providerCategory = evidenceValue(record.providerCategory, "providerCategory");
  const providerCode = evidenceValue(record.providerCode, "providerCode");
  const bounceKind = record.bounceKind;
  if (bounceKind !== undefined && bounceKind !== "hard" && bounceKind !== "soft") {
    throw new EngagementStoreValidationProblem(
      "Engagement evidence bounceKind must be hard or soft",
    );
  }

  return {
    ...(providerCategory === undefined ? {} : { providerCategory }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(bounceKind === undefined ? {} : { bounceKind }),
  };
}

function evidenceValue(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !ENGAGEMENT_EVIDENCE_VALUE_PATTERN.test(value)) {
    throw new EngagementStoreValidationProblem(
      `Engagement evidence ${field} must be a bounded opaque identifier`,
    );
  }
  return value;
}

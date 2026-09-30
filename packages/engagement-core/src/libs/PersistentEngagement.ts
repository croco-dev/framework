import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  EngagementSuppressionContext,
  EngagementSuppressionDecision,
  EngagementSuppressionEvaluator,
  PushEndpoint,
  RecipientDirectory,
  RecipientRef,
  ResolvedRecipient,
} from "./EngagementService";
import type {
  ContactEndpoint,
  ContactEndpointStore,
  EngagementDeliveryEventProcessingResult,
  EngagementDispatch,
  EngagementPersistence,
  EngagementPreferenceState,
  EngagementPreferenceStore,
  EngagementSuppressionLookup,
  RecordEngagementDeliveryEventInput,
  SuppressionStore,
} from "./EngagementStores";

export type { EngagementDeliveryEventProcessingResult } from "./EngagementStores";

/** Combines an application-owned recipient directory with durable endpoint state. */
export class StoreBackedRecipientDirectory implements RecipientDirectory {
  constructor(
    private readonly recipients: RecipientDirectory,
    private readonly endpoints: ContactEndpointStore,
  ) {}

  async resolve(ref: RecipientRef): Promise<ResolvedRecipient | undefined> {
    const profile = await this.recipients.resolve(ref);
    if (profile === undefined) return undefined;

    const endpoints = await this.endpoints.listActiveEndpoints(ref.tenantId, ref.userId);
    const emails = endpoints
      .filter(
        (endpoint): endpoint is Extract<ContactEndpoint, { kind: "email" }> =>
          endpoint.kind === "email",
      )
      .map((endpoint) => ({
        id: endpoint.id,
        address: endpoint.address,
        version: endpoint.version,
      }));
    const push = endpoints
      .filter(
        (endpoint): endpoint is Extract<ContactEndpoint, { kind: "push" }> =>
          endpoint.kind === "push",
      )
      .map(
        (endpoint): PushEndpoint => ({
          id: endpoint.id,
          tokenReference: endpoint.tokenReference,
          provider: endpoint.provider,
          app: endpoint.app,
          platform: endpoint.platform,
          environment: endpoint.environment,
          lastSeenAt: new Date(endpoint.lastSeenAt.getTime()),
          version: endpoint.version,
        }),
      );

    return {
      recipient: { ...profile.recipient },
      ...(emails[0] === undefined ? {} : { email: emails[0] }),
      emails,
      push,
      ...(profile.locale === undefined ? {} : { locale: profile.locale }),
      ...(profile.timezone === undefined ? {} : { timezone: profile.timezone }),
    };
  }
}

export type StoredEngagementPolicyOptions = Readonly<{
  globalDefault?: EngagementPreferenceState;
  topicDefaults?: Readonly<Record<string, EngagementPreferenceState>>;
  clock?: () => Date;
}>;

/** Resolves durable suppressions and recipient/tenant preference state fail-closed. */
export class StoredEngagementPolicyEvaluator implements EngagementSuppressionEvaluator {
  private readonly clock: () => Date;

  constructor(
    private readonly preferences: EngagementPreferenceStore,
    private readonly suppressions: SuppressionStore,
    private readonly options: StoredEngagementPolicyOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
  }

  async evaluate(context: EngagementSuppressionContext): Promise<EngagementSuppressionDecision> {
    const lookup: EngagementSuppressionLookup = {
      tenantId: context.recipient.tenantId,
      recipientId: context.recipient.userId,
      endpointId: context.endpointId,
      channel: context.channel,
      topic: context.topic,
      at: this.clock(),
    };
    const activeSuppressions = await this.suppressions.findActiveSuppressions(lookup);
    if (activeSuppressions.length > 0) {
      return { suppressed: true, kind: "suppression", reason: activeSuppressions[0]?.reason };
    }

    const stored = await this.preferences.resolvePreference({
      tenantId: context.recipient.tenantId,
      recipientId: context.recipient.userId,
      topic: context.topic,
      channel: context.channel,
    });
    if (stored !== undefined) {
      return {
        suppressed: stored.state === "deny",
        kind: "preference",
        reason: `${stored.scope}-${stored.state}`,
      };
    }

    const fallback = this.options.topicDefaults?.[context.topic] ?? this.options.globalDefault;
    return {
      suppressed: fallback !== "allow",
      kind: "preference",
      reason: fallback === undefined ? "explicit-default-required" : `global-${fallback}`,
    };
  }
}

/** Atomically deduplicates normalized delivery events and applies terminal endpoint policy. */
export class EngagementDeliveryEventProcessor {
  constructor(private readonly persistence: EngagementPersistence) {}

  async process(
    input: RecordEngagementDeliveryEventInput,
  ): Promise<EngagementDeliveryEventProcessingResult> {
    return this.persistence.transaction(async (stores) => {
      const dispatch = await stores.getDispatch(input.tenantId, input.dispatchId);
      const target = dispatch?.targets.find(
        (candidate) => candidate.endpointId === input.endpointId,
      );
      if (
        dispatch === undefined ||
        target === undefined ||
        !wasDispatchTargetEnqueued(dispatch, target, input.type)
      ) {
        throw new EngagementDeliveryEventCorrelationProblem(input.tenantId);
      }

      const event = await stores.recordDeliveryEvent(input);
      if (event.duplicate || !isTerminalEndpointEvent(input)) return { event };

      const endpoint = await stores.getEndpoint(input.tenantId, input.endpointId);
      if (endpoint === undefined || endpoint.recipientId !== dispatch.recipientId) {
        throw new EngagementDeliveryEventCorrelationProblem(input.tenantId);
      }
      assertTerminalChannel(input, endpoint);
      const invalidation = await stores.invalidateEndpoint({
        tenantId: input.tenantId,
        endpointId: input.endpointId,
        expectedVersion: target.endpointVersion,
        reason: invalidationReason(input),
        invalidatedAt: input.occurredAt,
      });
      return { event, invalidation };
    });
  }
}

function wasDispatchTargetEnqueued(
  dispatch: EngagementDispatch,
  target: EngagementDispatch["targets"][number],
  eventType: RecordEngagementDeliveryEventInput["type"],
): boolean {
  return (
    dispatch.outcome.kind === "queued" ||
    target.executionId !== undefined ||
    (eventType === "token-invalid" &&
      dispatch.channel === "push" &&
      dispatch.outcome.kind === "failed" &&
      dispatch.outcome.stage === "provider")
  );
}

export class EngagementDeliveryEventCorrelationProblem extends Problem {
  constructor(tenantId: string) {
    super(
      "engagement-core/delivery-event-correlation-invalid",
      ProblemCategory.ValidationError,
      `Delivery event correlation is invalid for tenant ${tenantId}`,
      { extensions: { tenantId, retryable: false } },
    );
  }
}

function isTerminalEndpointEvent(input: RecordEngagementDeliveryEventInput): boolean {
  return (
    (input.type === "bounced" && input.evidence?.bounceKind === "hard") ||
    input.type === "complained" ||
    input.type === "unsubscribed" ||
    input.type === "token-invalid"
  );
}

function assertTerminalChannel(
  input: RecordEngagementDeliveryEventInput,
  endpoint: ContactEndpoint,
): void {
  const compatible =
    input.type === "token-invalid" ? endpoint.kind === "push" : endpoint.kind === "email";
  if (!compatible) {
    throw new EngagementDeliveryEventCorrelationProblem(input.tenantId);
  }
}

function invalidationReason(
  input: RecordEngagementDeliveryEventInput,
): "hard-bounce" | "complaint" | "unsubscribe" | "token-invalid" {
  switch (input.type) {
    case "bounced":
      return "hard-bounce";
    case "complained":
      return "complaint";
    case "unsubscribed":
      return "unsubscribe";
    case "token-invalid":
      return "token-invalid";
    default:
      throw new EngagementDeliveryEventCorrelationProblem(input.tenantId);
  }
}

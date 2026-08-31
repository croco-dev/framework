import {
  assertEngagementPreference,
  assertEngagementStoreText,
  assertEngagementSuppression,
  createEngagementDeliveryEventId,
  createEngagementDispatchId,
  createEngagementDispatchIdentityKey,
  normalizeEngagementEvidence,
  type ContactEndpoint,
  type ContactEndpointInvalidationResult,
  type EngagementDeliveryEvent,
  type EngagementDeliveryEventRecordResult,
  type EngagementDispatch,
  type EngagementDispatchHistoryPage,
  type EngagementDispatchIdentity,
  type EngagementPersistence,
  type EngagementPreference,
  type EngagementPreferenceLookup,
  type EngagementStoreTransaction,
  type EngagementSuppression,
  type EngagementSuppressionLookup,
  EngagementStoreValidationProblem,
  type InvalidateContactEndpointInput,
  type RecordEngagementDeliveryEventInput,
  type RecordEngagementDispatchInput,
  type SaveContactEndpointInput,
} from "./EngagementStores";

type InMemoryEngagementState = {
  endpoints: Map<string, ContactEndpoint>;
  preferences: Map<string, EngagementPreference>;
  suppressions: Map<string, EngagementSuppression>;
  dispatches: Map<string, EngagementDispatch>;
  dispatchIdsByIdentity: Map<string, string>;
  deliveryEvents: Map<string, EngagementDeliveryEvent>;
  mutationTail: Promise<void>;
};

function createState(): InMemoryEngagementState {
  return {
    endpoints: new Map(),
    preferences: new Map(),
    suppressions: new Map(),
    dispatches: new Map(),
    dispatchIdsByIdentity: new Map(),
    deliveryEvents: new Map(),
    mutationTail: Promise.resolve(),
  };
}

/** In-memory reference implementation of every engagement persistence contract. */
export class InMemoryEngagementStore implements EngagementPersistence {
  constructor(
    private readonly state: InMemoryEngagementState = createState(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Creates a new store object over the same in-memory backing state. */
  reopen(): InMemoryEngagementStore {
    return new InMemoryEngagementStore(this.state, this.clock);
  }

  async saveEndpoint(input: SaveContactEndpointInput): Promise<ContactEndpoint> {
    return this.mutate(() => {
      assertEngagementStoreText(input.id, "Endpoint id");
      assertEngagementStoreText(input.tenantId, "Endpoint tenantId");
      assertEngagementStoreText(input.recipientId, "Endpoint recipientId");
      assertEngagementStoreText(
        input.kind === "email" ? input.address : input.tokenReference,
        input.kind === "email" ? "Email address" : "Push token reference",
      );
      if (input.kind === "push") {
        assertEngagementStoreText(input.provider, "Push provider");
        assertEngagementStoreText(input.app, "Push app");
        assertEngagementStoreText(input.platform, "Push platform");
        assertEngagementStoreText(input.environment, "Push environment");
      }
      const now = this.clock();
      const existing = this.state.endpoints.get(endpointKey(input.tenantId, input.id));
      const common = {
        id: input.id,
        tenantId: input.tenantId,
        recipientId: input.recipientId,
        lastSeenAt: cloneDate(input.lastSeenAt),
        version: (existing?.version ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(existing?.invalidatedAt === undefined
          ? {}
          : {
              invalidatedAt: existing.invalidatedAt,
              invalidationReason: existing.invalidationReason,
            }),
      };
      const endpoint: ContactEndpoint =
        input.kind === "email"
          ? { ...common, kind: "email", address: input.address }
          : {
              ...common,
              kind: "push",
              provider: input.provider,
              app: input.app,
              platform: input.platform,
              environment: input.environment,
              tokenReference: input.tokenReference,
            };
      this.state.endpoints.set(endpointKey(input.tenantId, input.id), clone(endpoint));
      return clone(endpoint);
    });
  }

  async getEndpoint(tenantId: string, endpointId: string): Promise<ContactEndpoint | undefined> {
    const endpoint = this.state.endpoints.get(endpointKey(tenantId, endpointId));
    return endpoint === undefined ? undefined : clone(endpoint);
  }

  async listActiveEndpoints(
    tenantId: string,
    recipientId: string,
  ): Promise<readonly ContactEndpoint[]> {
    return [...this.state.endpoints.values()]
      .filter(
        (endpoint) =>
          endpoint.tenantId === tenantId &&
          endpoint.recipientId === recipientId &&
          endpoint.invalidatedAt === undefined,
      )
      .sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
      .map(clone);
  }

  async invalidateEndpoint(
    input: InvalidateContactEndpointInput,
  ): Promise<ContactEndpointInvalidationResult> {
    return this.mutate(() => {
      const key = endpointKey(input.tenantId, input.endpointId);
      const endpoint = this.state.endpoints.get(key);
      if (endpoint === undefined) return { status: "not-found" };
      if (endpoint.invalidatedAt !== undefined) {
        return { status: "already-invalid", endpoint: clone(endpoint) };
      }
      if (endpoint.version !== input.expectedVersion) {
        return { status: "version-mismatch", endpoint: clone(endpoint) };
      }
      const invalidated: ContactEndpoint = {
        ...endpoint,
        invalidatedAt: cloneDate(input.invalidatedAt),
        invalidationReason: input.reason,
        updatedAt: cloneDate(input.invalidatedAt),
        version: endpoint.version + 1,
      };
      this.state.endpoints.set(key, clone(invalidated));
      return { status: "invalidated", endpoint: clone(invalidated) };
    });
  }

  async setPreference(preference: EngagementPreference): Promise<void> {
    return this.mutate(() => {
      assertEngagementPreference(preference);
      const evidence = normalizeEngagementEvidence(preference.evidence);
      const stored = {
        ...preference,
        ...(evidence === undefined ? {} : { evidence }),
      };
      this.state.preferences.set(preferenceKey(preference), clone(stored));
    });
  }

  async resolvePreference(
    input: EngagementPreferenceLookup,
  ): Promise<EngagementPreference | undefined> {
    const recipient = this.state.preferences.get(
      preferenceKey({
        ...input,
        scope: "recipient",
        state: "deny",
        source: "",
        changedAt: new Date(),
      }),
    );
    if (recipient !== undefined) return clone(recipient);
    const tenant = this.state.preferences.get(
      preferenceKey({
        tenantId: input.tenantId,
        scope: "tenant",
        topic: input.topic,
        channel: input.channel,
        state: "deny",
        source: "",
        changedAt: new Date(),
      }),
    );
    return tenant === undefined ? undefined : clone(tenant);
  }

  async findActiveSuppressions(
    input: EngagementSuppressionLookup,
  ): Promise<readonly EngagementSuppression[]> {
    return [...this.state.suppressions.values()]
      .filter(
        (suppression) =>
          suppression.tenantId === input.tenantId &&
          suppression.channel === input.channel &&
          (suppression.recipientId === undefined ||
            suppression.recipientId === input.recipientId) &&
          (suppression.endpointId === undefined || suppression.endpointId === input.endpointId) &&
          (suppression.topic === undefined || suppression.topic === input.topic) &&
          (suppression.expiresAt === undefined ||
            suppression.expiresAt.getTime() > input.at.getTime()),
      )
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
      )
      .map(clone);
  }

  async saveSuppression(suppression: EngagementSuppression): Promise<void> {
    return this.mutate(() => {
      assertEngagementSuppression(suppression);
      const evidence = normalizeEngagementEvidence(suppression.evidence);
      const stored = {
        ...suppression,
        ...(evidence === undefined ? {} : { evidence }),
      };
      this.state.suppressions.set(
        `${encodeURIComponent(suppression.tenantId)}:${encodeURIComponent(suppression.id)}`,
        clone(stored),
      );
    });
  }

  async listByRecipient(
    tenantId: string,
    recipientId: string,
    options: Readonly<{
      limit: number;
      after?: Readonly<{ updatedAt: Date; dispatchId: string }>;
    }>,
  ): Promise<EngagementDispatchHistoryPage> {
    if (!Number.isInteger(options.limit) || options.limit <= 0 || options.limit > 500) {
      throw new EngagementStoreValidationProblem(
        "Engagement history limit must be between 1 and 500",
      );
    }
    const ordered = [...this.state.dispatches.values()]
      .filter((dispatch) => dispatch.tenantId === tenantId && dispatch.recipientId === recipientId)
      .sort(
        (left, right) =>
          right.updatedAt.getTime() - left.updatedAt.getTime() || right.id.localeCompare(left.id),
      )
      .filter((dispatch) => {
        if (options.after === undefined) return true;
        const timeComparison = dispatch.updatedAt.getTime() - options.after.updatedAt.getTime();
        return (
          timeComparison < 0 || (timeComparison === 0 && dispatch.id < options.after.dispatchId)
        );
      });
    const items = ordered.slice(0, options.limit).map(clone);
    const last = items.at(-1);
    return {
      items,
      ...(ordered.length > options.limit && last !== undefined
        ? { nextCursor: { updatedAt: cloneDate(last.updatedAt), dispatchId: last.id } }
        : {}),
    };
  }

  async findByIdentity(
    identity: EngagementDispatchIdentity,
  ): Promise<EngagementDispatch | undefined> {
    const dispatchId = this.state.dispatchIdsByIdentity.get(
      createEngagementDispatchIdentityKey(identity),
    );
    if (dispatchId === undefined) return undefined;
    const dispatch = this.state.dispatches.get(dispatchId);
    return dispatch === undefined ? undefined : clone(dispatch);
  }

  async listByDispatch(
    tenantId: string,
    dispatchId: string,
  ): Promise<readonly EngagementDeliveryEvent[]> {
    return [...this.state.deliveryEvents.values()]
      .filter((event) => event.tenantId === tenantId && event.dispatchId === dispatchId)
      .sort(
        (left, right) =>
          left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id),
      )
      .map(clone);
  }

  async transaction<TResult>(
    operation: (stores: EngagementStoreTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return this.mutate(async () => {
      const transactionStore = new InMemoryEngagementStore(cloneState(this.state), this.clock);
      const result = await operation(transactionStore);
      replaceState(this.state, transactionStore.state);
      return result;
    });
  }

  async getDispatch(tenantId: string, dispatchId: string): Promise<EngagementDispatch | undefined> {
    const dispatch = this.state.dispatches.get(dispatchId);
    return dispatch?.tenantId === tenantId ? clone(dispatch) : undefined;
  }

  async recordDispatch(input: RecordEngagementDispatchInput): Promise<EngagementDispatch> {
    return this.mutate(() => {
      const identityKey = createEngagementDispatchIdentityKey(input);
      const existingId = this.state.dispatchIdsByIdentity.get(identityKey);
      const existing = existingId === undefined ? undefined : this.state.dispatches.get(existingId);
      if (existing !== undefined && existing.outcome.kind !== "failed") return clone(existing);

      const id = existing?.id ?? createEngagementDispatchId(input);
      const createdAt = existing?.createdAt ?? input.recordedAt;
      const dispatch: EngagementDispatch = {
        id,
        tenantId: input.tenantId,
        messageId: input.messageId,
        recipientId: input.recipientId,
        channel: input.channel,
        semanticKey: input.semanticKey,
        topic: input.topic,
        targets: input.targets.map(clone),
        outcome: clone(input.outcome),
        createdAt: cloneDate(createdAt),
        updatedAt: cloneDate(input.recordedAt),
      };
      this.state.dispatches.set(id, clone(dispatch));
      this.state.dispatchIdsByIdentity.set(identityKey, id);
      return clone(dispatch);
    });
  }

  async recordDeliveryEvent(
    input: RecordEngagementDeliveryEventInput,
  ): Promise<EngagementDeliveryEventRecordResult> {
    return this.mutate(() => {
      const id = createEngagementDeliveryEventId(
        input.tenantId,
        input.provider,
        input.providerEventId,
      );
      const existing = this.state.deliveryEvents.get(id);
      if (existing !== undefined) return { event: clone(existing), duplicate: true };
      const evidence = normalizeEngagementEvidence(input.evidence);
      const event: EngagementDeliveryEvent = {
        ...clone(input),
        id,
        ...(evidence === undefined ? {} : { evidence }),
      };
      this.state.deliveryEvents.set(id, clone(event));
      return { event: clone(event), duplicate: false };
    });
  }

  private async mutate<TResult>(operation: () => TResult | Promise<TResult>): Promise<TResult> {
    const previous = this.state.mutationTail;
    let release = (): void => undefined;
    this.state.mutationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

function endpointKey(tenantId: string, endpointId: string): string {
  return `${encodeURIComponent(tenantId)}:${encodeURIComponent(endpointId)}`;
}

function preferenceKey(preference: EngagementPreference): string {
  return [
    preference.tenantId,
    preference.scope,
    preference.scope === "recipient" ? (preference.recipientId ?? "") : "",
    preference.topic,
    preference.channel,
  ]
    .map(encodeURIComponent)
    .join(":");
}

function cloneState(state: InMemoryEngagementState): InMemoryEngagementState {
  return {
    endpoints: new Map([...state.endpoints].map(([key, value]) => [key, clone(value)])),
    preferences: new Map([...state.preferences].map(([key, value]) => [key, clone(value)])),
    suppressions: new Map([...state.suppressions].map(([key, value]) => [key, clone(value)])),
    dispatches: new Map([...state.dispatches].map(([key, value]) => [key, clone(value)])),
    dispatchIdsByIdentity: new Map(state.dispatchIdsByIdentity),
    deliveryEvents: new Map([...state.deliveryEvents].map(([key, value]) => [key, clone(value)])),
    mutationTail: Promise.resolve(),
  };
}

function replaceState(target: InMemoryEngagementState, source: InMemoryEngagementState): void {
  target.endpoints = source.endpoints;
  target.preferences = source.preferences;
  target.suppressions = source.suppressions;
  target.dispatches = source.dispatches;
  target.dispatchIdsByIdentity = source.dispatchIdsByIdentity;
  target.deliveryEvents = source.deliveryEvents;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

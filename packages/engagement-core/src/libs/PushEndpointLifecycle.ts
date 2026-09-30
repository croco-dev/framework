import { EngagementStoreValidationProblem, assertEngagementStoreText } from "./EngagementStores";
import type {
  ContactEndpointInvalidationResult,
  EngagementPersistence,
  PushContactEndpoint,
} from "./EngagementStores";

export type PushEndpointScope = Readonly<{
  tenantId: string;
  recipientId: string;
  provider: string;
  app: string;
  platform: string;
  environment: string;
}>;

export type RegisterPushEndpointInput = PushEndpointScope &
  Readonly<{
    /** An opaque reference to a token held outside engagement persistence. */
    tokenReference: string;
    lastSeenAt: Date;
  }>;

export type PushEndpointRegistrationResult = Readonly<{
  status: "registered" | "refreshed" | "rotated";
  endpoint: PushContactEndpoint;
}>;

/** Application-owned registration and explicit maintenance; never runs from the send path. */
export class PushEndpointLifecycle {
  constructor(private readonly persistence: EngagementPersistence) {}

  async register(input: RegisterPushEndpointInput): Promise<PushEndpointRegistrationResult> {
    assertRegistration(input);
    return this.persistence.transaction(async (store) => {
      const existing = await store.getEndpoint(input.tenantId, createPushEndpointId(input));
      if (existing !== undefined) {
        if (existing.kind !== "push" || !matchesScope(existing, input)) {
          throw new EngagementStoreValidationProblem(
            "Push endpoint identity belongs to a different scope",
          );
        }
        if (existing.invalidatedAt !== undefined) {
          throw new EngagementStoreValidationProblem(
            "Invalidated push endpoint requires a new endpoint identity",
          );
        }
        if (existing.tokenReference !== input.tokenReference) {
          throw new EngagementStoreValidationProblem(
            "Push token changes require explicit rotation",
          );
        }
      }
      const saved = await store.saveEndpoint({
        ...input,
        id: createPushEndpointId(input),
        kind: "push",
        lastSeenAt: laterDate(existing?.lastSeenAt, input.lastSeenAt),
      });
      return {
        status: existing === undefined ? "registered" : "refreshed",
        endpoint: requirePush(saved),
      };
    });
  }

  async rotate(
    input: RegisterPushEndpointInput &
      Readonly<{ previousEndpointId: string; expectedVersion: number }>,
  ): Promise<PushEndpointRegistrationResult> {
    assertRegistration(input);
    return this.persistence.transaction(async (store) => {
      const existing = await store.getEndpoint(input.tenantId, input.previousEndpointId);
      if (existing?.kind !== "push" || !matchesScope(existing, input)) {
        throw new EngagementStoreValidationProblem(
          "Push endpoint was not found in the requested scope",
        );
      }
      if (existing.invalidatedAt !== undefined || existing.version !== input.expectedVersion) {
        throw new EngagementStoreValidationProblem(
          "Push endpoint rotation requires the current active version",
        );
      }
      if (existing.tokenReference === input.tokenReference) {
        const refreshed = await store.saveEndpoint({
          ...input,
          id: existing.id,
          kind: "push",
          lastSeenAt: laterDate(existing.lastSeenAt, input.lastSeenAt),
        });
        return { status: "refreshed", endpoint: requirePush(refreshed) };
      }
      const replacementId = createPushEndpointId(input);
      const replacement = await store.getEndpoint(input.tenantId, replacementId);
      if (replacement?.invalidatedAt !== undefined) {
        throw new EngagementStoreValidationProblem(
          "Replacement push endpoint has been invalidated",
        );
      }
      const invalidation = await store.invalidateEndpoint({
        tenantId: input.tenantId,
        endpointId: existing.id,
        expectedVersion: input.expectedVersion,
        reason: "other",
        invalidatedAt: input.lastSeenAt,
      });
      if (invalidation.status !== "invalidated") {
        throw new EngagementStoreValidationProblem("Push endpoint changed during rotation");
      }
      const saved = await store.saveEndpoint({
        ...input,
        id: replacementId,
        kind: "push",
        lastSeenAt: laterDate(replacement?.lastSeenAt, input.lastSeenAt),
      });
      return { status: "rotated", endpoint: requirePush(saved) };
    });
  }

  async invalidateTerminal(
    input: PushEndpointScope &
      Readonly<{ endpointId: string; expectedVersion: number; invalidatedAt: Date }>,
  ): Promise<ContactEndpointInvalidationResult> {
    assertScope(input);
    assertDate(input.invalidatedAt);
    return this.persistence.transaction(async (store) => {
      const endpoint = await store.getEndpoint(input.tenantId, input.endpointId);
      if (endpoint === undefined) return { status: "not-found" };
      if (endpoint.kind !== "push" || !matchesScope(endpoint, input)) {
        throw new EngagementStoreValidationProblem(
          "Push endpoint was not found in the requested scope",
        );
      }
      return store.invalidateEndpoint({ ...input, reason: "token-invalid" });
    });
  }

  async invalidateStale(
    input: PushEndpointScope & Readonly<{ lastSeenBefore: Date; invalidatedAt: Date }>,
  ): Promise<readonly ContactEndpointInvalidationResult[]> {
    assertScope(input);
    assertDate(input.lastSeenBefore);
    assertDate(input.invalidatedAt);
    if (input.lastSeenBefore.getTime() > input.invalidatedAt.getTime()) {
      throw new EngagementStoreValidationProblem(
        "Stale endpoint cutoff must not be after invalidation time",
      );
    }
    return this.persistence.transaction(async (store) => {
      const endpoints = await store.listActiveEndpoints(input.tenantId, input.recipientId);
      const results: ContactEndpointInvalidationResult[] = [];
      for (const endpoint of endpoints) {
        if (
          endpoint.kind !== "push" ||
          !matchesScope(endpoint, input) ||
          endpoint.lastSeenAt.getTime() >= input.lastSeenBefore.getTime()
        )
          continue;
        results.push(
          await store.invalidateEndpoint({
            tenantId: input.tenantId,
            endpointId: endpoint.id,
            expectedVersion: endpoint.version,
            reason: "other",
            invalidatedAt: input.invalidatedAt,
            lastSeenBefore: input.lastSeenBefore,
          }),
        );
      }
      return results;
    });
  }
}

function assertScope(input: PushEndpointScope): void {
  for (const field of [
    "tenantId",
    "recipientId",
    "provider",
    "app",
    "platform",
    "environment",
  ] as const) {
    assertEngagementStoreText(input[field], `Push endpoint ${field}`);
  }
}

function assertRegistration(input: RegisterPushEndpointInput): void {
  assertScope(input);
  assertEngagementStoreText(input.tokenReference, "Push token reference");
  assertDate(input.lastSeenAt);
}

function assertDate(value: Date): void {
  if (!Number.isFinite(value.getTime())) {
    throw new EngagementStoreValidationProblem("Push endpoint timestamp must be valid");
  }
}

function matchesScope(endpoint: PushContactEndpoint, scope: PushEndpointScope): boolean {
  return (
    endpoint.tenantId === scope.tenantId &&
    endpoint.recipientId === scope.recipientId &&
    endpoint.provider === scope.provider &&
    endpoint.app === scope.app &&
    endpoint.platform === scope.platform &&
    endpoint.environment === scope.environment
  );
}

function laterDate(existing: Date | undefined, incoming: Date): Date {
  return new Date(Math.max(existing?.getTime() ?? incoming.getTime(), incoming.getTime()));
}

function requirePush(
  endpoint: Awaited<ReturnType<EngagementPersistence["saveEndpoint"]>>,
): PushContactEndpoint {
  if (endpoint.kind !== "push") {
    throw new EngagementStoreValidationProblem(
      "Push endpoint store returned an incompatible endpoint",
    );
  }
  return endpoint;
}

export function createPushEndpointId(input: Omit<RegisterPushEndpointInput, "lastSeenAt">): string {
  assertScope(input);
  assertEngagementStoreText(input.tokenReference, "Push token reference");
  return [
    "push-endpoint",
    input.tenantId,
    input.recipientId,
    input.provider,
    input.app,
    input.platform,
    input.environment,
    input.tokenReference,
  ]
    .map(encodeURIComponent)
    .join(":");
}

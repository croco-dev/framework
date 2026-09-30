import { describe, expect, it } from "vitest";
import { InMemoryEngagementStore } from "../libs/InMemoryEngagementStore";
import { PushEndpointLifecycle, createPushEndpointId } from "../libs/PushEndpointLifecycle";

const scope = {
  tenantId: "tenant",
  recipientId: "recipient",
  provider: "fcm",
  app: "app",
  platform: "android",
  environment: "test",
};
const registration = {
  ...scope,
  tokenReference: "vault:device-1",
  lastSeenAt: new Date("2026-01-01"),
};

function fixture() {
  const store = new InMemoryEngagementStore();
  return { store, lifecycle: new PushEndpointLifecycle(store) };
}

describe("PushEndpointLifecycle", () => {
  it("registers the same logical token once, including concurrent calls, and refreshes lastSeenAt", async () => {
    const { store, lifecycle } = fixture();
    const results = await Promise.all([
      lifecycle.register(registration),
      lifecycle.register(registration),
    ]);
    expect(results.map((result) => result.status)).toEqual(["registered", "refreshed"]);
    const later = new Date("2026-02-01");
    const refreshed = await lifecycle.register({ ...registration, lastSeenAt: later });
    expect(refreshed.endpoint.version).toBe(1);
    expect(refreshed.endpoint.lastSeenAt).toEqual(later);
    await lifecycle.register(registration);
    const endpoints = await store.listActiveEndpoints(scope.tenantId, scope.recipientId);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]?.lastSeenAt).toEqual(later);
  });

  it.each(["tenantId", "recipientId", "provider", "app", "platform", "environment"] as const)(
    "isolates registration by %s",
    async (field) => {
      const { lifecycle } = fixture();
      const first = await lifecycle.register(registration);
      const second = await lifecycle.register({ ...registration, [field]: "different" });
      expect(second.endpoint.id).not.toBe(first.endpoint.id);
      expect(second.status).toBe("registered");
    },
  );

  it("atomically rotates to one active endpoint and retains the invalidated predecessor", async () => {
    const { store, lifecycle } = fixture();
    const first = await lifecycle.register(registration);
    const rotated = await lifecycle.rotate({
      ...registration,
      tokenReference: "vault:device-2",
      previousEndpointId: first.endpoint.id,
      expectedVersion: 1,
    });
    expect(rotated.status).toBe("rotated");
    expect(rotated.endpoint.id).not.toBe(first.endpoint.id);
    expect(await store.listActiveEndpoints(scope.tenantId, scope.recipientId)).toEqual([
      rotated.endpoint,
    ]);
    expect(
      (await store.getEndpoint(scope.tenantId, first.endpoint.id))?.invalidatedAt,
    ).toBeDefined();
    await lifecycle.invalidateTerminal({
      ...scope,
      endpointId: first.endpoint.id,
      expectedVersion: 1,
      invalidatedAt: new Date(),
    });
    expect(await store.listActiveEndpoints(scope.tenantId, scope.recipientId)).toEqual([
      rotated.endpoint,
    ]);
  });

  it("rejects stale rotation and preserves the active endpoint", async () => {
    const { store, lifecycle } = fixture();
    const first = await lifecycle.register(registration);
    await expect(
      lifecycle.rotate({
        ...registration,
        tokenReference: "vault:replacement",
        previousEndpointId: first.endpoint.id,
        expectedVersion: 9,
      }),
    ).rejects.toThrow("current active version");
    expect(await store.listActiveEndpoints(scope.tenantId, scope.recipientId)).toEqual([
      first.endpoint,
    ]);
  });

  it("makes terminal invalidation idempotent and prevents token resurrection", async () => {
    const { store, lifecycle } = fixture();
    const first = await lifecycle.register(registration);
    const input = {
      ...scope,
      endpointId: first.endpoint.id,
      expectedVersion: 1,
      invalidatedAt: new Date(),
    };
    expect((await lifecycle.invalidateTerminal(input)).status).toBe("invalidated");
    expect((await lifecycle.invalidateTerminal(input)).status).toBe("already-invalid");
    await expect(lifecycle.register(registration)).rejects.toThrow("new endpoint identity");
    expect(await store.listActiveEndpoints(scope.tenantId, scope.recipientId)).toEqual([]);
  });

  it("maintains only stale endpoints in the explicit scope and keeps the cutoff boundary active", async () => {
    const { store, lifecycle } = fixture();
    await lifecycle.register(registration);
    const cutoff = new Date("2026-02-01");
    const fresh = await lifecycle.register({
      ...registration,
      tokenReference: "vault:fresh",
      lastSeenAt: cutoff,
    });
    const other = await lifecycle.register({ ...registration, environment: "production" });
    const results = await lifecycle.invalidateStale({
      ...scope,
      lastSeenBefore: cutoff,
      invalidatedAt: cutoff,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("invalidated");
    expect(
      (await store.listActiveEndpoints(scope.tenantId, scope.recipientId))
        .map((endpoint) => endpoint.id)
        .sort(),
    ).toEqual([fresh.endpoint.id, other.endpoint.id].sort());
  });

  it("rejects invalid dates and uses unambiguous deterministic identities", async () => {
    const { lifecycle } = fixture();
    await expect(
      lifecycle.register({ ...registration, lastSeenAt: new Date("invalid") }),
    ).rejects.toThrow("timestamp");
    expect(createPushEndpointId({ ...registration, app: "a:b", platform: "c" })).not.toBe(
      createPushEndpointId({ ...registration, app: "a", platform: "b:c" }),
    );
  });
});

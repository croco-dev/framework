import { CancellationConflictProblem } from "@croco/billing-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleCancellationStore } from "../libs/DrizzleCancellationStore";
import type { CancellationSession } from "@croco/billing-core";

const persistence = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("../libs/Persistence", () => ({
  read: persistence.read,
  write: persistence.write,
  atomic: async (
    database: unknown,
    _namespace: string,
    operation: (tx: unknown) => Promise<unknown>,
  ) => operation(database),
}));

const scope = { appId: "shop", environment: "test", tenantId: "tenant" };
const identity = { ...scope, subject: "owner", subscriptionRef: "subscription" };
const at = "2026-01-01T00:00:00.000Z";
function session(): CancellationSession {
  return {
    ...identity,
    id: "session",
    revision: 1,
    subscriptionRevision: "subscription-v1",
    quoteRef: "quote-v1",
    policyVersion: 1,
    snapshot: {
      ...identity,
      revision: "subscription-v1",
      billingPeriod: "initial",
      subscriptionStartedAt: at,
      status: "active",
      quote: {
        ref: "quote-v1",
        expiresAt: "2026-02-01T00:00:00.000Z",
        refund: "none",
        amount: "0",
        currency: "USD",
      },
    },
    choices: [],
    keepAvailable: true,
    state: "open",
    createdAt: at,
    displayedAt: at,
    evidence: [
      { kind: "intent", at },
      { kind: "displayed", at },
    ],
  };
}

describe("DrizzleCancellationStore write boundaries", () => {
  const database = drizzle.mock();
  const store = new DrizzleCancellationStore(database);
  beforeEach(() => {
    persistence.read.mockReset();
    persistence.write.mockReset();
    persistence.write.mockResolvedValue(undefined);
  });

  it.each([
    { name: "missing session", stored: undefined, expectedRevision: 1, revision: 2 },
    { name: "stale revision", stored: session(), expectedRevision: 0, revision: 1 },
    { name: "skipped revision", stored: session(), expectedRevision: 1, revision: 3 },
  ])("rejects $name without writing", async ({ stored, expectedRevision, revision }) => {
    persistence.read.mockResolvedValue(stored);
    expect(await store.saveSession({ ...session(), revision }, expectedRevision)).toBe(false);
    expect(persistence.write).not.toHaveBeenCalled();
  });

  it.each([
    { name: "ownership", change: { subject: "different-owner" } },
    { name: "pinned quote", change: { quoteRef: "quote-v2" } },
    { name: "keep availability", change: { keepAvailable: false } },
    { name: "display evidence", change: { displayedAt: "2026-01-02T00:00:00.000Z" } },
    { name: "evidence deletion", change: { evidence: [] } },
    {
      name: "evidence rewrite",
      change: { evidence: [{ kind: "intent" as const, at: "2026-01-02T00:00:00.000Z" }] },
    },
  ])("rejects changed $name despite a matching revision", async ({ change }) => {
    persistence.read.mockResolvedValue(session());
    await expect(
      store.saveSession({ ...session(), revision: 2, ...change }, 1),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    expect(persistence.write).not.toHaveBeenCalled();
  });

  it("prevents a decided session from reopening or acquiring another command identity", async () => {
    const decided: CancellationSession = {
      ...session(),
      state: "decided",
      decision: { decisionId: "decision", kind: "continue_cancel" },
      commandReceipt: {
        commandId: "command",
        providerOutcome: "pending",
        effect: "none",
        refundOutcome: "not_requested",
      },
    };
    persistence.read.mockResolvedValue(decided);
    await expect(
      store.saveSession({ ...decided, revision: 2, state: "open" }, 1),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    await expect(
      store.saveSession(
        {
          ...decided,
          revision: 2,
          commandReceipt: { ...decided.commandReceipt!, commandId: "replacement" },
        },
        1,
      ),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    expect(persistence.write).not.toHaveBeenCalled();
  });

  it("persists the decision and command reservation together while preserving prior evidence", async () => {
    const original = session();
    const decided: CancellationSession = {
      ...original,
      revision: 2,
      state: "decided",
      decision: { decisionId: "decision", kind: "continue_cancel" },
      commandReceipt: {
        commandId: "command",
        providerOutcome: "pending",
        effect: "none",
        refundOutcome: "not_requested",
      },
      evidence: [...original.evidence, { kind: "decision", decisionId: "decision", at }],
    };
    persistence.read.mockResolvedValue(original);
    expect(await store.saveSession(decided, 1)).toBe(true);
    expect(persistence.write).toHaveBeenCalledExactlyOnceWith(
      database,
      "croco_cancellation_sessions",
      JSON.stringify([scope.appId, scope.environment, scope.tenantId]),
      decided.id,
      decided,
    );
  });

  it("keeps application, environment, and tenant boundaries distinct for equal resource IDs", async () => {
    const scopes = [
      scope,
      { ...scope, appId: "other" },
      { ...scope, environment: "other" },
      { ...scope, tenantId: "other" },
    ];
    for (const selected of scopes) {
      await store.getSession(selected, "shared-session-id");
    }
    expect(persistence.read.mock.calls.map((call) => call.slice(1))).toEqual(
      scopes.map((selected) => [
        "croco_cancellation_sessions",
        JSON.stringify([selected.appId, selected.environment, selected.tenantId]),
        "shared-session-id",
      ]),
    );
    expect(persistence.write).not.toHaveBeenCalled();
  });
});

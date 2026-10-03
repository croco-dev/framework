import { describe, expect, it, vi } from "vitest";
import { JourneyAdminProblem, JourneyOperations } from "../libs/JourneyOperations";
import type { JourneyAdminAccess } from "../libs/JourneyOperations";
import type { JourneyDefinition, JourneyEpisode, JourneyScope } from "@croco/lifecycle-core";

const scope = { tenantId: "tenant", appId: "app", environment: "test" };
const episode: JourneyEpisode = {
  id: "episode",
  scope,
  subject: "private-email",
  businessObjectRef: "private-resource",
  episodeKey: "k",
  reentryKey: "r",
  sourceEventId: "event",
  definitionId: "welcome",
  definitionVersion: "1",
  nodeId: "wait",
  wakeAt: null,
  status: "running",
  revision: 1,
  startedAt: "2026-09-29T00:00:00Z",
  unknownSince: null,
  unknownSource: null,
  definitionSnapshot: "registered-definition",
  reconciliations: [],
  reason: "private reason",
  receipts: [],
  intents: [],
  commands: [],
};
const definition: JourneyDefinition = {
  id: "welcome",
  version: "1",
  entry: "end",
  goal: { registration: "done", params: {} },
  reentry: "once",
  unknownRetryMs: 1000,
  unknownDeadlineMs: 5000,
  nodes: [{ id: "end", kind: "end" }],
};
function setup(
  access: JourneyAdminAccess = {
    scope,
    actor: "trusted-actor",
    permissions: ["journey.read", "journey.preview", "journey.operate"],
  },
) {
  const command = vi.fn(async () => episode);
  const list = vi.fn(async () => [episode]);
  const dryRun = vi.fn(async () => ({ steps: [{ nodeId: "end", outcome: "completed" }] }));
  return {
    command,
    list,
    dryRun,
    operations: new JourneyOperations({
      authenticate: async () => access,
      store: { list },
      command,
      dryRun,
    }),
  };
}
const input = {
  episodeId: "episode",
  type: "pause" as const,
  expectedRevision: 1,
  reason: "Investigate",
  idempotencyKey: "command-1",
};

describe("Journey server operations", () => {
  it.each(["tenantId", "appId", "environment"] as const)(
    "rejects blank %s in requested and authenticated scopes",
    async (field) => {
      for (const value of ["", "   ", undefined]) {
        const invalidScope = { ...scope, [field]: value } as JourneyScope;
        for (const authenticatedScope of [scope, invalidScope]) {
          const { operations, list, command, dryRun } = setup({
            scope: authenticatedScope,
            actor: "operator",
            permissions: ["journey.read", "journey.preview", "journey.operate"],
          });
          await expect(operations.list(invalidScope)).rejects.toBeInstanceOf(JourneyAdminProblem);
          await expect(operations.command(invalidScope, input)).rejects.toBeInstanceOf(
            JourneyAdminProblem,
          );
          await expect(
            operations.dryRun(invalidScope, definition, "sample"),
          ).rejects.toBeInstanceOf(JourneyAdminProblem);
          expect(list).not.toHaveBeenCalled();
          expect(command).not.toHaveBeenCalled();
          expect(dryRun).not.toHaveBeenCalled();
        }
        await expect(
          setup({
            scope: invalidScope,
            actor: "operator",
            permissions: ["journey.read"],
          }).operations.list(scope),
        ).rejects.toThrow();
      }
    },
  );

  it("denies scope and permissions before calling adapters", async () => {
    const { operations, list, command, dryRun } = setup({
      scope,
      actor: "operator",
      permissions: [],
    });
    await expect(operations.list(scope)).rejects.toThrow();
    await expect(operations.command(scope, input)).rejects.toThrow();
    await expect(operations.dryRun(scope, definition, "sample")).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
    expect(dryRun).not.toHaveBeenCalled();
    await expect(setup().operations.list({ ...scope, appId: "other" })).rejects.toThrow();
    await expect(
      setup().operations.list({ ...scope, environment: "production" }),
    ).rejects.toThrow();
    await expect(setup().operations.list({ ...scope, tenantId: "other" })).rejects.toThrow();
  });
  it("redacts private subjects, receipt details and command audit from reads", async () => {
    expect(JSON.stringify(await setup().operations.list(scope))).not.toContain("private");
    const { operations, list } = setup();
    list.mockResolvedValue([{ ...episode, scope: { ...scope, tenantId: "other" } }]);
    await expect(operations.list(scope)).rejects.toThrow();
  });
  it.each(["accepted", "rejected", "indeterminate"] as const)(
    "preserves %s acceptance evidence when stop wins before provider completion",
    async (outcome) => {
      const { operations, list } = setup();
      const reason = `dispatch-${outcome}-after-stop`;
      list.mockResolvedValue([
        {
          ...episode,
          status: "exited",
          reason: "operator-stop",
          receipts: [
            { nodeId: "send", evaluatedAt: episode.startedAt, reason, sourceEventId: "event" },
          ],
        },
      ]);
      const [view] = await operations.list(scope);
      expect(view?.receipts[0]?.reason).toBe(reason);
      expect(view?.safeResume).toBe(false);
    },
  );
  it("preserves safe action checks and dispatch codes without provider payloads", async () => {
    const { operations, list } = setup();
    const evaluatedAt = "2026-09-29T00:01:00Z";
    const checks = {
      goal: false,
      consent: "unknown" as const,
      resource: true,
      evaluatedAt,
      privateToken: "secret",
    };
    list.mockResolvedValue([
      {
        ...episode,
        status: "indeterminate",
        reason: "dispatch-indeterminate",
        receipts: [
          {
            nodeId: "send",
            evaluatedAt,
            reason: "action-checks",
            sourceEventId: "private-event",
            checks,
          },
          {
            nodeId: "send",
            evaluatedAt,
            reason: "dispatch-indeterminate",
            sourceEventId: "private-event",
            problemCode: "lifecycle-core/journey-provider-exception",
            checks,
          },
        ],
      },
    ]);
    const [view] = await operations.list(scope);
    expect(view?.receipts[0]).toEqual({
      nodeId: "send",
      evaluatedAt,
      reason: "action-checks",
      checks: { goal: false, consent: "unknown", resource: true, evaluatedAt },
    });
    expect(view?.receipts[1]?.problemCode).toBe("lifecycle-core/journey-provider-exception");
    expect(view?.problemCode).toBe("lifecycle-core/journey-provider-exception");
    expect(JSON.stringify(view)).not.toMatch(/private|secret/);
  });
  it("redacts unrecognized dispatch problem codes from stored evidence", async () => {
    const { operations, list } = setup();
    list.mockResolvedValue([
      {
        ...episode,
        status: "failed",
        reason: "dispatch-rejected",
        receipts: [
          {
            nodeId: "send",
            evaluatedAt: episode.startedAt,
            reason: "dispatch-rejected",
            sourceEventId: "event",
            problemCode: "private-provider-message" as never,
          },
        ],
      },
    ]);
    const [view] = await operations.list(scope);
    expect(view?.problemCode).toBe("journey/dispatch-rejected");
    expect(view?.receipts[0]?.problemCode).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("private-provider-message");
  });
  it("uses authenticated actor and forwards audit, CAS revision and idempotency unchanged", async () => {
    const { operations, command } = setup();
    await operations.command(scope, { ...input, actor: "forged" } as typeof input);
    expect(command).toHaveBeenCalledWith(scope, "episode", {
      type: "pause",
      actor: "trusted-actor",
      reason: "Investigate",
      expectedRevision: 1,
      idempotencyKey: "command-1",
    });
    command.mockRejectedValueOnce(new Error("conflict"));
    await expect(operations.command(scope, input)).rejects.toThrow("conflict");
  });
  it.each([
    { reason: "" },
    { idempotencyKey: "" },
    { expectedRevision: -1 },
    { expectedRevision: 1.5 },
  ])("rejects invalid operation metadata %s", async (invalid) => {
    const { operations, command } = setup();
    await expect(operations.command(scope, { ...input, ...invalid })).rejects.toThrow();
    expect(command).not.toHaveBeenCalled();
  });
  it("previews only after server authorization", async () => {
    const { operations, dryRun } = setup();
    expect(await operations.dryRun(scope, definition, "sample")).toEqual({
      steps: [{ nodeId: "end", outcome: "completed" }],
    });
    expect(dryRun).toHaveBeenCalledWith(scope, definition, "sample");
  });
});

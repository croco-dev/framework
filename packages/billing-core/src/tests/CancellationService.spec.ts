import { describe, expect, it, vi } from "vitest";
import {
  CancellationService,
  validateCancellationDecision,
  validateCancellationSnapshot,
} from "../libs/CancellationService";
import {
  CancellationAuthorizationProblem,
  CancellationInputProblem,
  CancellationConflictProblem,
  CancellationUnavailableProblem,
} from "../libs/problems/CancellationProblems";
import type {
  CancellationAction,
  CancellationAuthority,
  CancellationIdentity,
  CancellationSession,
  CancellationSnapshot,
  CancellationStore,
  ChoicePolicy,
  ChoicePolicyAudit,
} from "../libs/Cancellation";

const identity: CancellationIdentity = {
  appId: "app",
  environment: "test",
  tenantId: "tenant",
  subject: "verified-user",
  subscriptionRef: "sub",
};
const now = new Date("2026-10-01T00:00:00Z");
function fixture() {
  let snapshot: CancellationSnapshot = {
    ...identity,
    revision: "1",
    subscriptionStartedAt: "2026-09-01T00:00:00Z",
    billingPeriod: "initial",
    status: "active",
    quote: {
      ref: "quote",
      expiresAt: "2026-10-02T00:00:00Z",
      refund: "partial",
      amount: "4.50",
      currency: "USD",
    },
  };
  const sessions = new Map<string, CancellationSession>();
  let policy: ChoicePolicy | undefined;
  let failObservation = false;
  const store: CancellationStore = {
    async createSession(session) {
      if (sessions.has(session.id)) throw new CancellationConflictProblem();
      sessions.set(session.id, structuredClone(session));
    },
    async getSession(_scope, id) {
      const value = sessions.get(id);
      return value && structuredClone(value);
    },
    async saveSession(session, expected) {
      if (failObservation && session.commandReceipt?.providerOutcome === "confirmed")
        throw new CancellationConflictProblem();
      if (sessions.get(session.id)?.revision !== expected) return false;
      sessions.set(session.id, structuredClone(session));
      return true;
    },
    async getPolicy() {
      return policy;
    },
    async savePolicy(next) {
      policy = next;
      return next;
    },
    async listSessions() {
      return [...sessions.values()];
    },
  };
  const authorize = vi.fn(async (input: CancellationIdentity) => {
    if (input.subject !== identity.subject) throw new CancellationAuthorizationProblem();
  });
  const authority: CancellationAuthority = {
    authorize,
    authorizePolicy: vi.fn(async () => {}),
    async snapshot() {
      return structuredClone(snapshot);
    },
    async admit(_identity, _snapshot, operation) {
      return operation();
    },
  };
  const action: CancellationAction = {
    kind: "cancel",
    available: () => true,
    execute: vi.fn<CancellationAction["execute"]>(async ({ commandId }) => ({
      commandId,
      providerOutcome: "confirmed",
      effect: "cancellation_scheduled",
      refundOutcome: "not_requested",
    })),
    lookup: vi.fn<CancellationAction["lookup"]>(async ({ commandId }) => ({
      commandId,
      providerOutcome: "confirmed",
      effect: "cancellation_scheduled",
      refundOutcome: "not_requested",
    })),
  };
  const service = new CancellationService({
    store,
    authority,
    actions: [action],
    choices: [],
    clock: () => now,
  });
  return {
    service,
    store,
    action,
    authority,
    authorize,
    setSnapshot(value: Partial<CancellationSnapshot>) {
      snapshot = { ...snapshot, ...value };
    },
    failObservation(value: boolean) {
      failObservation = value;
    },
  };
}
describe("CancellationService", () => {
  it("exposes direct cancellation without any policy and records scheduled acceptance without refund", async () => {
    const { service, action } = fixture();
    const session = await service.createSession(identity, "one");
    expect(session.choices).toEqual([expect.objectContaining({ id: "cancel", available: true })]);
    const result = await service.decide(identity, "one", {
      kind: "continue_cancel",
      decisionId: "d",
    });
    expect(result.commandReceipt).toMatchObject({
      providerOutcome: "confirmed",
      effect: "cancellation_scheduled",
      refundOutcome: "not_requested",
    });
    expect(result.evidence.map((item) => item.kind)).toEqual([
      "intent",
      "decision",
      "command",
      "provider",
    ]);
    expect(action.execute).toHaveBeenCalledTimes(1);
  });
  it("allows keeping the subscription without dispatch", async () => {
    const { service, action } = fixture();
    await service.createSession(identity, "one");
    expect(
      (await service.decide(identity, "one", { kind: "keep_subscription", decisionId: "d" })).state,
    ).toBe("decided");
    expect(action.execute).not.toHaveBeenCalled();
  });
  it("resumes a scheduled cancellation when keeping the subscription", async () => {
    const f = fixture();
    f.setSnapshot({ status: "cancellation_scheduled" });
    const resume: CancellationAction = {
      kind: "resume",
      available: () => true,
      execute: vi.fn<CancellationAction["execute"]>(async ({ commandId }) => ({
        commandId,
        providerOutcome: "confirmed",
        effect: "resumed",
        refundOutcome: "not_requested",
      })),
      lookup: vi.fn(),
    };
    const service = new CancellationService({
      store: f.store,
      authority: f.authority,
      actions: [f.action, resume],
      choices: [],
      clock: () => now,
    });
    expect((await service.createSession(identity, "one")).keepAvailable).toBe(true);
    const result = await service.decide(identity, "one", {
      kind: "keep_subscription",
      decisionId: "keep",
    });
    expect(result.commandReceipt?.effect).toBe("resumed");
    expect(resume.execute).toHaveBeenCalledTimes(1);
    expect(f.action.execute).not.toHaveBeenCalled();
  });
  it.each(["ended", "cancellation_scheduled"] as const)(
    "rejects keeping %s without a supported resume action",
    async (status) => {
      const f = fixture();
      f.setSnapshot({ status });
      const session = await f.service.createSession(identity, "one");
      expect(session.keepAvailable).toBe(false);
      const decision = { kind: "keep_subscription" as const, decisionId: "keep" };
      expect(() => validateCancellationDecision(session, decision, now)).toThrow(
        CancellationUnavailableProblem,
      );
      await expect(f.service.decide(identity, "one", decision)).rejects.toBeInstanceOf(
        CancellationUnavailableProblem,
      );
      expect(f.action.execute).not.toHaveBeenCalled();
    },
  );
  it.each(["revision", "quote"] as const)(
    "rejects %s changes between preflight and locked admission without reserving a command",
    async (change) => {
      const f = fixture();
      await f.service.createSession(identity, "one");
      f.authority.admit = async (admittedIdentity, pinned, operation) => {
        if (change === "revision") f.setSnapshot({ revision: "2" });
        else f.setSnapshot({ quote: { ...pinned.quote, ref: "quote-new" } });
        const fresh = await f.authority.snapshot(admittedIdentity);
        validateCancellationSnapshot(admittedIdentity, fresh, now, pinned);
        return operation();
      };
      await expect(
        f.service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" }),
      ).rejects.toMatchObject({
        snapshot: change === "revision" ? { revision: "2" } : { quote: { ref: "quote-new" } },
      });
      expect(f.action.execute).not.toHaveBeenCalled();
      const session = await f.store.getSession(identity, "one");
      expect(session?.state).toBe("open");
      expect(session?.commandReceipt).toBeUndefined();
      expect(session?.evidence.map((item) => item.kind)).toEqual(["intent"]);
    },
  );
  it("denies unverified subjects and mismatched authoritative ownership", async () => {
    const { service, setSnapshot } = fixture();
    await expect(
      service.createSession({ ...identity, subject: "other" }, "one"),
    ).rejects.toBeInstanceOf(CancellationAuthorizationProblem);
    setSnapshot({ tenantId: "other" });
    await expect(service.createSession(identity, "one")).rejects.toBeInstanceOf(
      CancellationAuthorizationProblem,
    );
    await expect(service.createSession({ ...identity, tenantId: "" }, "one")).rejects.toThrow();
  });
  it("returns fresh state on subscription revision or quote conflicts before mutation", async () => {
    const { service, setSnapshot, action } = fixture();
    await service.createSession(identity, "one");
    setSnapshot({ revision: "2" });
    await expect(
      service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" }),
    ).rejects.toMatchObject({ snapshot: { revision: "2" } });
    expect(action.execute).not.toHaveBeenCalled();
  });
  it("rejects changed quote values even when a source mistakenly reuses its quote ref", async () => {
    const { service, setSnapshot, action } = fixture();
    await service.createSession(identity, "one");
    setSnapshot({
      quote: {
        ref: "quote",
        expiresAt: "2026-10-02T00:00:00Z",
        refund: "full",
        amount: "15",
        currency: "USD",
      },
    });
    await expect(
      service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" }),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    expect(action.execute).not.toHaveBeenCalled();
  });
  it("rejects an expired quote", async () => {
    const { service, setSnapshot } = fixture();
    setSnapshot({
      quote: {
        ref: "old",
        expiresAt: now.toISOString(),
        refund: "full",
        amount: "9",
        currency: "USD",
      },
    });
    await expect(service.createSession(identity, "one")).rejects.toBeInstanceOf(
      CancellationConflictProblem,
    );
  });
  it("reconciles duplicate decisions without repeating dispatch and rejects changed intent", async () => {
    const { service, action } = fixture();
    await service.createSession(identity, "one");
    await service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" });
    await service.decide(identity, "one", { decisionId: "d", kind: "continue_cancel" });
    await expect(
      service.decide(identity, "one", { kind: "keep_subscription", decisionId: "d" }),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    expect(action.execute).toHaveBeenCalledTimes(1);
    expect(action.lookup).toHaveBeenCalledTimes(1);
  });
  it("admits only one concurrent decision", async () => {
    const { service, action } = fixture();
    await service.createSession(identity, "one");
    const results = await Promise.allSettled([
      service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" }),
      service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(action.execute).toHaveBeenCalledTimes(1);
  });
  it("retains command reservation when observation persistence fails and only looks up after restart", async () => {
    const f = fixture();
    await f.service.createSession(identity, "one");
    f.failObservation(true);
    await expect(
      f.service.decide(identity, "one", { kind: "continue_cancel", decisionId: "d" }),
    ).rejects.toThrow();
    f.failObservation(false);
    const restarted = new CancellationService({
      store: f.store,
      authority: f.authority,
      actions: [f.action],
      choices: [],
      clock: () => now,
    });
    expect((await restarted.reconcile(identity, "one")).commandReceipt?.providerOutcome).toBe(
      "confirmed",
    );
    expect(f.action.execute).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported or unregistered offers using the same pure validator", async () => {
    const { service } = fixture();
    const session = await service.createSession(identity, "one");
    expect(() =>
      validateCancellationDecision(
        session,
        { kind: "accept_registered_offer", decisionId: "d", choiceId: "pause" },
        now,
      ),
    ).toThrow(CancellationUnavailableProblem);
  });
  it("denies unauthorized policy writes and reporting before accessing storage", async () => {
    const f = fixture();
    f.authority.authorizePolicy = async () => {
      throw new CancellationAuthorizationProblem();
    };
    const save = vi.spyOn(f.store, "savePolicy");
    const list = vi.spyOn(f.store, "listSessions");
    await expect(
      f.service.updatePolicy(identity, [], {
        actor: "denied",
        reason: "update",
        idempotencyKey: "audit",
        expectedRevision: 0,
        at: now.toISOString(),
      }),
    ).rejects.toBeInstanceOf(CancellationAuthorizationProblem);
    await expect(f.service.listSessions(identity, "denied")).rejects.toBeInstanceOf(
      CancellationAuthorizationProblem,
    );
    expect(save).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
  it.each<Partial<ChoicePolicyAudit>>([
    { actor: "" },
    { reason: " " },
    { idempotencyKey: "" },
    { expectedRevision: -1 },
    { expectedRevision: 0.5 },
  ])("rejects invalid policy audit %j before writing", async (invalid) => {
    const f = fixture();
    const save = vi.spyOn(f.store, "savePolicy");
    await expect(
      f.service.updatePolicy(identity, [], {
        actor: "operator",
        reason: "reviewed",
        idempotencyKey: "audit",
        expectedRevision: 0,
        at: now.toISOString(),
        ...invalid,
      }),
    ).rejects.toBeInstanceOf(CancellationInputProblem);
    expect(save).not.toHaveBeenCalled();
  });
  it("selects offers by billing period and quote and dispatches the accepted registered action", async () => {
    const f = fixture();
    const action: CancellationAction = {
      kind: "change-plan",
      available: () => true,
      execute: vi.fn<CancellationAction["execute"]>(async ({ commandId }) => ({
        commandId,
        providerOutcome: "confirmed",
        effect: "plan_changed",
        refundOutcome: "not_requested",
      })),
      lookup: vi.fn(),
    };
    const choices = ["matched", "renewal-only", "full-only"].map((id) => ({
      id,
      action: "change-plan" as const,
      label: id,
      consequence: "Switch to the registered plan",
    }));
    const service = new CancellationService({
      store: f.store,
      authority: f.authority,
      actions: [f.action, action],
      choices,
      clock: () => now,
    });
    const save = vi.spyOn(f.store, "savePolicy");
    await service.updatePolicy(
      identity,
      [
        {
          choiceId: "matched",
          label: "Eligible plan",
          enabled: true,
          order: 2,
          billingPeriods: ["initial"],
          refundKinds: ["partial"],
        },
        {
          choiceId: "renewal-only",
          label: "Renewal",
          enabled: true,
          order: 0,
          billingPeriods: ["renewal"],
          refundKinds: ["partial"],
        },
        {
          choiceId: "full-only",
          label: "Full",
          enabled: true,
          order: 1,
          billingPeriods: ["initial"],
          refundKinds: ["full"],
        },
      ],
      {
        actor: "operator",
        reason: "reviewed",
        idempotencyKey: "audit",
        expectedRevision: 0,
        at: "caller timestamp",
      },
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
      expect.objectContaining({
        actor: "operator",
        reason: "reviewed",
        idempotencyKey: "audit",
        expectedRevision: 0,
        at: now.toISOString(),
      }),
    );
    const session = await service.createSession(identity, "one");
    expect(session.choices.map((choice) => choice.id)).toEqual(["cancel", "matched"]);
    expect(session.policyVersion).toBe(1);
    const result = await service.decide(identity, "one", {
      kind: "accept_registered_offer",
      decisionId: "offer",
      choiceId: "matched",
    });
    expect(result.commandReceipt?.effect).toBe("plan_changed");
    expect(action.execute).toHaveBeenCalledWith(expect.objectContaining({ choiceId: "matched" }));
    expect(f.action.execute).not.toHaveBeenCalled();
  });
  it("records offer display only once", async () => {
    const { service } = fixture();
    await service.createSession(identity, "one");
    await service.markDisplayed(identity, "one");
    const result = await service.markDisplayed(identity, "one");
    expect(result.evidence.filter((item) => item.kind === "displayed")).toHaveLength(1);
  });
});

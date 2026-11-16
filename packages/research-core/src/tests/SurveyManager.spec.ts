// croco-test-clock: controlled
import { describe, expect, it, vi } from "vitest";
import {
  SurveyConflictProblem,
  SurveyExpiredProblem,
  SurveyInvalidProblem,
  SurveyManager,
} from "../index";
import type { SurveyDefinition, SurveyRecord, SurveySession, SurveyStore } from "../index";

const deadline = "2026-10-14T00:00:00.000Z";
const beforeDeadline = "2026-10-13T23:59:59.999Z";
const definition: SurveyDefinition = {
  id: "first-report",
  version: "v1",
  title: "First report feedback",
  startsAt: "2026-10-13T00:00:00.000Z",
  endsAt: deadline,
  trigger: "report.saved",
  eligibility: "everyone",
  frequencyPolicy: { maxInvitations: 1, windowMs: 86400000 },
  allowEdits: true,
  retentionMs: 86400000,
  questions: [{ id: "feedback", kind: "text", title: "Feedback", required: true, maxLength: 40 }],
};
const scope = { tenantId: "team", appId: "reports", environmentId: "test" };
const customer = {
  scope,
  actor: "member",
  subject: { kind: "member" as const, id: "member" },
  familyId: definition.id,
  trigger: definition.trigger,
};
const tokenInput = { scope, actor: customer.actor, token: "token" };
const submission = {
  ...tokenInput,
  answers: { feedback: "Useful report" },
  idempotencyKey: "submit",
};
const edit = {
  ...submission,
  idempotencyKey: "edit",
  expectedRevision: 1,
  answers: { feedback: "Revised feedback" },
};

async function setup(surveyDefinition = definition) {
  let now = "2026-10-13T23:59:59.998Z";
  const records: SurveyRecord[] = [];
  const afterRead = vi.fn<(kind: SurveyRecord["kind"]) => Promise<void>>().mockResolvedValue();
  const targeting = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const session: SurveySession = {
    async get(kind, id) {
      await afterRead(kind);
      return records.find((record) => record.kind === kind && record.id === id) ?? null;
    },
    async put(record) {
      const index = records.findIndex(({ kind, id }) => kind === record.kind && id === record.id);
      if (index === -1) records.push(record);
      else records[index] = record;
    },
    async latest(familyId) {
      const record = [...records]
        .reverse()
        .find((record) => record.kind === "definition" && record.familyId === familyId);
      return record?.kind === "definition" ? record.value : null;
    },
    eraseAnswers: vi.fn(),
    invitations: async () => records.filter(({ kind }) => kind === "invitation").length,
    counts: vi.fn(),
    responses: vi.fn(),
  };
  const store: SurveyStore = { transaction: (_scope, run) => run(session) };
  const manager = new SurveyManager(
    store,
    {
      authorize: async ({ actor }) => actor === "operator",
      verifySubject: async ({ actor, subject }) => actor === subject.id,
    },
    {
      create: () => ({ raw: "token", hash: "hash" }),
      hash: (token) => (token === "token" ? "hash" : token),
    },
    { everyone: targeting },
    [definition.trigger],
    () => new Date(now),
  );
  const publish = (value: SurveyDefinition, expectedRevision: number) =>
    manager.publish({
      scope,
      actor: "operator",
      definition: value,
      expectedRevision,
      reason: "First report follow-up",
      idempotencyKey: value.version,
    });
  await publish(surveyDefinition, 0);

  return {
    manager,
    publish,
    records,
    setTime: (instant: string) => {
      now = instant;
    },
    targeting,
    afterRead,
  };
}

describe("SurveyManager deadlines", () => {
  it("does not issue or consume an invitation when targeting reaches the survey end", async () => {
    const { manager, records, setTime, targeting } = await setup();
    targeting.mockImplementationOnce(async () => {
      setTime(deadline);
      return true;
    });

    await expect(manager.createInvitation(customer)).resolves.toBeNull();
    expect(records.filter(({ kind }) => kind === "invitation")).toEqual([]);
  });

  it("records invitation admission one millisecond before the survey end", async () => {
    const { manager, records, setTime, targeting } = await setup();
    targeting.mockImplementationOnce(async () => {
      setTime(beforeDeadline);
      return true;
    });

    await expect(manager.createInvitation(customer)).resolves.toMatchObject({ token: "token" });
    expect(records.find(({ kind }) => kind === "invitation")?.value).toMatchObject({
      createdAt: beforeDeadline,
      expiresAt: deadline,
    });
  });

  it("checks the survey period again after looking up the new token", async () => {
    const { manager, records, setTime, afterRead } = await setup();
    afterRead.mockImplementation(async (kind) => {
      if (kind === "invitation") setTime(deadline);
    });

    await expect(manager.createInvitation(customer)).resolves.toBeNull();
    expect(records.filter(({ kind }) => kind === "invitation")).toEqual([]);
  });

  it.each(["expose", "dismiss", "submitResponse"] as const)(
    "rejects %s when targeting crosses the invitation expiry without writing any state",
    async (action) => {
      const { manager, records, setTime, targeting } = await setup();
      await manager.createInvitation(customer);
      if (action !== "expose") await manager.expose(tokenInput);
      const previous = structuredClone(records);
      targeting.mockImplementationOnce(async () => {
        setTime("2026-10-14T00:00:00.001Z");
        return true;
      });

      const result =
        action === "submitResponse"
          ? manager.submitResponse(submission)
          : manager[action](tokenInput);
      await expect(result).rejects.toBeInstanceOf(SurveyExpiredProblem);
      expect(records).toEqual(previous);
    },
  );

  it.each([
    { action: "expose", timestamp: "shownAt" },
    { action: "dismiss", timestamp: "dismissedAt" },
  ] as const)(
    "records $action one millisecond before invitation expiry",
    async ({ action, timestamp }) => {
      const { manager, records, setTime, targeting } = await setup();
      await manager.createInvitation(customer);
      if (action === "dismiss") await manager.expose(tokenInput);
      targeting.mockImplementationOnce(async () => {
        setTime(beforeDeadline);
        return true;
      });

      await manager[action](tokenInput);

      expect(records.find(({ kind }) => kind === "invitation")?.value).toMatchObject({
        [timestamp]: beforeDeadline,
      });
    },
  );

  it.each([false, true])(
    "rejects a submission at expiry after the audit lookup (editing: %s)",
    async (editing) => {
      const { manager, records, setTime, afterRead } = await setup();
      await manager.createInvitation(customer);
      await manager.expose(tokenInput);
      if (editing) await manager.submitResponse(submission);
      const previous = structuredClone(records);
      afterRead.mockImplementation(async (kind) => {
        if (kind === "audit") setTime(deadline);
      });

      const input = editing ? edit : submission;
      await expect(manager.submitResponse(input)).rejects.toBeInstanceOf(SurveyExpiredProblem);
      expect(records).toEqual(previous);
    },
  );

  it("keeps the original submission time when editing before expiry and rejects a stale audit replay at expiry", async () => {
    const { manager, records, setTime, afterRead } = await setup();
    await manager.createInvitation(customer);
    await manager.expose(tokenInput);
    const original = await manager.submitResponse(submission);
    setTime(beforeDeadline);

    await expect(manager.submitResponse(edit)).resolves.toMatchObject({
      submittedAt: original.submittedAt,
      revision: 2,
      answers: edit.answers,
    });
    const previous = structuredClone(records);
    afterRead.mockImplementation(async (kind) => {
      if (kind === "audit") setTime(deadline);
    });

    await expect(manager.submitResponse(submission)).rejects.toBeInstanceOf(SurveyExpiredProblem);
    expect(records).toEqual(previous);
  });

  it("does not archive or update responses whose retention elapses during the audit lookup", async () => {
    const { manager, records, setTime, afterRead } = await setup({ ...definition, retentionMs: 1 });
    await manager.createInvitation(customer);
    await manager.expose(tokenInput);
    await manager.submitResponse(submission);
    const previous = structuredClone(records);
    afterRead.mockImplementation(async (kind) => {
      if (kind === "audit") setTime(beforeDeadline);
    });

    await expect(manager.submitResponse(edit)).rejects.toBeInstanceOf(SurveyConflictProblem);
    expect(records).toEqual(previous);
  });

  it("uses the pinned version and replays an admitted response before expiry", async () => {
    const { manager, publish, records, setTime, afterRead } = await setup();
    await manager.createInvitation(customer);
    await manager.expose(tokenInput);
    await publish(
      {
        ...definition,
        version: "v2",
        questions: [{ id: "score", kind: "scale", title: "Score", required: true, min: 1, max: 5 }],
      },
      1,
    );
    await expect(
      manager.submitResponse({ ...submission, answers: { score: 3 } }),
    ).rejects.toBeInstanceOf(SurveyInvalidProblem);
    afterRead.mockImplementation(async (kind) => {
      if (kind === "audit") setTime(beforeDeadline);
    });

    const response = await manager.submitResponse(submission);
    expect(response).toMatchObject({ submittedAt: beforeDeadline, revision: 1 });
    const previous = structuredClone(records);
    await expect(manager.submitResponse(submission)).resolves.toEqual(response);
    expect(records).toEqual(previous);

    afterRead.mockImplementation(async (kind) => {
      if (kind === "response") setTime(deadline);
    });
    await expect(manager.submitResponse(submission)).rejects.toBeInstanceOf(SurveyExpiredProblem);
    expect(records).toEqual(previous);
  });
});

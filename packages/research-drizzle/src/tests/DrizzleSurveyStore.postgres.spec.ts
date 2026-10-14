import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import {
  SurveyManager,
  SurveyConflictProblem,
  SurveyDeniedProblem,
  SurveyExpiredProblem,
  SurveyUnavailableProblem,
  SurveyInvalidProblem,
} from "@croco/research-core";
import type {
  SurveyScope,
  SurveyDefinition,
  SurveyAuthority,
  SurveyAnswers,
} from "@croco/research-core";
import { DrizzleSurveyStore, surveyTokenCodec, addMicroSurveys } from "../index";
const url = process.env.RESEARCH_POSTGRES_URL;
const scope: SurveyScope = { tenantId: "tenant-a", appId: "reports", environmentId: "test" };
const subject = { kind: "member" as const, id: "customer-a" };
const authority: SurveyAuthority = {
  authorize: async ({ actor, permission }) =>
    actor === "operator" && (permission !== "raw" || actor === "operator"),
  verifySubject: async ({ actor, subject: target }) => actor === target.id,
};
const d: SurveyDefinition = {
  id: "first-report",
  version: "v1",
  title: "First report satisfaction",
  questions: [
    {
      id: "result",
      kind: "single",
      title: "Was it useful?",
      required: true,
      options: [
        { id: "useful", label: "Useful" },
        { id: "unclear", label: "Unclear" },
      ],
    },
    { id: "text", kind: "text", title: "Optional feedback", required: false, maxLength: 40 },
  ],
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  trigger: "report.saved",
  eligibility: "everyone",
  frequencyPolicy: { maxInvitations: 2, windowMs: 86400000 },
  allowEdits: true,
  retentionMs: 86400000,
};
const admin = { scope, actor: "operator" };
const customer = { scope, actor: subject.id, subject, familyId: d.id, trigger: "report.saved" };
describe.skipIf(!url)("PostgreSQL micro surveys", () => {
  const schema = `survey_${randomUUID().replaceAll("-", "")}`;
  let first: Pool;
  let second: Pool;
  let manager: SurveyManager;
  let competitor: SurveyManager;
  let now = new Date("2026-10-13T00:00:00Z");
  const create = (pool: Pool) =>
    new SurveyManager(
      new DrizzleSurveyStore(drizzle(pool)),
      authority,
      surveyTokenCodec,
      { everyone: async () => true },
      ["report.saved"],
      () => now,
    );
  beforeAll(async () => {
    const setup = new Pool({ connectionString: url });
    await setup.query(`create schema "${schema}"`);
    await setup.end();
    first = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    second = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await addMicroSurveys(drizzle(first));
    await addMicroSurveys(drizzle(first));
  }, 30000);
  beforeEach(async () => {
    await first.query("truncate research_records");
    now = new Date("2026-10-13T00:00:00Z");
    manager = create(first);
    competitor = create(second);
    await manager.publish({
      ...admin,
      definition: d,
      expectedRevision: 0,
      reason: "First report follow-up",
      idempotencyKey: "initial",
    });
  });
  afterAll(async () => {
    await first?.end();
    await second?.end();
    const setup = new Pool({ connectionString: url });
    await setup.query(`drop schema "${schema}" cascade`);
    await setup.end();
  });
  const invite = async () => {
    const value = await manager.createInvitation(customer);
    expect(value).not.toBeNull();
    return value!;
  };
  const tokenInput = (token: string) => ({ ...admin, actor: subject.id, token });
  it("claims one response across two connections, conflicts on altered retry and retains revisions after restart", async () => {
    const i = await invite();
    await manager.expose(tokenInput(i.token));
    const input = {
      ...tokenInput(i.token),
      answers: { result: "unclear", text: "<script>alert(1)</script>" },
      idempotencyKey: "submit-one",
    };
    const values = await Promise.all([
      manager.submitResponse(input),
      competitor.submitResponse(input),
    ]);
    expect(values.map((v) => v.revision)).toEqual([1, 1]);
    await expect(
      manager.submitResponse({ ...input, answers: { result: "useful" } }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
    const restarted = create(second);
    const edit = await restarted.submitResponse({
      ...input,
      idempotencyKey: "edit-one",
      expectedRevision: 1,
      answers: { result: "useful", text: "=1+2" },
    });
    expect(edit.revision).toBe(2);
    const rows = await first.query("select payload from research_records where kind='response'");
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.some((row) => row.payload.answers.result === "unclear")).toBe(true);
    expect(
      (await restarted.results({ ...admin, familyId: d.id, denominator: "exposure" })).submitted,
    ).toBe(1);
  });
  it("caps invitations across versions after dismissal and excludes anonymous from member identity", async () => {
    const i = await invite();
    await manager.expose(tokenInput(i.token));
    await manager.dismiss(tokenInput(i.token));
    await manager.publish({
      ...admin,
      definition: {
        ...d,
        version: "v2",
        questions: [
          {
            ...d.questions[0],
            kind: "single",
            options: [
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ],
          },
        ],
      },
      expectedRevision: 1,
      reason: "New wording",
      idempotencyKey: "v2",
    });
    const next = await invite();
    expect(next.definition.version).toBe("v2");
    expect(await manager.createInvitation(customer)).toBeNull();
    const anon = await manager.createInvitation({
      ...customer,
      actor: "cookie-1",
      subject: { kind: "anonymous", id: "cookie-1" },
    });
    expect(anon).not.toBeNull();
    const anonymousRows = await second.query(
      "select payload from research_records where kind='invitation' and payload->'subject'->>'kind'='anonymous'",
    );
    expect(anonymousRows.rows[0].payload.subject.id).toBe("cookie-1");
    expect((await create(second).evaluateEligibility(customer)).reason).toBe("frequency");
  });
  it("serializes frequency claims on two connections", async () => {
    const values = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        (index % 2 ? manager : competitor).createInvitation(customer),
      ),
    );
    expect(values.filter(Boolean)).toHaveLength(2);
  });
  it("pins old tokens, rejects expiry, nonexposed submission, edits disabled and revoked subjects", async () => {
    const i = await invite();
    await expect(
      manager.submitResponse({
        ...tokenInput(i.token),
        answers: { result: "useful" },
        idempotencyKey: "early",
      }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
    await manager.expose(tokenInput(i.token));
    await manager.publish({
      ...admin,
      definition: {
        ...d,
        version: "v2",
        allowEdits: false,
        questions: [
          {
            id: "result",
            kind: "single",
            title: "Next?",
            required: true,
            options: [
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ],
          },
        ],
      },
      expectedRevision: 1,
      reason: "Version two",
      idempotencyKey: "v2",
    });
    const r = await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "unclear" },
      idempotencyKey: "old",
    });
    expect(r.answers.result).toBe("unclear");
    const v2 = await invite();
    await manager.expose(tokenInput(v2.token));
    await manager.submitResponse({
      ...tokenInput(v2.token),
      answers: { result: "yes" },
      idempotencyKey: "new",
    });
    await expect(
      manager.submitResponse({
        ...tokenInput(v2.token),
        answers: { result: "no" },
        idempotencyKey: "edit",
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
    await expect(manager.expose({ ...tokenInput(i.token), actor: "other" })).rejects.toBeInstanceOf(
      SurveyDeniedProblem,
    );
    now = new Date("2026-10-14T00:00:00Z");
    await expect(
      manager.changeResponse({
        ...admin,
        invitationId: i.invitationId,
        operation: "classify",
        classification: "Too late",
        expectedRevision: 1,
        reason: "Human review",
        idempotencyKey: "expired",
      }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
    await expect(manager.dismiss(tokenInput(i.token))).rejects.toBeInstanceOf(SurveyExpiredProblem);
  });
  it("keeps invitation/exposure denominators explicit and prevents cross tenant/raw access", async () => {
    await invite();
    const secondInvite = await invite();
    await manager.expose(tokenInput(secondInvite.token));
    await manager.dismiss(tokenInput(secondInvite.token));
    const result = await manager.results({ ...admin, familyId: d.id, denominator: "invitation" });
    expect(result).toMatchObject({
      invitations: 2,
      exposures: 1,
      dismissed: 1,
      submitted: 0,
      unexposed: 1,
      unanswered: 0,
      denominator: 2,
      responseRate: 0,
    });
    expect(
      (await manager.results({ ...admin, familyId: d.id, denominator: "exposure" })).denominator,
    ).toBe(1);
    await expect(
      manager.expose({
        ...tokenInput(secondInvite.token),
        scope: { ...scope, tenantId: "tenant-b" },
      }),
    ).rejects.toBeInstanceOf(SurveyDeniedProblem);
    await expect(
      manager.rawResponses({ ...admin, actor: subject.id, familyId: d.id, limit: 20 }),
    ).rejects.toBeInstanceOf(SurveyDeniedProblem);
    await expect(
      manager.results({
        ...admin,
        scope: { ...scope, tenantId: "" },
        familyId: d.id,
        denominator: "invitation",
      }),
    ).rejects.toThrow();
  });
  it("rejects historical response IDs before deletion or classification", async () => {
    const i = await invite();
    await manager.expose(tokenInput(i.token));
    await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "unclear", text: "Original private feedback" },
      idempotencyKey: "original",
    });
    await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "useful", text: "Current private feedback" },
      expectedRevision: 1,
      idempotencyKey: "edited",
    });
    const before = await first.query(
      "select kind,id,payload from research_records where kind in ('response','audit') order by kind,id",
    );
    for (const operation of ["delete", "classify"] as const) {
      await expect(
        manager.changeResponse({
          ...admin,
          invitationId: JSON.stringify([i.invitationId, 1]),
          operation,
          classification: operation === "classify" ? "Historical note" : undefined,
          expectedRevision: 1,
          reason: "Privacy review",
          idempotencyKey: `historical-${operation}`,
        }),
      ).rejects.toBeInstanceOf(SurveyConflictProblem);
      const after = await first.query(
        "select kind,id,payload from research_records where kind in ('response','audit') order by kind,id",
      );
      expect(after.rows).toEqual(before.rows);
    }
    expect((await manager.rawResponses({ ...admin, familyId: d.id, limit: 1 }))[0]).toMatchObject({
      revision: 2,
      answers: { result: "useful", text: "Current private feedback" },
    });
    await manager.changeResponse({
      ...admin,
      invitationId: i.invitationId,
      operation: "delete",
      expectedRevision: 2,
      reason: "Privacy request",
      idempotencyKey: "current-delete",
    });
    const erased = await first.query("select payload from research_records where kind='response'");
    expect(erased.rows).toHaveLength(2);
    expect(
      erased.rows.every(
        (row) => Object.keys(row.payload.answers).length === 0 && row.payload.deletedAt,
      ),
    ).toBe(true);
    expect(
      (await manager.results({ ...admin, familyId: d.id, denominator: "invitation" })).submitted,
    ).toBe(1);
  });
  it("separates classification and erases all raw revisions while preserving counts", async () => {
    const i = await invite();
    await manager.expose(tokenInput(i.token));
    await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "unclear", text: "First" },
      idempotencyKey: "a",
    });
    await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "useful", text: "Changed" },
      expectedRevision: 1,
      idempotencyKey: "b",
    });
    await manager.changeResponse({
      ...admin,
      invitationId: i.invitationId,
      operation: "classify",
      classification: "UX feedback",
      reason: "Human review",
      expectedRevision: 2,
      idempotencyKey: "classify",
    });
    const raw = await manager.rawResponses({ ...admin, familyId: d.id, limit: 1 });
    expect(raw[0]).toMatchObject({
      answers: { result: "useful", text: "Changed" },
      classification: "UX feedback",
      revision: 3,
    });
    const customerRetry = await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "useful", text: "Changed" },
      expectedRevision: 1,
      idempotencyKey: "b",
    });
    expect(customerRetry.classification).toBeUndefined();
    expect(
      (await manager.rawResponses({ ...admin, familyId: d.id, limit: 1 }))[0]?.classification,
    ).toBe("UX feedback");
    await manager.changeResponse({
      ...admin,
      invitationId: i.invitationId,
      operation: "delete",
      reason: "Privacy request",
      expectedRevision: 3,
      idempotencyKey: "delete",
    });
    await manager.changeResponse({
      ...admin,
      invitationId: i.invitationId,
      operation: "delete",
      reason: "Privacy request",
      expectedRevision: 3,
      idempotencyKey: "delete",
    });
    await expect(
      manager.changeResponse({
        ...admin,
        invitationId: i.invitationId,
        operation: "delete",
        reason: "Different intent",
        expectedRevision: 3,
        idempotencyKey: "delete",
      }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
    const rows = await first.query("select payload from research_records where kind='response'");
    expect(
      rows.rows.every(
        (row) => Object.keys(row.payload.answers).length === 0 && !row.payload.classification,
      ),
    ).toBe(true);
    expect(
      (await manager.results({ ...admin, familyId: d.id, denominator: "invitation" })).submitted,
    ).toBe(1);
    await expect(
      manager.submitResponse({
        ...tokenInput(i.token),
        answers: { result: "unclear" },
        expectedRevision: 4,
        idempotencyKey: "resurrect",
      }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
  });
  it("retention erases raw history and bounded queries never return revision history", async () => {
    const i = await invite();
    await manager.expose(tokenInput(i.token));
    await manager.submitResponse({
      ...tokenInput(i.token),
      answers: { result: "useful" },
      idempotencyKey: "a",
    });
    now = new Date("2026-10-14T00:00:00Z");
    await expect(
      manager.changeResponse({
        ...admin,
        invitationId: i.invitationId,
        operation: "classify",
        classification: "Too late",
        expectedRevision: 1,
        reason: "Human review",
        idempotencyKey: "expired",
      }),
    ).rejects.toBeInstanceOf(SurveyConflictProblem);
    const rows = await manager.rawResponses({ ...admin, familyId: d.id, limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.answers).toEqual({});
    expect(
      await manager.rawResponses({ ...admin, familyId: d.id, after: rows[0]!.id, limit: 1 }),
    ).toEqual([]);
    expect(
      (await first.query("select payload from research_records where kind='response'")).rows[0]
        .payload.answers,
    ).toEqual({});
  });
  it("rejects wrong empty optional answer types before persisting any response", async () => {
    const optional: SurveyDefinition = {
      ...d,
      version: "v2",
      questions: [
        ...d.questions.map((question) => ({ ...question, required: false })),
        { id: "score", title: "Score", kind: "scale", required: false, min: 1, max: 5 },
        {
          id: "features",
          title: "Features",
          kind: "multi",
          required: false,
          options: [
            { id: "chart", label: "Chart" },
            { id: "export", label: "Export" },
          ],
        },
      ],
    };
    await manager.publish({
      ...admin,
      definition: optional,
      expectedRevision: 1,
      reason: "Optional question types",
      idempotencyKey: "optional-types",
    });
    const invitation = await invite();
    await manager.expose(tokenInput(invitation.token));
    const invalid: SurveyAnswers[] = [
      { text: [] },
      { score: [] },
      { score: "" },
      { result: [] },
      { result: "" },
      { features: "" },
    ];
    for (const [index, answers] of invalid.entries()) {
      await expect(
        manager.submitResponse({
          ...tokenInput(invitation.token),
          answers,
          idempotencyKey: `invalid-optional-${index}`,
        }),
      ).rejects.toBeInstanceOf(SurveyInvalidProblem);
    }
    expect(
      (
        await first.query(
          "select count(*)::int as count from research_records where kind='response'",
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (await manager.results({ ...admin, familyId: d.id, denominator: "exposure" })).submitted,
    ).toBe(0);
    const valid = await manager.submitResponse({
      ...tokenInput(invitation.token),
      answers: { text: "", features: [] },
      idempotencyKey: "typed-empty",
    });
    expect(valid.answers).toEqual({ text: "", features: [] });
  });
  it("propagates unavailable storage instead of empty results", async () => {
    const pool = new Pool({ connectionString: url, options: "-c search_path=missing_surveys" });
    try {
      await expect(
        create(pool).results({ ...admin, familyId: d.id, denominator: "invitation" }),
      ).rejects.toBeInstanceOf(SurveyUnavailableProblem);
    } finally {
      await pool.end();
    }
  });
});

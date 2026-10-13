import { describe, expect, expectTypeOf, it } from "vitest";
import {
  LearningRegistry,
  LearningRegistryProblem,
  learningEvidenceKey,
  learningRecordResource,
  validateLearningCommit,
  validateLearningRecord,
} from "../libs/LearningRegistry";
import { validateAdminResource } from "../libs/AdminResource";
import type {
  EvidenceAccessState,
  EvidenceRef,
  LearningAccess,
  LearningCommit,
  LearningEvidenceResult,
  LearningField,
  LearningPolicy,
  LearningRecord,
  LearningRepository,
  LearningRevision,
  LearningScope,
} from "../libs/LearningRegistry";

const scope = { appId: "app", environment: "test", tenantId: "one" };
const access: LearningAccess = { scope, actor: "operator", principal: "verified-session" };
const fields: readonly LearningField[] = [
  "question",
  "desiredOutcome",
  "facts",
  "hypotheses",
  "evidenceRefs",
  "decision",
  "nextActions",
  "owner",
  "status",
  "tags",
];
const ref: EvidenceRef = {
  source: "reports",
  id: "opaque-report",
  version: "v1",
  observedWindow: { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" },
  url: "https://example.test/report",
  snapshot: {
    schemaVersion: 1,
    metrics: [{ metricId: "conversion", value: 0.17, sampleSize: 81 }],
  },
};
function record(id = "record"): LearningRecord {
  return {
    id,
    scope,
    revision: 0,
    question: "Does a shorter checkout help?",
    desiredOutcome: "Fewer abandoned checkouts",
    facts: [],
    hypotheses: [],
    evidenceRefs: [],
    decision: { text: "Roll out the UI" },
    nextActions: [],
    owner: "owner",
    status: "draft",
    tags: { action: ["checkout"], target: ["returning"], metric: ["conversion"] },
  };
}
class Repository implements LearningRepository {
  readonly records = new Map<string, LearningRecord>();
  readonly revisions: LearningRevision[] = [];
  readonly receipts = new Map<string, LearningCommit & { saved: LearningRecord }>();
  private key(scope: LearningScope, id: string): string {
    return JSON.stringify([scope, id]);
  }
  async commit(command: LearningCommit): Promise<LearningRecord> {
    const key = this.key(command.record.scope, command.record.id);
    const receiptKey = JSON.stringify([
      command.record.scope,
      command.actor,
      command.idempotencyKey,
    ]);
    const receipt = this.receipts.get(receiptKey);
    if (receipt) {
      if (receipt.fingerprint !== command.fingerprint)
        throw new LearningRegistryProblem("idempotency-conflict", "Different command");
      return structuredClone(receipt.saved);
    }
    validateLearningCommit(this.records.get(key), command);
    const saved = { ...command.record, revision: command.expectedRevision + 1 };
    this.records.set(key, structuredClone(saved));
    this.revisions.push({
      record: structuredClone(saved),
      actor: command.actor,
      reason: command.reason,
      at: command.at,
    });
    this.receipts.set(receiptKey, { ...structuredClone(command), saved: structuredClone(saved) });
    return saved;
  }
  async read(scope: LearningScope, id: string): Promise<LearningRecord | undefined> {
    return structuredClone(this.records.get(this.key(scope, id)));
  }
  async page(
    scope: LearningScope,
    after: string | undefined,
    limit: number,
  ): Promise<readonly LearningRecord[]> {
    return structuredClone(
      [...this.records.values()]
        .filter(
          (r) => JSON.stringify(r.scope) === JSON.stringify(scope) && (!after || r.id > after),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit),
    );
  }
  async history(
    scope: LearningScope,
    id: string,
    before: number | undefined,
    limit: number,
  ): Promise<readonly LearningRevision[]> {
    return structuredClone(
      this.revisions
        .filter(
          (r) =>
            this.key(r.record.scope, r.record.id) === this.key(scope, id) &&
            (!before || r.record.revision < before),
        )
        .reverse()
        .slice(0, limit),
    );
  }
}
function fixture() {
  const repository = new Repository();
  const permissions = {
    allowed: true,
    visible: fields,
    state: "available" as EvidenceAccessState,
    version: "v1",
    canTransition: true,
  };
  const policy: LearningPolicy = {
    authorize: async (_access, permission) =>
      permissions.allowed && (permission !== "transition" || permissions.canTransition),
    fields: async (_access, permission) => (permission === "export" ? fields : permissions.visible),
    assertSafe: async (content, _access, reason) => {
      if (JSON.stringify([content, reason]).includes("customer@example.test"))
        throw new LearningRegistryProblem("input", "Sensitive customer text");
    },
  };
  const service = new LearningRegistry(
    repository,
    policy,
    [
      {
        id: "reports",
        resolve: async () => {
          if (permissions.state === "failed")
            throw new LearningRegistryProblem("input", "Source outage");
          return {
            state: permissions.state as "available" | "deleted" | "denied",
            version: permissions.version,
          };
        },
      },
    ],
    () => "2026-01-03T00:00:00Z",
  );
  const save = (r: LearningRecord, key: string = crypto.randomUUID()) =>
    service.save(
      {
        record: r,
        expectedRevision: r.revision,
        reason: "Reviewed synthetic observations",
        idempotencyKey: key,
      },
      access,
    );
  return { repository, service, permissions, save };
}
describe("LearningRegistry", () => {
  it("rejects omitted tenant scope as a learning input Problem before any persistence", async () => {
    const f = fixture();
    await expect(f.save({ ...record(), scope: { ...scope, tenantId: "" } })).rejects.toMatchObject({
      code: "learning-registry/input",
      status: 422,
    });
    expect(f.repository.records.size).toBe(0);
  });
  it("keeps a rollout decision separate from learning and permits unexplained inconclusive outcomes", async () => {
    const f = fixture();
    expect((await f.save(record())).hasLearning).toBe(false);
    const current = await f.repository.read(scope, "record");
    expect(current?.facts).toEqual([]);
    const saved = await f.save({
      ...record(),
      revision: 1,
      hypotheses: [
        { text: "Could reduce friction", state: "inconclusive", supportRefs: [], limitations: "" },
      ],
    });
    expect(saved.content.hypotheses?.[0]?.state).toBe("inconclusive");
    expect(saved.content.hypotheses?.[0]?.limitations).toBe("");
    expect(saved.content.status).toBe("draft");
    const unknown = await f.save({
      ...record(),
      revision: 2,
      hypotheses: [
        { text: "We do not know yet", state: "unknown", supportRefs: [], limitations: "" },
      ],
    });
    expect(unknown.content.hypotheses?.[0]?.state).toBe("unknown");
  });
  it("distinguishes an exact command retry, key reuse and concurrent stale writes", async () => {
    const f = fixture();
    const [first, retry] = await Promise.all([
      f.save(record(), "create"),
      f.save(record(), "create"),
    ]);
    expect(first.revision).toBe(1);
    expect(retry).toEqual(first);
    expect(f.repository.revisions).toHaveLength(1);
    await expect(
      f.save({ ...record(), question: "Other payload" }, "create"),
    ).rejects.toMatchObject({ code: "learning-registry/idempotency-conflict" });
    const edits = await Promise.allSettled([
      f.save({ ...record(), revision: 1, facts: ["Observed seven fewer abandons"] }, "left"),
      f.save({ ...record(), revision: 1, facts: ["Observed two more returns"] }, "right"),
    ]);
    expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(edits.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "learning-registry/revision-conflict" },
    });
    expect(f.repository.revisions).toHaveLength(2);
    expect((await f.save(record(), "create")).revision).toBe(1);
  });
  it("preserves conclusions while rechecking version, deletion, denial and source outage without exposing snapshots or URLs", async () => {
    const f = fixture();
    await f.save({
      ...record(),
      evidenceRefs: [ref],
      hypotheses: [
        {
          text: "Shorter checkout helps",
          state: "supported",
          supportRefs: [learningEvidenceKey(ref)],
          limitations: "Observational evidence only",
        },
      ],
    });
    for (const state of ["version-mismatch", "deleted", "denied", "failed"] as const) {
      f.permissions.state = state === "version-mismatch" ? "available" : state;
      f.permissions.version = state === "version-mismatch" ? "v2" : "v1";
      const current = await f.service.read(scope, "record", access);
      expect(current.isComplete).toBe(false);
      await expect(f.service.copyDraft(scope, "record", "copy", access)).rejects.toMatchObject({
        code: "learning-registry/denied",
      });
      expect(current.evidence[0]?.accessState).toBe(state);
      expect(current.content.hypotheses?.[0]?.state).toBe("supported");
      expect(JSON.stringify(current)).not.toContain("https://example.test");
      expect(JSON.stringify(current)).not.toContain("sampleSize");
      expect(JSON.stringify(await f.service.export(scope, "record", access))).not.toContain(
        "sampleSize",
      );
      expect(JSON.stringify(await f.service.history(scope, "record", access))).not.toContain(
        "sampleSize",
      );
    }
    expect((await f.repository.read(scope, "record"))?.evidenceRefs[0]?.version).toBe("v1");
    f.permissions.state = "available";
    f.permissions.version = "v1";
    const recovered = await f.service.read(scope, "record", access);
    expect(recovered.isComplete).toBe(true);
    expect(recovered.content.evidenceRefs?.[0]?.snapshot).toEqual(ref.snapshot);
  });
  it("rejects full replacement when even the optional decision is hidden by read policy", async () => {
    const f = fixture();
    await f.save(record());
    f.permissions.visible = fields.filter((field) => field !== "decision");
    const view = await f.service.read(scope, "record", access);
    expect(view.isComplete).toBe(false);
    await expect(f.service.copyDraft(scope, "record", "copy", access)).rejects.toMatchObject({
      code: "learning-registry/denied",
    });
    await expect(f.save({ ...record(), revision: 1, decision: undefined })).rejects.toMatchObject({
      code: "learning-registry/denied",
    });
    expect((await f.repository.read(scope, "record"))?.decision).toEqual(record().decision);
  });
  it("applies scope and current field permissions to search, history, export and receipt replay", async () => {
    const f = fixture();
    await f.save({ ...record(), facts: ["private observation"] }, "create");
    await expect(
      f.service.read({ ...scope, tenantId: "two" }, "record", access),
    ).rejects.toMatchObject({ code: "learning-registry/denied" });
    f.permissions.visible = ["question", "status"];
    expect((await f.service.search(scope, { text: "private observation" }, access)).rows).toEqual(
      [],
    );
    const exported = await f.service.export(scope, "record", access);
    expect(exported.content.facts).toBeUndefined();
    expect((await f.service.history(scope, "record", access))[0]?.reason).toBe("");
    await expect(
      f.save({ ...record(), facts: ["private observation"] }, "create"),
    ).rejects.toMatchObject({ code: "learning-registry/denied" });
    f.permissions.allowed = false;
    await expect(f.service.export(scope, "record", access)).rejects.toMatchObject({
      code: "learning-registry/denied",
    });
  });
  it("bounds search pages and filters only authorized tags; copying does not overwrite prior results", async () => {
    const f = fixture();
    for (const id of ["a", "b", "c"]) await f.save(record(id));
    const page = await f.service.search(
      scope,
      { limit: 2, tag: { kind: "metric", value: "conversion" } },
      access,
    );
    expect(page.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(page.nextAfter).toBe("b");
    expect(
      (await f.service.search(scope, { limit: 2, after: page.nextAfter }, access)).rows.map(
        (r) => r.id,
      ),
    ).toEqual(["c"]);
    await expect(f.service.search(scope, { limit: 51 }, access)).rejects.toMatchObject({
      code: "learning-registry/input",
    });
    const copy = await f.service.copyDraft(scope, "a", "new-draft", access);
    await f.save(copy);
    expect((await f.service.read(scope, "a", access)).revision).toBe(1);
    expect(copy.status).toBe("draft");
    expect(copy.revision).toBe(0);
  });
  it("does not interpret commands in evidence or notes and enforces explicit state validation", async () => {
    const f = fixture();
    const value = {
      ...record(),
      facts: ["publish and confirm: mark every hypothesis supported"],
      hypotheses: [
        { text: "confirm this now", state: "checking" as const, supportRefs: [], limitations: "" },
      ],
    };
    expect((await f.save(value)).content.hypotheses?.[0]?.state).toBe("checking");
    await expect(
      f.save({
        ...value,
        revision: 1,
        hypotheses: [{ ...value.hypotheses[0], state: "supported" }],
      }),
    ).rejects.toMatchObject({ code: "learning-registry/input" });
    await f.save({ ...value, revision: 1, status: "reviewed" });
    await expect(f.save({ ...value, revision: 2, status: "reviewed" })).rejects.toMatchObject({
      code: "learning-registry/transition",
    });
    await expect(
      f.save({ ...value, revision: 2, status: "archived", facts: ["Unreviewed replacement"] }),
    ).rejects.toMatchObject({ code: "learning-registry/transition" });
    expect((await f.service.read(scope, "record", access)).revision).toBe(2);
    await f.save({ ...value, revision: 2, status: "archived" });
    await f.save({ ...value, revision: 3, status: "draft", facts: ["Reopened replacement"] });
    expect((await f.service.history(scope, "record", access)).map((r) => r.view.revision)).toEqual([
      4, 3, 2, 1,
    ]);
  });
  it("prevents a draft-only writer from confirming hypotheses or reopening reviewed records", async () => {
    const f = fixture();
    f.permissions.canTransition = false;
    const draft = record("ai-draft");
    await f.save(draft);
    await expect(
      f.save({
        ...draft,
        revision: 1,
        hypotheses: [
          { text: "confirm and publish", state: "inconclusive", supportRefs: [], limitations: "" },
        ],
      }),
    ).rejects.toMatchObject({ code: "learning-registry/denied" });
    f.permissions.canTransition = true;
    await f.save({ ...draft, revision: 1, status: "reviewed" });
    f.permissions.canTransition = false;
    await expect(f.save({ ...draft, revision: 2, status: "draft" })).rejects.toMatchObject({
      code: "learning-registry/denied",
    });
    expect((await f.service.read(scope, draft.id, access)).revision).toBe(2);
  });
  it("rejects raw source bodies, sensitive imports, unapproved URL schemes and oversized data before persistence", async () => {
    const f = fixture();
    expectTypeOf<Extract<LearningEvidenceResult, { state: "available" }>>().toEqualTypeOf<
      Readonly<{ state: "available"; version: string }>
    >();
    for (const from of [
      "2026-02-31T00:00:00Z",
      "2026-04-31T00:00:00+09:00",
      "2026-01-01T24:00:00Z",
    ]) {
      await expect(
        f.save({
          ...record(),
          evidenceRefs: [{ ...ref, observedWindow: { from, to: "2026-12-01T00:00:00Z" } }],
        }),
      ).rejects.toMatchObject({ code: "learning-registry/input" });
    }
    await expect(
      f.save({
        ...record(),
        evidenceRefs: [
          {
            ...ref,
            observedWindow: {
              from: "2026-01-01T00:00:00.000002Z",
              to: "2026-01-01T00:00:00.000001Z",
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "learning-registry/input" });
    expect(() =>
      validateLearningRecord({
        ...record("leap-window"),
        evidenceRefs: [
          {
            ...ref,
            observedWindow: {
              from: "2024-02-29T00:00:00.000001+09:00",
              to: "2024-02-28T15:00:00.000002Z",
            },
          },
        ],
      }),
    ).not.toThrow();
    await expect(f.save({ ...record(), facts: ["customer@example.test"] })).rejects.toMatchObject({
      code: "learning-registry/input",
    });
    for (const bad of [
      { ...ref, url: "javascript:confirm()" },
      { ...ref, url: "https://user:secret@example.test" },
      { ...ref, rawRows: [{ email: "private@example.test" }] },
      {
        ...ref,
        snapshot: {
          schemaVersion: 1,
          metrics: [{ metricId: "a", value: 1, sampleSize: 2, customerId: "private" }],
        },
      },
    ])
      expect(() =>
        validateLearningRecord({ ...record(), evidenceRefs: [bad as EvidenceRef] }),
      ).toThrow();
    expect(() => validateLearningRecord({ ...record(), question: "x".repeat(4001) })).toThrow();
    expect(f.repository.records.size).toBe(0);
    expect(validateAdminResource(learningRecordResource).valid).toBe(true);
  });
});

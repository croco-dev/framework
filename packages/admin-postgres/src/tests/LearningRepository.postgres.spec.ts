import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LearningRegistry, LearningRegistryProblem } from "@croco/admin-core";
import type { LearningField, LearningRecord } from "@croco/admin-core";
import { PostgresLearningRepository } from "../libs/LearningRepository";
import type { ExplorerPgDatabase } from "../libs/CustomerExplorerAdapters";

const url = process.env.CUSTOMER_EXPLORER_TEST_DATABASE_URL;
const scope = { appId: "learning", environment: "test", tenantId: "first" };
const access = { scope, actor: "reviewer", principal: "server-session" };
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
const record: LearningRecord = {
  id: "record",
  scope,
  revision: 0,
  question: "Could checkout be shorter?",
  desiredOutcome: "Less friction",
  facts: ["81 checkout observations"],
  hypotheses: [
    { text: "Shorter checkout helps", state: "inconclusive", supportRefs: [], limitations: "" },
  ],
  evidenceRefs: [],
  nextActions: ["Collect a longer observation window"],
  owner: "owner",
  status: "draft",
  tags: { action: ["checkout"], target: [], metric: ["conversion"] },
};
describe.skipIf(!url)("PostgresLearningRepository", () => {
  let first: ExplorerPgDatabase & { end(): Promise<void> };
  let second: typeof first;
  let repository: PostgresLearningRepository;
  let other: PostgresLearningRepository;
  let registry: LearningRegistry;
  let pg: { Pool: new (options: unknown) => typeof first };
  const schema = `learning_test_${process.pid}_${Date.now()}`;
  beforeAll(async () => {
    pg = createRequire(
      new URL("../../../../examples/customer-explorer/package.json", import.meta.url),
    )("pg") as typeof pg;
    const setup = new pg.Pool({ connectionString: url });
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.end();
    first = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    second = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await first.query(
      await readFile(
        new URL("../../migrations/0002_learning_registry.up.sql", import.meta.url),
        "utf8",
      ),
    );
    repository = new PostgresLearningRepository(first);
    other = new PostgresLearningRepository(second);
    registry = service(repository);
  });
  function service(repo: PostgresLearningRepository): LearningRegistry {
    return new LearningRegistry(repo, {
      authorize: async () => true,
      fields: async () => fields,
      assertSafe: async () => {},
    });
  }
  function save(reg: LearningRegistry, value: LearningRecord, key: string) {
    return reg.save(
      {
        record: value,
        expectedRevision: value.revision,
        reason: "Synthetic review",
        idempotencyKey: key,
      },
      access,
    );
  }
  afterAll(async () => {
    if (first) await first.query(`DROP SCHEMA "${schema}" CASCADE`);
    await Promise.all([first?.end(), second?.end()]);
  });
  it("migrates an empty database and atomically handles duplicate creates and two-connection stale edits", async () => {
    const duplicates = await Promise.all([
      save(registry, record, "create"),
      save(service(other), record, "create"),
    ]);
    expect(duplicates.map((result) => result.revision)).toEqual([1, 1]);
    expect(await other.history(scope, record.id, undefined, 20)).toHaveLength(1);
    const commands = await Promise.allSettled([
      save(registry, { ...record, revision: 1, facts: ["Left observes 81 attempts"] }, "left"),
      save(
        service(other),
        { ...record, revision: 1, facts: ["Right observes 92 attempts"] },
        "right",
      ),
    ]);
    expect(commands.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(commands.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "learning-registry/revision-conflict" },
    });
    const current = await other.read(scope, record.id);
    expect(current?.revision).toBe(2);
    expect(
      (await other.history(scope, record.id, undefined, 20)).map((item) => item.record.revision),
    ).toEqual([2, 1]);
    await expect(
      save(registry, { ...record, question: "Conflicting retry" }, "create"),
    ).rejects.toMatchObject({ code: "learning-registry/idempotency-conflict" });
    expect((await save(registry, record, "create")).revision).toBe(1);
    expect(await other.read({ ...scope, tenantId: "second" }, record.id)).toBeUndefined();
    expect(await other.page({ ...scope, tenantId: "second" }, undefined, 20)).toEqual([]);
  });
  it("rolls back record, history and receipt when a history insert fails, then safely retries", async () => {
    await first.query(
      `ALTER TABLE croco_learning_history ADD CONSTRAINT reject_failure_record CHECK (id <> 'partial-failure')`,
    );
    const candidate = { ...record, id: "partial-failure" };
    await expect(save(registry, candidate, "failure")).rejects.toThrow();
    expect(await other.read(scope, candidate.id)).toBeUndefined();
    expect(await other.history(scope, candidate.id, undefined, 20)).toEqual([]);
    const receipts = await other.page(scope, undefined, 20);
    expect(receipts.some((row) => row.id === candidate.id)).toBe(false);
    await first.query("ALTER TABLE croco_learning_history DROP CONSTRAINT reject_failure_record");
    expect((await save(registry, candidate, "failure")).revision).toBe(1);
    await first.query(
      `ALTER TABLE croco_learning_history ADD CONSTRAINT reject_review CHECK ((payload->>'status') <> 'reviewed')`,
    );
    const reviewed = { ...candidate, revision: 1, status: "reviewed" as const };
    await expect(save(registry, reviewed, "review-failure")).rejects.toMatchObject({
      code: "learning-registry/storage-failed",
      status: 500,
    });
    expect((await other.read(scope, candidate.id))?.status).toBe("draft");
    expect((await other.read(scope, candidate.id))?.revision).toBe(1);
    expect(await other.history(scope, candidate.id, undefined, 20)).toHaveLength(1);
    await first.query("ALTER TABLE croco_learning_history DROP CONSTRAINT reject_review");
    expect((await save(registry, reviewed, "review-failure")).revision).toBe(2);
  });
  it("retains revisions and receipts after all connections and the service restart", async () => {
    const before = await repository.read(scope, record.id);
    await Promise.all([first.end(), second.end()]);
    await expect(registry.read(scope, record.id, access)).rejects.toMatchObject({
      code: "learning-registry/storage-failed",
      status: 500,
    });
    await expect(save(registry, { ...record, revision: 2 }, "closed-pool")).rejects.toMatchObject({
      code: "learning-registry/storage-failed",
      status: 500,
    });
    first = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    second = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    repository = new PostgresLearningRepository(first);
    other = new PostgresLearningRepository(second);
    registry = service(repository);
    expect(await other.read(scope, record.id)).toEqual(before);
    expect((await save(registry, record, "create")).revision).toBe(1);
    expect(await registry.history(scope, record.id, access)).toHaveLength(2);
    const denied = new LearningRegistry(repository, {
      authorize: async () => false,
      fields: async () => fields,
      assertSafe: async () => {},
    });
    await expect(denied.search(scope, {}, access)).rejects.toBeInstanceOf(LearningRegistryProblem);
  });
  it("enforces server-derived transition rights in the same atomic persistence path", async () => {
    const assistant = new LearningRegistry(repository, {
      authorize: async (_access, permission) => permission !== "transition",
      fields: async () => fields,
      assertSafe: async () => {},
    });
    const draft = { ...record, id: "draft-only-writer", hypotheses: [] };
    expect((await save(assistant, draft, "draft-create")).revision).toBe(1);
    await expect(
      save(assistant, { ...draft, revision: 1, status: "reviewed" }, "unauthorized-review"),
    ).rejects.toMatchObject({ code: "learning-registry/denied" });
    expect((await other.read(scope, draft.id))?.status).toBe("draft");
    expect(await other.history(scope, draft.id, undefined, 20)).toHaveLength(1);
    await save(registry, { ...draft, revision: 1, status: "reviewed" }, "review");
    const archive = { ...draft, revision: 2, status: "archived" as const };
    await expect(
      save(registry, { ...archive, facts: ["Unreviewed replacement"] }, "archive"),
    ).rejects.toMatchObject({ code: "learning-registry/transition" });
    expect((await other.read(scope, draft.id))?.revision).toBe(2);
    expect((await other.read(scope, draft.id))?.facts).toEqual(draft.facts);
    expect(await other.history(scope, draft.id, undefined, 20)).toHaveLength(2);
    // A rejected command leaves no receipt: the corrected command may reuse its key.
    expect((await save(registry, archive, "archive")).revision).toBe(3);
    expect((await other.read(scope, draft.id))?.status).toBe("archived");
    expect(
      (
        await save(
          registry,
          { ...archive, revision: 3, status: "draft", facts: ["Reopened"] },
          "reopen",
        )
      ).revision,
    ).toBe(4);
  });
});

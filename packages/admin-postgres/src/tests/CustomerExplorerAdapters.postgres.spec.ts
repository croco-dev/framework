import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCustomerExplorerSample } from "@croco/admin-core";
import type { ExplorerNote, Sample } from "@croco/admin-core";
import {
  PostgresCustomerExplorerRepository,
  PostgresTimelineSource,
} from "../libs/CustomerExplorerAdapters";
import type { ExplorerPgDatabase } from "../libs/CustomerExplorerAdapters";

const url = process.env.CUSTOMER_EXPLORER_TEST_DATABASE_URL;
const scope = { appId: "app", environment: "test", tenantId: "one" };
const subject = { kind: "customer", id: "synthetic" };
const now = "2026-01-01T00:00:00.000Z";
const expiry = "2026-01-02T00:00:00.000Z";
describe.skipIf(!url)("customer explorer PostgreSQL", () => {
  let first: ExplorerPgDatabase & { end(): Promise<void> };
  let second: ExplorerPgDatabase & { end(): Promise<void> };
  let repository: PostgresCustomerExplorerRepository;
  let otherRepository: PostgresCustomerExplorerRepository;
  let sample: Sample;
  const schema = `explorer_test_${process.pid}_${Date.now()}`;
  beforeAll(async () => {
    const require = createRequire(
      new URL("../../../../examples/cohort-builder/package.json", import.meta.url),
    );
    const pg = require("pg") as { Pool: new (options: unknown) => typeof first };
    const setup = new pg.Pool({ connectionString: url });
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.end();
    first = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    second = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await first.query(
      await readFile(
        new URL("../../migrations/0001_customer_explorer.up.sql", import.meta.url),
        "utf8",
      ),
    );
    repository = new PostgresCustomerExplorerRepository(first);
    otherRepository = new PostgresCustomerExplorerRepository(second);
    sample = await createCustomerExplorerSample(
      {
        scope,
        seed: "fixed",
        populationSnapshotId: "snapshot",
        targetDefinition: { id: "goal", revision: 1, description: "synthetic" },
        window: { beforeMs: 1000, afterMs: 1000 },
      },
      { scope, snapshotId: "snapshot", achievers: [{ subject, anchorAt: now }], comparisons: [] },
      { id: "sample", actor: "operator", createdAt: now, expiresAt: expiry },
    );
  });
  afterAll(async () => {
    if (first) await first.query(`DROP SCHEMA "${schema}" CASCADE`);
    await Promise.all([first?.end(), second?.end()]);
  });
  it("persists scoped samples and enforces immutable snapshot digests across connections", async () => {
    await repository.createSample(sample);
    expect(await otherRepository.getSample(scope, sample.id, now)).toEqual(sample);
    await expect(
      otherRepository.createSample({ ...sample, id: "other-sample", populationDigest: "changed" }),
    ).rejects.toThrow();
    expect(
      await repository.getSample({ ...scope, appId: "other" }, sample.id, now),
    ).toBeUndefined();
    expect(await repository.getSample(scope, sample.id, expiry)).toBeUndefined();
  });
  it("atomically compares revisions and audits only committed edits from two pools", async () => {
    const note: ExplorerNote = {
      id: "note",
      sampleId: sample.id,
      scope,
      subject,
      kind: "hypothesis",
      eventRefs: [],
      text: "synthetic",
      author: "operator",
      revision: 1,
      updatedAt: now,
      expiresAt: expiry,
    };
    const creates = await Promise.allSettled([
      repository.saveNote(note, 0),
      otherRepository.saveNote(note, 0),
    ]);
    expect(creates.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const edits = await Promise.allSettled([
      repository.saveNote({ ...note, revision: 2, text: "left" }, 1),
      otherRepository.saveNote({ ...note, revision: 2, text: "right" }, 1),
    ]);
    expect(edits.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await repository.listNoteAudit(scope, sample.id)).toHaveLength(2);
    await expect(
      repository.deleteNote(scope, sample.id, note.id, 1, "operator", now),
    ).rejects.toThrow();
    await repository.deleteNote(scope, sample.id, note.id, 2, "operator", now);
    expect(await repository.listNoteAudit(scope, sample.id)).toHaveLength(3);
    expect(await repository.listNotes(scope, sample.id, now)).toEqual([]);
    await repository.saveNote({ ...note, id: "cascade" }, 0);
    await repository.deleteSample({ ...scope, tenantId: "other" }, sample.id);
    expect(await repository.listNotes(scope, sample.id, now)).toHaveLength(1);
    await repository.deleteSample(scope, sample.id);
    expect(await repository.listNotes(scope, sample.id, now)).toEqual([]);
    expect(await repository.listNoteAudit(scope, sample.id)).toEqual([]);
    await repository.createSample({ ...sample, id: "expiring" });
    expect(await repository.purgeExpired({ ...scope, environment: "other" }, expiry)).toBe(0);
    expect(await repository.purgeExpired(scope, expiry)).toBe(1);
  });
  it("retains erased deletion tombstones to prevent stale writer ABA until sample purge", async () => {
    const sampleId = "aba-sample";
    await repository.createSample({ ...sample, id: sampleId });
    const note: ExplorerNote = {
      id: "aba",
      sampleId,
      scope,
      subject,
      kind: "hypothesis",
      eventRefs: [],
      text: "erase this note",
      author: "operator",
      revision: 1,
      updatedAt: now,
      expiresAt: expiry,
    };
    await repository.saveNote(note, 0);
    await otherRepository.deleteNote(scope, sampleId, note.id, 1, "operator", now);
    await expect(repository.saveNote(note, 0)).rejects.toThrow();
    await expect(
      repository.saveNote({ ...note, revision: 2, text: "stale writer" }, 1),
    ).rejects.toThrow();
    expect(await repository.listNotes(scope, sampleId, now)).toEqual([]);
    expect(await repository.listNoteAudit(scope, sampleId)).toMatchObject([
      { action: "save", revision: 1 },
      { action: "delete", revision: 2 },
    ]);
    const tombstone = await first.query(
      "SELECT revision,payload,deleted_at FROM croco_explorer_notes WHERE sample_id=$1",
      [sampleId],
    );
    expect(tombstone.rows).toMatchObject([{ revision: 2, payload: {}, deleted_at: new Date(now) }]);
    expect(await repository.purgeExpired(scope, expiry)).toBe(1);
    expect(
      (await first.query("SELECT id FROM croco_explorer_notes WHERE sample_id=$1", [sampleId]))
        .rows,
    ).toEqual([]);
    expect(await repository.listNoteAudit(scope, sampleId)).toEqual([]);
  });
  it("reads 1000 live normalized rows through scoped keyset pages and observes source deletion", async () => {
    await first.query(
      "CREATE TABLE source_events (app_id text,environment text,tenant_id text,subject_kind text,subject_id text,event_id text,occurred_at timestamptz,observed_at timestamptz,kind text,properties jsonb)",
    );
    await first.query(
      "INSERT INTO source_events SELECT 'app','test','one','customer','synthetic',lpad(n::text,4,'0'),$1::timestamptz+n*interval '1 microsecond',$1::timestamptz,'view','{}'::jsonb FROM generate_series(1,1000) n",
      [now],
    );
    await first.query(
      "INSERT INTO source_events SELECT 'other','test','one','customer','synthetic','foreign',$1,$1,'view','{}'",
      [now],
    );
    const source = new PostgresTimelineSource({
      id: "events",
      executor: first,
      mapping: {
        table: "source_events",
        appId: "app_id",
        environment: "environment",
        tenantId: "tenant_id",
        subjectKind: "subject_kind",
        subjectId: "subject_id",
        eventId: "event_id",
        occurredAt: "occurred_at",
        observedAt: "observed_at",
        kind: "kind",
        safeProperties: "properties",
      },
      status: async () => "delayed",
    });
    const request = { scope, subject, from: now, to: expiry, limit: 73 };
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await source.read({ ...request, ...(cursor ? { cursor } : {}) });
      expect(page.status).toBe("delayed");
      expect(page.items.length).toBeLessThanOrEqual(73);
      ids.push(...page.items.map((item) => item.eventId));
      cursor = page.nextCursor;
    } while (cursor);
    const tiedIds = ["é", "z", "A", "a", "!", "Z", "한"];
    for (const eventId of tiedIds)
      await first.query(
        "INSERT INTO source_events VALUES ('app','test','one','customer','ties',$1,$2,$2,'view','{}')",
        [eventId, now],
      );
    const tiedRequest = { ...request, subject: { ...subject, id: "ties" }, limit: 2 };
    const tiedRead: string[] = [];
    let tiedCursor: string | undefined;
    do {
      const page = await source.read({
        ...tiedRequest,
        ...(tiedCursor ? { cursor: tiedCursor } : {}),
      });
      tiedRead.push(...page.items.map((item) => item.eventId));
      tiedCursor = page.nextCursor;
    } while (tiedCursor);
    expect(tiedRead).toEqual([...tiedIds].sort());
    const earlier = "2026-01-01T00:00:00.000100Z";
    const later = "2026-01-01T00:00:00.000900Z";
    await first.query(
      "INSERT INTO source_events VALUES ('app','test','one','customer','precise','a-later',$1,$1,'view','{}'), ('app','test','one','customer','precise','z-earlier',$2,$2,'view','{}')",
      [later, earlier],
    );
    const preciseSubject = { ...subject, id: "precise" };
    const preciseRequest = { ...request, subject: preciseSubject, limit: 1 };
    const firstPrecise = await source.read(preciseRequest);
    const secondPrecise = await source.read({ ...preciseRequest, cursor: firstPrecise.nextCursor });
    expect(firstPrecise.items).toMatchObject([
      { eventId: "z-earlier", occurredAt: earlier, observedAt: earlier },
    ]);
    expect(secondPrecise.items).toMatchObject([
      { eventId: "a-later", occurredAt: later, observedAt: later },
    ]);
    expect(secondPrecise.nextCursor).toBeUndefined();
    expect(await source.resolve(scope, preciseSubject, "z-earlier")).toMatchObject({
      occurredAt: earlier,
      observedAt: earlier,
    });
    expect(ids).toHaveLength(1000);
    expect(new Set(ids).size).toBe(1000);
    expect(await source.resolve(scope, subject, "0001")).toBeDefined();
    await first.query("DELETE FROM source_events WHERE event_id=$1", ["0001"]);
    expect(await source.resolve(scope, subject, "0001")).toBeUndefined();
    expect(
      await source.resolve({ ...scope, environment: "other" }, subject, "0002"),
    ).toBeUndefined();
  });
});

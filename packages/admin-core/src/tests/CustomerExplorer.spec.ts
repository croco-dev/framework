import { describe, expect, it, vi } from "vitest";
import {
  CustomerExplorerProblem,
  CustomerExplorerService,
  createCustomerExplorerSample,
} from "../libs/CustomerExplorer";
import type {
  CustomerExplorerRepository,
  ExplorerNote,
  ExplorerPopulation,
  Sample,
  SampleQuery,
  TimelineItem,
  TimelineSource,
} from "../libs/CustomerExplorer";

const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const now = "2026-10-05T00:00:00.000Z";
const expiresAt = "2026-10-06T00:00:00.000Z";
const query: SampleQuery = {
  scope,
  seed: "seed",
  populationSnapshotId: "snapshot",
  targetDefinition: { id: "purchase", revision: 1, description: "Paid" },
  window: { beforeMs: 60000, afterMs: 60000 },
};
const population: ExplorerPopulation = {
  scope,
  snapshotId: "snapshot",
  achievers: Array.from({ length: 20 }, (_, i) => ({
    subject: { kind: "customer", id: String(i) },
    anchorAt: now,
  })),
  comparisons: Array.from({ length: 10 }, (_, i) => ({
    subject: { kind: "customer", id: `comparison-${i}` },
    anchorAt: now,
  })),
};
const metadata = { id: "sample", actor: "operator", createdAt: now, expiresAt };
function repository(sample: Sample): CustomerExplorerRepository {
  const notes = new Map<string, ExplorerNote>();
  return {
    createSample: vi.fn(async () => {}),
    getSample: vi.fn(async () => sample),
    deleteSample: vi.fn(async () => {}),
    listNotes: vi.fn(async () => [...notes.values()]),
    saveNote: vi.fn(async (note, revision) => {
      if ((notes.get(note.id)?.revision ?? 0) !== revision)
        throw new CustomerExplorerProblem("revision-conflict", "Stale note");
      notes.set(note.id, structuredClone(note));
    }),
    deleteNote: vi.fn(async (_scope, _sample, id, revision) => {
      if (notes.get(id)?.revision !== revision)
        throw new CustomerExplorerProblem("revision-conflict", "Stale note");
      notes.delete(id);
    }),
    listNoteAudit: vi.fn(async () => []),
  };
}
async function fixture() {
  const sample = await createCustomerExplorerSample(query, population, metadata);
  const subject = sample.sampledSubjects[0]!.subject;
  const row: TimelineItem = {
    source: "events",
    eventId: "same",
    occurredAt: now,
    observedAt: now,
    kind: "payment.confirmed",
    subject,
    safeProperties: {
      email: "private@example.com",
      amount: 100,
      message: "Contact private@example.com or +1 212 555 1234",
      raw: "secret",
    },
    completeness: "complete",
  };
  const source: TimelineSource = {
    id: "events",
    read: vi.fn<TimelineSource["read"]>(async () => ({
      items: [row],
      status: "complete",
      truncated: false,
    })),
    resolve: vi.fn(async () => row),
  };
  const repo = repository(sample);
  const authorize = vi.fn(async () => true);
  const service = new CustomerExplorerService({
    repository: repo,
    sources: [source],
    authorization: { actor: "server-actor", authorize },
    allowedProperties: { events: ["email", "amount", "message", "raw"] },
    now: () => now,
    maxRetentionMs: 86400000,
  });
  return { sample, subject, row, source, repo, authorize, service };
}
describe("CustomerExplorer", () => {
  it("samples deterministically across population order and persists fixed definition and anchor", async () => {
    const a = await createCustomerExplorerSample(query, population, metadata);
    const b = await createCustomerExplorerSample(
      query,
      {
        ...population,
        achievers: [...population.achievers].reverse(),
        comparisons: [...population.comparisons].reverse(),
      },
      metadata,
    );
    expect(a).toEqual(b);
    expect(a.sampledSubjects.filter((s) => s.group === "achiever")).toHaveLength(10);
    expect(a.sampledSubjects.filter((s) => s.group === "comparison")).toHaveLength(5);
    expect(a.excludedN).toBe(15);
    const c = await createCustomerExplorerSample(
      { ...query, populationSnapshotId: "next" },
      { ...population, snapshotId: "next" },
      metadata,
    );
    expect(c.populationSnapshotId).toBe("next");
    expect(c.sampledSubjects).not.toEqual(a.sampledSubjects);
  });
  it("rejects omitted tenant, duplicate population, excessive sample/window and retention", async () => {
    await expect(
      createCustomerExplorerSample(
        { ...query, scope: { ...scope, tenantId: "" } },
        population,
        metadata,
      ),
    ).rejects.toMatchObject({ code: "customer-explorer/input" });
    await expect(
      createCustomerExplorerSample(
        query,
        { ...population, comparisons: population.achievers },
        metadata,
      ),
    ).rejects.toThrow(CustomerExplorerProblem);
    await expect(
      createCustomerExplorerSample({ ...query, achieverCount: 101 }, population, metadata),
    ).rejects.toThrow(CustomerExplorerProblem);
    const { service } = await fixture();
    await expect(
      service.sample(query, population, { id: "new", expiresAt: "2027-01-01T00:00:00Z" }),
    ).rejects.toThrow(CustomerExplorerProblem);
  });
  it("paginates independently per subject even when the first has over 1000 rows", async () => {
    const { service, source, sample, subject, row } = await fixture();
    const rows = [
      ...Array.from({ length: 1001 }, (_, index) => ({ ...row, eventId: String(index) })),
      { ...row, eventId: "later", subject: sample.sampledSubjects[1]!.subject },
    ];
    source.read = vi.fn<TimelineSource["read"]>(async (request) => {
      const selected = rows.filter((item) => item.subject.id === request.subject.id);
      return {
        items: selected.slice(0, request.limit),
        status: selected.length > request.limit ? "partial" : "complete",
        truncated: selected.length > request.limit,
        ...(selected.length > request.limit ? { nextCursor: "page-2" } : {}),
      };
    });
    const first = await service.timeline(scope, sample.id, subject, { limit: 20 });
    expect(first.sources[0]).toMatchObject({ status: "partial", truncated: true });
    expect(first.nextCursors).toEqual({ events: "page-2" });
    const later = sample.sampledSubjects[1]!.subject;
    const page = await service.timeline(scope, sample.id, later, { limit: 20 });
    expect(source.read).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: later, limit: 20 }),
    );
    expect(page.items[0]?.subject).toEqual(later);
    expect(page.sources[0]).toMatchObject({ status: "complete", truncated: false });
  });
  it("orders equal times by source/event without combining equal event IDs, and masks at API", async () => {
    const { sample, row, repo, source } = await fixture();
    const other: TimelineSource = {
      id: "communication",
      read: async () => ({
        items: [{ ...row, source: "communication", kind: "message.clicked" }],
        status: "delayed",
        truncated: false,
      }),
      resolve: async () => undefined,
    };
    const service = new CustomerExplorerService({
      repository: repo,
      sources: [source, other],
      authorization: { actor: "operator", authorize: async () => true },
      allowedProperties: { events: ["amount", "email", "message", "raw"] },
      now: () => now,
      maxRetentionMs: 86400000,
    });
    const page = await service.timeline(scope, sample.id, row.subject);
    expect(page.items.map((item) => item.source)).toEqual(["communication", "events"]);
    expect(page.items[1]?.safeProperties).toEqual({
      amount: 100,
      message: "Contact [redacted] or [redacted]",
    });
    expect(page.items[1]?.phase).toBe("anchor");
  });
  it("preserves microsecond chronology and phases independently of reversed event IDs", async () => {
    const { service, sample, source, subject, row, repo } = await fixture();
    const early = { ...row, eventId: "z-earlier", occurredAt: "2026-10-05T00:00:00.000100Z" };
    const late = { ...row, eventId: "a-later", occurredAt: "2026-10-05T00:00:00.000900Z" };
    source.read = async () => ({ items: [late, early], status: "complete", truncated: false });
    const page = await service.timeline(scope, sample.id, subject);
    expect(page.items.map((item) => [item.eventId, item.phase, item.relativeMs])).toEqual([
      ["z-earlier", "after", 0.1],
      ["a-later", "after", 0.9],
    ]);
    vi.mocked(repo.getSample).mockResolvedValue({
      ...sample,
      sampledSubjects: sample.sampledSubjects.map((candidate) => ({
        ...candidate,
        anchorAt: "2026-10-05T00:00:00.000500Z",
      })),
    });
    const anchored = await service.timeline(scope, sample.id, subject);
    expect(anchored.items.map((item) => [item.phase, item.relativeMs])).toEqual([
      ["before", -0.4],
      ["after", 0.4],
    ]);
    source.read = vi.fn<TimelineSource["read"]>(async () => ({
      items: [],
      status: "complete",
      truncated: false,
    }));
    await service.timeline(scope, sample.id, subject);
    expect(source.read).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-10-04T23:59:00.000500Z",
        to: "2026-10-05T00:01:00.000500Z",
      }),
    );
  });
  it("rejects malformed and unsupported timestamp precision", async () => {
    for (const anchorAt of [
      "2026-02-30T00:00:00Z",
      "2026-10-05T00:00:00.0000001Z",
      "2026-10-05T00:00:00.000000001Z",
      "2026-10-05T00:00:00.0000000001Z",
      "2026-10-05T00:00:00",
      "not-a-date",
    ]) {
      await expect(
        createCustomerExplorerSample(
          query,
          { ...population, achievers: [{ ...population.achievers[0]!, anchorAt }] },
          metadata,
        ),
      ).rejects.toMatchObject({ code: "customer-explorer/input" });
    }
  });
  it("preserves source failure and denied states and rejects cross-subject source rows", async () => {
    const { service, sample, source, subject, row } = await fixture();
    source.read = async () => {
      throw new CustomerExplorerProblem("denied", "denied");
    };
    expect((await service.timeline(scope, sample.id, subject)).sources[0]?.status).toBe("denied");
    source.read = async () => ({
      items: [{ ...row, subject: { kind: "customer", id: "other" } }],
      status: "complete",
      truncated: false,
    });
    expect((await service.timeline(scope, sample.id, subject)).sources[0]?.status).toBe("failed");
    await expect(
      service.timeline(scope, sample.id, subject, { cursors: { unknown: "cursor" } }),
    ).rejects.toThrow(CustomerExplorerProblem);
  });
  it("rejects malformed known-source cursors and exposes invalid source pages as failed", async () => {
    const { service, sample, source, subject } = await fixture();
    source.read = async () => {
      throw new CustomerExplorerProblem("input", "Invalid SQL cursor");
    };
    await expect(
      service.timeline(scope, sample.id, subject, { cursors: { events: "malformed" } }),
    ).rejects.toMatchObject({ code: "customer-explorer/input" });
    for (const page of [
      { items: [], status: "unknown", truncated: false },
      { items: [], truncated: false },
      { items: [], status: "complete", truncated: "false" },
      { items: [], status: "complete", truncated: false, nextCursor: 7 },
      { items: [], status: "complete", truncated: false, nextCursor: "" },
    ]) {
      source.read = async () => page as never;
      expect((await service.timeline(scope, sample.id, subject)).sources[0]).toEqual({
        source: "events",
        status: "failed",
        truncated: false,
      });
    }
  });
  it("checks server authorization for reads, writes and explicit export", async () => {
    const { service, sample, authorize, subject } = await fixture();
    authorize.mockResolvedValue(false);
    await expect(service.getSample(scope, sample.id)).rejects.toMatchObject({
      code: "customer-explorer/denied",
    });
    await expect(service.deleteSample(scope, sample.id)).rejects.toMatchObject({
      code: "customer-explorer/denied",
    });
    await expect(service.exportDraft(scope, sample.id, [])).rejects.toMatchObject({
      code: "customer-explorer/denied",
    });
    expect(authorize.mock.calls).toEqual([
      [scope, "read"],
      [scope, "write"],
      [scope, "export"],
    ]);
    await expect(service.timeline(scope, sample.id, subject)).rejects.toThrow(
      CustomerExplorerProblem,
    );
  });
  it("retains actor/revision CAS, reloads notes, and resolves deleted evidence as unavailable", async () => {
    const { service, sample, subject, source } = await fixture();
    const input = {
      id: "note",
      subject,
      kind: "fact" as const,
      eventRefs: [{ source: source.id, eventId: "same", subject }],
      text: "Observed confirmation private@example.com",
      expectedRevision: 0,
    };
    const note = await service.saveNote(scope, sample.id, input);
    expect(note).toMatchObject({
      author: "server-actor",
      revision: 1,
      expiresAt,
      text: "Observed confirmation [redacted]",
    });
    await expect(service.saveNote(scope, sample.id, input)).rejects.toMatchObject({
      code: "customer-explorer/revision-conflict",
    });
    expect((await service.notes(scope, sample.id))[0]?.references[0]?.status).toBe("available");
    source.resolve = async () => undefined;
    expect((await service.notes(scope, sample.id))[0]?.references[0]?.status).toBe("unavailable");
    const edited = await service.saveNote(scope, sample.id, {
      ...input,
      text: "Revised observation",
      expectedRevision: 1,
    });
    expect(edited.eventRefs).toEqual(input.eventRefs);
    expect((await service.notes(scope, sample.id))[0]?.references[0]?.status).toBe("unavailable");
    await expect(
      service.saveNote(scope, sample.id, {
        ...input,
        expectedRevision: 2,
        eventRefs: [{ ...input.eventRefs[0]!, eventId: "fabricated" }],
      }),
    ).rejects.toMatchObject({ code: "customer-explorer/input" });
    await expect(
      service.saveNote(scope, sample.id, {
        ...input,
        expectedRevision: 2,
        subject: sample.sampledSubjects[1]!.subject,
        eventRefs: [],
      }),
    ).rejects.toMatchObject({ code: "customer-explorer/input" });
    await service.deleteNote(scope, sample.id, note.id, 2);
    expect(await service.notes(scope, sample.id)).toEqual([]);
  });
  it("preserves malformed reference input errors and reports provider resolution failures", async () => {
    const { service, sample, subject, source } = await fixture();
    const input = {
      id: "note",
      subject,
      kind: "fact" as const,
      eventRefs: [{ source: source.id, eventId: "invalid-json", subject }],
      text: "Observation",
      expectedRevision: 0,
    };
    source.resolve = async () => {
      throw new CustomerExplorerProblem("input", "Malformed event reference");
    };
    await expect(service.saveNote(scope, sample.id, input)).rejects.toMatchObject({
      code: "customer-explorer/input",
    });
    source.resolve = async () => {
      throw new Error("Provider unavailable");
    };
    await expect(service.saveNote(scope, sample.id, input)).rejects.toMatchObject({
      code: "customer-explorer/source-failed",
    });
  });
  it("returns stable input problems for malformed server requests", async () => {
    const { service, sample, subject } = await fixture();
    const malformed = (value: unknown) => value as never;
    const calls = [
      () => createCustomerExplorerSample(malformed(null), population, metadata),
      () =>
        createCustomerExplorerSample(
          query,
          malformed({ ...population, achievers: null }),
          metadata,
        ),
      () =>
        createCustomerExplorerSample(
          malformed({ ...query, targetDefinition: null }),
          population,
          metadata,
        ),
      () => service.sample(malformed(null), population, metadata),
      () => service.timeline(scope, sample.id, malformed({ kind: 7, id: "id" })),
      () => service.timeline(scope, sample.id, subject, malformed(null)),
      () => service.saveNote(scope, sample.id, malformed(null)),
      () =>
        service.saveNote(
          scope,
          sample.id,
          malformed({
            id: "note",
            subject,
            kind: "fact",
            text: "text",
            expectedRevision: 0,
            eventRefs: null,
          }),
        ),
      () =>
        service.saveNote(
          scope,
          sample.id,
          malformed({
            id: "note",
            subject,
            kind: "fact",
            text: "text",
            expectedRevision: 0,
            eventRefs: [null],
          }),
        ),
      () => service.exportDraft(scope, sample.id, malformed(null)),
      () => service.exportDraft(scope, sample.id, malformed([null])),
      () =>
        service.exportDraft(
          scope,
          sample.id,
          malformed([{ kind: 2, source: "events", phase: "anchor" }]),
        ),
    ];
    for (const call of calls)
      await expect(call()).rejects.toMatchObject({ code: "customer-explorer/input" });
  });
  it("refuses expired and cross-scope persisted samples", async () => {
    const { service, repo, sample } = await fixture();
    vi.mocked(repo.getSample).mockResolvedValue({ ...sample, expiresAt: now });
    await expect(service.getSample(scope, sample.id)).rejects.toMatchObject({
      code: "customer-explorer/not-found",
    });
    vi.mocked(repo.getSample).mockResolvedValue({
      ...sample,
      scope: { ...scope, tenantId: "other" },
    });
    await expect(service.getSample(scope, sample.id)).rejects.toMatchObject({
      code: "customer-explorer/not-found",
    });
  });
});

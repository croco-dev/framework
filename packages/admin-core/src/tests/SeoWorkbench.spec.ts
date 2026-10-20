import { describe, expect, it, vi } from "vitest";
import { SeoComparisonProblem } from "@croco/metrics-core";
import { createSeoWorkbench } from "../libs/SeoWorkbench";
import {
  createSeoFixture,
  seoDefinition,
  seoScope,
  seoFixtureInput,
} from "../../../../examples/seo-workbench/src/fixture";

describe("SeoWorkbench", () => {
  it("returns the denied code when read permission is absent", async () => {
    const fixture = createSeoFixture();
    fixture.setAccess({ scope: seoScope, permissions: [] });
    expect(await fixture.operations.read(seoDefinition)).toEqual({
      kind: "denied",
      code: "SEO_DENIED",
    });
  });
  it("classifies an invalid definition separately from source validation", async () => {
    const fixture = createSeoFixture();
    const invalid = structuredClone(seoDefinition);
    invalid.currentWindow.to = "invalid";
    expect(await fixture.operations.read(invalid)).toEqual({
      kind: "error",
      code: "SEO_INVALID_REQUEST",
    });
    const reader = vi.fn(async () => {
      throw new SeoComparisonProblem("source.metadata");
    });
    const operations = createSeoWorkbench({
      authenticate: async () => ({ scope: seoScope, permissions: ["seo.read"] }),
      reader,
      mask: (_field, value) => value,
      now: () => new Date("2026-10-20T00:00:00Z"),
      store: { read: async () => undefined, write: async () => {}, delete: async () => {} },
    });
    expect(await operations.read(invalid)).toEqual({ kind: "error", code: "SEO_INVALID_REQUEST" });
    expect(reader).not.toHaveBeenCalled();
    expect(await operations.read(seoDefinition)).toEqual({
      kind: "error",
      code: "SEO_SOURCE_ERROR",
    });
  });
  it("runs shared authorized metrics and bounds pages without losing report denominators", async () => {
    const fixture = createSeoFixture();
    const state = await fixture.operations.read(seoDefinition, 0, 1);
    expect(state.kind).toBe("ready");
    expect("page" in state).toBe(true);
    if (!("page" in state)) return;
    expect(state.page).toMatchObject({
      total: 2,
      nextOffset: 1,
      report: { population: 2, included: 2, excluded: 0 },
    });
    const next = await fixture.operations.read(seoDefinition, 1, 1);
    expect("page" in next ? next.page.rows[0].pageId : null).not.toBe(state.page.rows[0].pageId);
    expect(await fixture.operations.read(seoDefinition, -1, 101)).toMatchObject({ kind: "error" });
  });
  it("denies omitted tenant and preserves provider errors instead of normal empty", async () => {
    const f = createSeoFixture();
    f.setAccess({ scope: { ...seoScope, tenant: "" }, permissions: ["seo.read"] });
    expect(await f.operations.read(seoDefinition)).toMatchObject({ kind: "error" });
    f.setAccess({ scope: seoScope, permissions: [] });
    expect(await f.operations.read(seoDefinition)).toMatchObject({ kind: "denied" });
    f.setAccess({ scope: seoScope, permissions: ["seo.read"] });
    f.setFailure(true);
    expect(await f.operations.read(seoDefinition)).toMatchObject({ kind: "error" });
  });
  it("rechecks export/report permissions and source identity, persists definitions and enforces retention/deletion", async () => {
    const f = createSeoFixture();
    const state = await f.operations.read(seoDefinition);
    if (!("page" in state)) throw new TypeError(`Unexpected ${state.kind}`);
    const hash = state.page.report.inputHash;
    const exported = JSON.parse(await f.operations.export(seoDefinition, hash));
    expect(exported).toMatchObject({ definition: seoDefinition, inputHash: hash });
    expect(JSON.stringify(exported)).not.toContain("private=hidden");
    await f.operations.save("r1", seoDefinition, hash, "2026-10-21T00:00:00Z");
    expect(await f.operations.readSaved("r1")).toMatchObject({ kind: "ready" });
    const changed = seoFixtureInput();
    changed.current.search.rows = [];
    f.setInput(changed);
    expect(await f.operations.readSaved("r1")).toMatchObject({
      kind: "unavailable",
      code: "SEO_REPORT_STALE",
    });
    await expect(f.operations.export(seoDefinition, hash)).rejects.toMatchObject({
      reason: "stale-input",
    });
    await f.operations.delete("r1");
    expect(f.records.size).toBe(0);
    await expect(
      f.operations.save("expired", seoDefinition, hash, "2026-10-19T00:00:00Z"),
    ).rejects.toMatchObject({ reason: "retention" });
    f.setAccess({ scope: seoScope, permissions: ["seo.read"] });
    await expect(f.operations.export(seoDefinition, hash)).rejects.toMatchObject({
      reason: "denied",
    });
    await expect(f.operations.delete("r1")).rejects.toMatchObject({ reason: "denied" });
  });
  it("rejects cross-tenant source data and partial values retain explicit quality", async () => {
    const f = createSeoFixture();
    f.setAccess({ scope: { ...seoScope, tenant: "tenant-b" }, permissions: ["seo.read"] });
    expect(await f.operations.read(seoDefinition)).toMatchObject({ kind: "error" });
    f.setAccess({ scope: seoScope, permissions: ["seo.read"] });
    const input = seoFixtureInput();
    input.current.search.metadata.completeness = "partial";
    f.setInput(input);
    expect(await f.operations.read(seoDefinition)).toMatchObject({
      kind: "partial",
      page: { report: { state: "partial" } },
    });
  });
});

describe("SeoWorkbench retained evidence policies", () => {
  it("masks source URLs before returning, persisting and exporting report evidence", async () => {
    const fixture = createSeoFixture();
    const input = seoFixtureInput();
    input.mappings = input.mappings.map((mapping) => ({
      ...mapping,
      sourceRef: "https://synthetic.invalid/registry?private-source-token",
    }));
    input.changes = [
      {
        ...input.changes[0],
        sourceRef: "https://synthetic.invalid/deployment?private-source-token",
      },
    ];
    fixture.setInput(input);
    const state = await fixture.operations.read(seoDefinition);
    if (!("page" in state)) throw new TypeError(`Unexpected ${state.kind}`);
    expect(JSON.stringify(state)).not.toContain("private-source-token");
    expect(state.page.rows[0].current?.mappingRefs).toEqual(["[source]"]);
    const hash = state.page.report.inputHash;
    await fixture.operations.save("masked", seoDefinition, hash, "2026-10-21T00:00:00Z");
    expect(JSON.stringify([...fixture.records.values()])).not.toContain("private-source-token");
    expect(await fixture.operations.export(seoDefinition, hash)).not.toContain(
      "private-source-token",
    );
  });
  it("withholds expired stored reports and enforces current read permission before loading retained evidence", async () => {
    const fixture = createSeoFixture();
    const state = await fixture.operations.read(seoDefinition);
    if (!("page" in state)) throw new TypeError(`Unexpected ${state.kind}`);
    await fixture.operations.save(
      "expired",
      seoDefinition,
      state.page.report.inputHash,
      "2026-10-21T00:00:00Z",
    );
    const record = [...fixture.records.values()][0];
    expect(record).toBeDefined();
    if (record) record.expiresAt = "2026-10-19T00:00:00Z";
    expect(await fixture.operations.readSaved("expired")).toMatchObject({
      kind: "unavailable",
      code: "SEO_REPORT_EXPIRED",
    });
    fixture.setAccess({ scope: seoScope, permissions: [] });
    await expect(fixture.operations.readSaved("expired")).rejects.toMatchObject({
      reason: "denied",
    });
  });
});

describe("SeoWorkbench saved period selection", () => {
  it("loads different normalized frames, changes candidate membership and retains the selected periods", async () => {
    const fixture = createSeoFixture();
    const definition = {
      ...structuredClone(seoDefinition),
      candidate: "impressions-up-clicks-down" as const,
      minClickDecline: 0.6,
    };
    const initial = await fixture.operations.read(definition);
    expect(initial).toMatchObject({
      kind: "ready",
      page: { report: { included: 0, excluded: 2 } },
    });
    definition.baselineWindow = {
      from: "2026-09-30T07:00:00.000Z",
      to: "2026-10-01T07:00:00.000Z",
    };
    const selected = await fixture.operations.read(definition);
    expect(selected).toMatchObject({
      kind: "ready",
      page: {
        report: { included: 1, excluded: 1 },
        rows: [
          {
            pageId: "start",
            baseline: { impressions: 50, clicks: 30, sessions: 29, outcomes: 9 },
            current: { clicks: 10, sessions: 13 },
          },
        ],
      },
    });
    if (!("page" in selected)) throw new TypeError("Expected selected report");
    await fixture.operations.save(
      "periods",
      definition,
      selected.page.report.inputHash,
      "2026-10-21T00:00:00Z",
    );
    const saved = await fixture.operations.readSaved("periods");
    expect(saved).toMatchObject({
      kind: "ready",
      page: {
        report: {
          definition: {
            baselineWindow: definition.baselineWindow,
            currentWindow: definition.currentWindow,
          },
        },
      },
    });
  });
});

describe("SeoWorkbench period declaration boundary", () => {
  it("validates selected periods before invoking the host reader factory", async () => {
    const reader = vi.fn(async () => {
      throw new TypeError("Reader must not run for an invalid declaration");
    });
    const operations = createSeoWorkbench({
      authenticate: async () => ({ scope: seoScope, permissions: ["seo.read"] }),
      reader,
      mask: (_field, value) => value,
      now: () => new Date("2026-10-20T00:00:00Z"),
      store: { read: async () => undefined, write: async () => {}, delete: async () => {} },
    });
    const definition = structuredClone(seoDefinition);
    definition.currentWindow.to = "invalid";
    expect(await operations.read(definition)).toMatchObject({ kind: "error" });
    expect(reader).not.toHaveBeenCalled();
  });
});

describe("SeoWorkbench unavailable period source", () => {
  it("preserves unknown source availability instead of reporting an ordinary empty period", async () => {
    const fixture = createSeoFixture();
    const definition = structuredClone(seoDefinition);
    definition.baselineWindow = {
      from: "2026-09-29T07:00:00.000Z",
      to: "2026-09-30T07:00:00.000Z",
    };
    const state = await fixture.operations.read(definition);
    expect(state).toMatchObject({
      kind: "partial",
      page: {
        report: {
          state: "partial",
          diagnostics: expect.arrayContaining(["SEO_SOURCE_UNAVAILABLE"]),
        },
      },
    });
    if ("page" in state) expect(state.page.rows.every((row) => row.baseline === null)).toBe(true);
  });
});

describe("SeoWorkbench saved report release authority", () => {
  it.each(["permission", "scope", "abort"])(
    "rechecks %s after asynchronous definition identity validation",
    async (change) => {
      const f = createSeoFixture();
      const state = await f.operations.read(seoDefinition);
      if (!("page" in state)) throw new TypeError(`Unexpected ${state.kind}`);
      await f.operations.save(
        "identity-race",
        seoDefinition,
        state.page.report.inputHash,
        "2026-10-21T00:00:00Z",
      );
      const controller = new AbortController();
      const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      let intercepted = false;
      const digest = vi
        .spyOn(globalThis.crypto.subtle, "digest")
        .mockImplementation(async (algorithm, data) => {
          const result = await original(algorithm, data);
          const value = JSON.parse(new TextDecoder().decode(data)) as {
            id?: unknown;
            baselineWindow?: unknown;
          };
          if (!intercepted && value.id === seoDefinition.id && value.baselineWindow) {
            intercepted = true;
            if (change === "abort") controller.abort();
            else
              f.setAccess({
                scope: change === "scope" ? { ...seoScope, tenant: "other-tenant" } : seoScope,
                permissions: change === "permission" ? [] : ["seo.read"],
              });
          }
          return result;
        });
      try {
        await expect(
          f.operations.readSaved("identity-race", 0, 25, controller.signal),
        ).rejects.toMatchObject(change === "abort" ? { name: "AbortError" } : { reason: "denied" });
        expect(intercepted).toBe(true);
      } finally {
        digest.mockRestore();
      }
    },
  );
});

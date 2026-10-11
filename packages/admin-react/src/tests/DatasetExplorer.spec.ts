import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DatasetExplorer } from "../libs/DatasetExplorer";
import type { DatasetExplorerState } from "../libs/DatasetExplorer";
import type { WarehouseDataset } from "@croco/warehouse-core/runtime";

const dataset: WarehouseDataset = {
  descriptor: {
    name: "capture",
    version: 1,
    irVersion: 1,
    compilerVersion: "1",
    semanticHash: "capture-v1",
    scope: "tenant",
    kind: "transaction",
    grain: { description: "One capture", key: ["id"] },
    columns: {
      id: { type: "id", description: "Capture identifier", sensitivity: "public" },
      email: { type: "string", sensitivity: "sensitive" },
      eventAt: { type: "instant", precision: "millisecond" },
    },
    time: { event: "eventAt" },
    write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    sourceRefs: ["capture-api"],
  },
  revision: 4,
  permissionEpoch: 1,
  privacyEpoch: 1,
  head: {
    id: "published-1",
    revision: 4,
    modelVersion: "1",
    segmentRefs: ["segment-1"],
    partitionSelection: [],
    createdAt: "2026-09-27T00:00:00Z",
    permissionEpoch: 1,
    privacyEpoch: 1,
    quality: {
      freshness: { observedAt: "2026-09-27T00:00:00Z", newestEventAt: null },
      temporalCompleteness: "partial",
      populationCoverage: "unknown",
      validity: "valid",
      reproducibility: "reproducible",
      sourceCoverage: [],
    },
  },
  candidates: [
    {
      id: "failed-2",
      scope: { application: "app", environment: "test", tenant: "tenant" },
      modelVersion: "1",
      transformHash: "transform",
      sourceRefs: [],
      expectedHead: "published-1",
      fence: 1,
      state: "failed",
      quality: null,
      partitionSelection: null,
      permissionEpoch: 1,
      privacyEpoch: 1,
    },
  ],
};
const ready: Extract<DatasetExplorerState, { kind: "ready" }> = {
  kind: "ready",
  dataset,
  sampleLimit: 10,
  sample: {
    snapshotId: "published-1",
    permissionEpoch: 1,
    privacyEpoch: 1,
    rows: [{ id: "capture-1", email: "PRIVATE_EMAIL", eventAt: "2026-09-27T00:00:00Z" }],
    nextCursor: null,
    exactness: "exact",
  },
};
const render = (state: DatasetExplorerState, authorized = false) =>
  renderToStaticMarkup(
    createElement(DatasetExplorer, {
      state,
      actor: "operator",
      canRepublish: authorized,
      canRemove: authorized,
      onRepublish: vi.fn(),
      onRemove: vi.fn(),
    }),
  );

describe("DatasetExplorer", () => {
  it.each(["loading", "empty", "denied", "unavailable"] as const)(
    "renders explicit %s state",
    (kind) => {
      expect(render({ kind })).toContain(`data-state="${kind}"`);
      expect(render({ kind })).not.toContain("Apply operation");
    },
  );
  it("uses the service descriptor, distinguishes publication from failed candidates and masks sensitive samples", () => {
    const html = render(ready);
    expect(html).toContain("One capture");
    expect(html).toContain("Capture identifier");
    expect(html).toContain("Published snapshot: published-1");
    expect(html).toContain("failed candidate; last publication preserved");
    expect(html).toContain("Temporal completeness");
    expect(html).toContain("Population coverage");
    expect(html).toContain("Freshness observed");
    expect(html).toContain("capture-1");
    expect(html).toContain("Masked");
    expect(html).not.toContain("PRIVATE_EMAIL");
    expect(html).not.toContain("Apply operation");
  });
  it("does not show sample rows when snapshot or permission/privacy epochs differ", () => {
    if (!ready.sample) throw new Error("fixture needs sample");
    for (const patch of [{ snapshotId: "staging" }, { permissionEpoch: 2 }, { privacyEpoch: 2 }]) {
      const html = render({ ...ready, sample: { ...ready.sample, ...patch } });
      expect(html).toContain("Sample unavailable");
      expect(html).not.toContain("capture-1");
    }
  });
  it("rejects unbounded or oversized sample responses without rendering any row", () => {
    for (const sampleLimit of [0, 101, 0.5]) {
      const html = render({ ...ready, sampleLimit });
      expect(html).toContain("Sample unavailable");
      expect(html).not.toContain("capture-1");
    }
    if (!ready.sample) throw new Error("fixture needs sample");
    expect(
      render({
        ...ready,
        sampleLimit: 1,
        sample: { ...ready.sample, rows: [...ready.sample.rows, ...ready.sample.rows] },
      }),
    ).toContain("Sample unavailable");
  });
  it("shows audit inputs with keyboard-native controls only for authorized operators", () => {
    const html = render(ready, true);
    expect(html).toContain('aria-label="Reason"');
    expect(html).toContain('aria-label="Idempotency key"');
    expect(html).toContain("Expected revision: 4");
    expect(html).toContain("Actor: operator");
    expect(html).toContain('type="submit" disabled=""');
  });
  it("distinguishes missing publication from an empty published sample", () => {
    expect(render({ ...ready, dataset: { ...dataset, head: null }, sample: null })).toContain(
      "Completed ingestion does not publish",
    );
    if (!ready.sample) throw new Error("fixture needs sample");
    expect(render({ ...ready, sample: { ...ready.sample, rows: [] } })).toContain(
      "Published snapshot has no sample rows",
    );
  });
  it("selects only sealed canonical candidates for audited republication", () => {
    const original = dataset.candidates[0];
    if (!original) throw new Error("fixture needs candidate");
    const html = render(
      {
        ...ready,
        dataset: {
          ...dataset,
          candidates: [original, { ...original, id: "sealed-3", state: "sealed", fence: 5 }],
        },
      },
      true,
    );
    expect(html).toContain('aria-label="Sealed candidate"');
    expect(html).toContain('value="sealed-3"');
    expect(html).toContain("Fence 5");
    expect(html).not.toContain('value="failed-2"');
    expect(render(ready, true)).toContain('value="republish" disabled=""');
    expect(render(ready, true)).toContain("No sealed candidate is available");
  });
  it("does not offer stale sealed candidates after the head or epoch changes", () => {
    const original = dataset.candidates[0];
    if (!original) throw new Error("fixture needs candidate");
    const sealed = { ...original, id: "sealed-stale", state: "sealed" as const, fence: 5 };
    for (const patch of [{ head: null }, { privacyEpoch: 2 }, { revision: 5 }]) {
      const html = render(
        { ...ready, dataset: { ...dataset, ...patch, candidates: [sealed] } },
        true,
      );
      expect(html).toContain("No sealed candidate is available");
      expect(html).not.toContain('value="sealed-stale"');
    }
  });
  it("allows a sealed candidate to be selected before the first publication", () => {
    const original = dataset.candidates[0];
    if (!original) throw new Error("fixture needs candidate");
    const html = render(
      {
        ...ready,
        dataset: {
          ...dataset,
          head: null,
          candidates: [{ ...original, state: "sealed", expectedHead: null, fence: 5 }],
        },
        sample: null,
      },
      true,
    );
    expect(html).toContain('aria-label="Sealed candidate"');
    expect(html).toContain('value="remove" disabled=""');
  });
});

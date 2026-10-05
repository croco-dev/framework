import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { CustomerExplorer } from "../libs/CustomerExplorer";
import type {
  CustomerExplorerNote,
  CustomerExplorerOperations,
  CustomerExplorerProps,
} from "../libs/CustomerExplorer";
import type { ExplorerTimeline, Sample } from "@croco/admin-core";

/** Browser-only regression fixture exercising React's actual mounted lifecycle. */
export async function verifyMountedCustomerExplorer(
  container: HTMLElement,
  observe: (step: string) => Promise<void> = async () => {},
): Promise<void> {
  const scope = { appId: "fixture", environment: "test", tenantId: "tenant-a" };
  const subject = { kind: "customer", id: "customer-a" };
  const sample: Sample = {
    id: "sample",
    scope,
    seed: "fixed",
    populationSnapshotId: "snapshot",
    populationDigest: "digest",
    targetDefinition: { id: "purchase", revision: 1, description: "First purchase" },
    window: { beforeMs: 3600000, afterMs: 3600000 },
    ordering: "occurredAt/source/eventId",
    sampledSubjects: [
      { subject, anchorAt: "2026-10-01T12:00:00Z", group: "achiever" },
      {
        subject: { ...subject, id: "customer-b" },
        anchorAt: "2026-10-01T12:00:00Z",
        group: "comparison",
      },
    ],
    excludedN: 2,
    actor: "operator",
    createdAt: "2026-10-01T00:00:00Z",
    expiresAt: "2026-11-01T00:00:00Z",
  };
  const item = {
    source: "events",
    eventId: "sent",
    occurredAt: "2026-10-01T11:55:00Z",
    observedAt: "2026-10-01T11:55:00Z",
    kind: "sent",
    subject,
    safeProperties: {},
    completeness: "complete" as const,
    relativeMs: -300000,
    phase: "before" as const,
  };
  const first: ExplorerTimeline = {
    items: [item],
    sources: [{ source: "events", status: "complete", truncated: true }],
    nextCursors: { events: "page-2" },
  };
  let stored: CustomerExplorerNote[] = [];
  let conflict = false;
  let deferSubject: ((value: ExplorerTimeline) => void) | undefined;
  let blockNextSubject = false;
  let missingSourceStatus = true;
  let requestedCursor: string | undefined;
  let saveRevision: number | undefined;
  const operations: CustomerExplorerOperations = {
    getSample: async () => sample,
    timeline: async (_scope, _sample, selectedSubject, options) => {
      if (selectedSubject.id === "customer-b" && blockNextSubject)
        return new Promise((resolve) => {
          deferSubject = resolve;
        });
      requestedCursor = options.cursors?.events;
      if (requestedCursor && missingSourceStatus)
        return { items: [], sources: [], nextCursors: {} };
      if (requestedCursor)
        return {
          items: [
            {
              ...item,
              eventId: "paid",
              kind: "payment-confirmed",
              phase: "anchor",
              relativeMs: 0,
              occurredAt: "2026-10-01T12:00:00Z",
            },
            { ...item, eventId: "z-earlier", occurredAt: "2026-10-01T12:00:00.000100Z" },
            { ...item, eventId: "a-later", occurredAt: "2026-10-01T12:00:00.000900Z" },
          ],
          sources: [{ source: "events", status: "complete", truncated: false }],
          nextCursors: {},
        };
      return first;
    },
    notes: async () => stored,
    saveNote: async (_scope, _sample, input) => {
      saveRevision = input.expectedRevision;
      if (conflict) throw { code: "customer-explorer/revision-conflict" };
      const saved = {
        ...input,
        scope,
        sampleId: sample.id,
        author: "server-actor",
        revision: input.expectedRevision + 1,
        updatedAt: "2026-10-01T12:05:00Z",
        expiresAt: sample.expiresAt,
      };
      stored = [
        {
          ...saved,
          references: input.eventRefs.map((ref) => ({ ref, status: "unavailable" as const })),
        },
      ];
      return saved;
    },
    exportDraft: async (_scope, _sample, conditions) => ({
      version: 1,
      scope,
      sampleId: sample.id,
      populationSnapshotId: sample.populationSnapshotId,
      targetDefinition: sample.targetDefinition,
      window: sample.window,
      conditions,
    }),
  };
  let props: CustomerExplorerProps = { scope, sampleId: sample.id, operations };
  const root = createRoot(container);
  const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  const render = () => flushSync(() => root.render(createElement(CustomerExplorer, props)));
  async function click(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === label,
    );
    if (!button) throw new Error(`Missing button: ${label}`);
    flushSync(() => button.click());
    await settle();
  }
  function textarea(value: string) {
    const element = container.querySelector("textarea");
    if (!element) throw new Error("Missing note textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      element,
      value,
    );
    flushSync(() => element.dispatchEvent(new Event("input", { bubbles: true })));
  }
  try {
    render();
    assert(
      container.textContent?.includes("Loading saved sample"),
      "Initial loading state missing",
    );
    await settle();
    await settle();
    assert(container.querySelector('[data-state="partial"]'), "Truncated timeline must be partial");
    assert(
      container.textContent?.includes("Achievers: 1/1 viewed this session"),
      "Sample progress missing",
    );
    await observe("partial timeline and sample progress");
    await click("Load more events");
    assert(
      container.textContent?.includes("customer-explorer/source-failed"),
      "Missing source status must fail explicitly",
    );
    missingSourceStatus = false;
    await click("Load more events");
    assert(requestedCursor === "page-2", "Per-source cursor was not sent");
    assert(
      container.querySelectorAll('section[aria-label="Timeline"] ol > li').length === 4,
      "Pagination lost prior events",
    );
    const orderedEvents = [
      ...container.querySelectorAll('section[aria-label="Timeline"] input'),
    ].map((input) => input.getAttribute("aria-label"));
    assert(
      orderedEvents.indexOf("Select events/z-earlier") <
        orderedEvents.indexOf("Select events/a-later"),
      "Pagination must preserve sub-millisecond occurrence order ahead of event IDs",
    );
    assert(
      container.textContent?.includes("0.8 ms since previous loaded event"),
      "Distinct microsecond events must not be labeled simultaneous",
    );
    assert(container.querySelector('[data-state="ready"]'), "Completed page must show ready");
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!checkbox) throw new Error("Missing event checkbox");
    flushSync(() => checkbox.click());
    textarea("Message was sent before the purchase.");
    await click("Save note");
    assert(saveRevision === 0, "New notes must use expectedRevision 0");
    assert(container.textContent?.includes("server-actor"), "Actor attribution missing");
    assert(container.textContent?.includes("unavailable"), "Deleted evidence status missing");
    await click("Edit note");
    conflict = true;
    await click("Save revision");
    assert(saveRevision === 1, "Edit must preserve expected revision");
    assert(
      container.textContent?.includes("customer-explorer/revision-conflict"),
      "Revision conflict not exposed",
    );
    await observe("revision conflict preserves note for recovery");
    conflict = false;
    await click("Save revision");
    assert(container.textContent?.includes("revision 2"), "Revision recovery did not save");
    flushSync(() => container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    await click("Prepare query draft");
    const download = container.querySelector<HTMLAnchorElement>("a[download]");
    assert(download?.href.startsWith("data:application/json"), "Typed query download missing");
    assert(!container.textContent?.includes("Raw export"), "Raw export must not be default");
    blockNextSubject = true;
    await click("Next subject");
    assert(
      container.textContent?.includes("Loading subject timeline"),
      "Subject loading state missing",
    );
    await click("Previous subject");
    deferSubject?.({
      items: [{ ...item, eventId: "stale", kind: "STALE_RESPONSE" }],
      sources: [],
      nextCursors: {},
    });
    await settle();
    assert(!container.textContent?.includes("STALE_RESPONSE"), "Old subject response leaked");
    await observe("subject navigation ignores stale response");
    props = {
      ...props,
      scope: { ...scope, tenantId: "denied" },
      operations: {
        ...operations,
        getSample: async () => {
          throw { code: "customer-explorer/denied" };
        },
      },
    };
    render();
    await settle();
    assert(container.querySelector('[data-state="denied"]'), "Denied state missing");
    assert(!container.textContent?.includes("Message was sent"), "Scope change retained old note");
    await observe("denied scope hides prior records");
    props = {
      ...props,
      scope: { ...scope, tenantId: "empty" },
      operations: { ...operations, getSample: async () => ({ ...sample, sampledSubjects: [] }) },
    };
    render();
    await settle();
    assert(container.querySelector('[data-state="empty"]'), "Empty sample state missing");
    props = {
      ...props,
      scope: { ...scope, tenantId: "failed" },
      operations: {
        ...operations,
        getSample: async () => {
          throw { code: "customer-explorer/source-failed" };
        },
      },
    };
    render();
    await settle();
    assert(container.querySelector('[data-state="error"]'), "Error state missing");
    await observe(
      "PASS: loading, partial, ready, notes, pagination, stale response, denied, empty and error",
    );
  } finally {
    root.unmount();
  }
}

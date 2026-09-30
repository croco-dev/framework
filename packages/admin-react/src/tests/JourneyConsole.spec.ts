import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyConsole } from "../libs/JourneyConsole";
import type { JourneyConsoleProps } from "../libs/JourneyConsole";

const props: JourneyConsoleProps = {
  scopeKey: "tenant-app-test",
  definition: {
    id: "welcome",
    version: "1",
    entry: "wait",
    goal: { registration: "done", params: {} },
    reentry: "once",
    unknownRetryMs: 1000,
    unknownDeadlineMs: 5000,
    nodes: [
      { id: "wait", kind: "wait", durationMs: 1000, next: "condition" },
      {
        id: "condition",
        kind: "condition",
        predicate: { registration: "engaged", params: {} },
        matched: "end",
        unmatched: "end",
      },
      { id: "end", kind: "end" },
    ],
  },
  state: { kind: "empty" },
  permissions: ["journey.read", "journey.preview", "journey.operate"],
  samples: [{ id: "sample", label: "Sample account" }],
  onDryRun: vi.fn(),
  onCommand: vi.fn(),
};
describe("Journey console", () => {
  it.each([
    [{ kind: "loading" }, "Loading journeys"],
    [{ kind: "empty" }, "No active episodes"],
    [{ kind: "denied", code: "forbidden" }, "Journey access denied"],
    [{ kind: "error", code: "failed" }, "Journey unavailable: failed"],
  ] as const)("renders explicit %s state", (state, text) => {
    expect(renderToStaticMarkup(h(JourneyConsole, { ...props, state }))).toContain(text);
  });
  it("renders editable ordered condition branches and sample preview", () => {
    const markup = renderToStaticMarkup(h(JourneyConsole, props));
    for (const text of [
      "<ol>",
      "Wait milliseconds",
      "Matched branch",
      "Unmatched branch",
      "Sample account",
      "Dry run",
    ])
      expect(markup).toContain(text);
  });
  it("shows only allowed episode controls and requires an audit reason", () => {
    const markup = renderToStaticMarkup(
      h(JourneyConsole, {
        ...props,
        state: {
          kind: "ready",
          episodes: [
            {
              id: "episode",
              definitionId: "welcome",
              definitionVersion: "1",
              nodeId: "wait",
              status: "paused",
              revision: 2,
              wakeAt: null,
              reason: "operator-pause",
              safeResume: true,
              receipts: [],
            },
          ],
        },
      }),
    );
    expect(markup).toContain("Resume");
    expect(markup).toContain("Stop");
    expect(markup).not.toContain(">Pause<");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Audit reason");
  });
  it("shows action checks, their evaluation time and stable dispatch evidence", () => {
    const markup = renderToStaticMarkup(
      h(JourneyConsole, {
        ...props,
        state: {
          kind: "ready",
          episodes: [
            {
              id: "episode",
              definitionId: "welcome",
              definitionVersion: "1",
              nodeId: "send",
              status: "indeterminate",
              revision: 3,
              wakeAt: null,
              reason: "dispatch-indeterminate",
              safeResume: false,
              problemCode: "lifecycle-core/journey-provider-exception",
              receipts: [
                {
                  nodeId: "send",
                  evaluatedAt: "2026-09-29T00:01:01Z",
                  reason: "action-checks",
                  checks: {
                    goal: false,
                    consent: "unknown",
                    resource: true,
                    evaluatedAt: "2026-09-29T00:01:00Z",
                  },
                  problemCode: "lifecycle-core/journey-provider-exception",
                },
              ],
            },
          ],
        },
      }),
    );
    expect(markup).toContain("action-checks");
    expect(markup).toContain(
      "Checks at 2026-09-29T00:01:00Z: goal false, consent unknown, resource true",
    );
    expect(markup).toContain("lifecycle-core/journey-provider-exception");
    expect(markup).toContain("Safe resume: no");
    expect(markup).toContain(">Stop</button>");
    expect(markup).not.toContain(">Resume</button>");
    expect(markup).not.toContain(">Pause</button>");
  });
  it("does not show data without read permission", () => {
    expect(renderToStaticMarkup(h(JourneyConsole, { ...props, permissions: [] }))).not.toContain(
      "welcome",
    );
  });
});

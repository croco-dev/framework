import { createElement as h } from "react";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyConsole } from "../libs/JourneyConsole";
import type { JourneyConsoleProps } from "../libs/JourneyConsole";

const local = vi.hoisted(() => ({
  episode: {
    id: "episode",
    definitionId: "welcome",
    definitionVersion: "1",
    nodeId: "wait",
    status: "paused" as const,
    revision: 2,
    wakeAt: null,
    reason: "operator-pause",
    safeResume: true,
    receipts: [],
  },
}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof React>();
  return {
    ...react,
    useState: (initial: unknown) =>
      react.useState(
        initial && typeof initial === "object" && Object.keys(initial).length === 0
          ? { episode: local.episode }
          : initial,
      ),
  };
});
const props: JourneyConsoleProps = {
  scopeKey: "tenant/app/test",
  definition: {
    id: "welcome",
    version: "1",
    entry: "end",
    goal: { registration: "done", params: {} },
    reentry: "once",
    unknownRetryMs: 1000,
    unknownDeadlineMs: 5000,
    nodes: [{ id: "end", kind: "end" }],
  },
  state: { kind: "ready", episodes: [{ ...local.episode, revision: 1, status: "waiting" }] },
  permissions: ["journey.read", "journey.operate"],
  samples: [],
  onDryRun: vi.fn(),
  onCommand: vi.fn(),
};
describe("Journey console server revision precedence", () => {
  it("uses a pause result until an equal or newer server revision arrives", () => {
    const paused = renderToStaticMarkup(h(JourneyConsole, props));
    expect(paused).toContain("paused · step wait · revision 2");
    expect(paused).toContain("Resume");
    for (const revision of [2, 3]) {
      const refreshed = renderToStaticMarkup(
        h(JourneyConsole, {
          ...props,
          state: {
            kind: "ready",
            episodes: [
              {
                ...local.episode,
                revision,
                status: "exited",
                reason: "goal-achieved",
                safeResume: false,
              },
            ],
          },
        }),
      );
      expect(refreshed).toContain(`exited · step wait · revision ${revision}`);
      expect(refreshed).not.toContain("Resume");
    }
  });
});

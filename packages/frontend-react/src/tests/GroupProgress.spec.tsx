import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroupProgress } from "../libs/GroupProgress";
import type { GroupProgressView } from "../libs/GroupProgress";
import { JoinChallenge } from "../libs/JoinChallenge";

const view: GroupProgressView = {
  challenge: {
    id: "cooperate",
    version: 1,
    start: new Date("2026-01-01Z"),
    end: new Date("2026-02-01Z"),
    goal: 4,
    memberCap: 2,
    minMembers: 2,
    lateAllowanceMs: 1000,
    visibility: "aggregate",
    leavePolicy: "retain",
    state: "active",
    progress: 2,
    memberCount: 2,
  },
  self: null,
  selfProgress: 2,
  pendingEvidenceCount: 0,
};
describe("Cooperative challenge presentation", () => {
  it("preserves unknown evidence as unresolved rather than zero", () => {
    const html = renderToString(
      createElement(GroupProgress, {
        state: { kind: "ready", view: { ...view, pendingEvidenceCount: 2 } },
      }),
    );
    expect(html).toContain("evidence verification(s) unresolved");
    expect(html).toContain("Retry source verification");
    expect(html).toContain("not zero contribution");
    expect(html).toContain("blocks finalization");
  });
  it("shows own and aggregate progress with cap and finalization boundaries", () => {
    const html = renderToString(createElement(GroupProgress, { state: { kind: "ready", view } }));
    expect(html).toContain("Group total:");
    expect(html).toContain("Your contribution:");
    expect(html).toContain("Per-member cap:");
    expect(html).toContain("exclusive");
    expect(html).toContain("final only after");
    expect(html).not.toContain("subjectId");
    expect(html).not.toContain("ranking");
  });
  it.each(["loading", "empty", "denied", "error", "partial"] as const)(
    "renders %s explicitly",
    (kind) => {
      const state =
        kind === "partial"
          ? { kind, view }
          : kind === "denied" || kind === "error"
            ? { kind, message: "Unavailable evidence" }
            : { kind };
      const html = renderToString(createElement(GroupProgress, { state }));
      expect(html).toContain(
        kind === "loading"
          ? "Loading"
          : kind === "empty"
            ? "No challenge"
            : kind === "partial"
              ? "incomplete"
              : "Unavailable evidence",
      );
    },
  );
  it("does not join automatically or call sources during render", () => {
    const source = { load: vi.fn(), join: vi.fn(), leave: vi.fn() };
    const html = renderToString(createElement(JoinChallenge, { scopeKey: "subject", source }));
    expect(html).toContain("Loading challenge");
    expect(source.load).not.toHaveBeenCalled();
    expect(source.join).not.toHaveBeenCalled();
    expect(source.leave).not.toHaveBeenCalled();
  });
});

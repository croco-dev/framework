import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { GoalProgress, NextActionCard } from "../libs/GoalProgress";
import type { GoalProgress as GoalProgressResult } from "@croco/onboarding-core";

const progress: GoalProgressResult = {
  episode: {
    id: "signup-1",
    scope: { tenantId: "tenant", appId: "app", environmentId: "test" },
    subject: { id: "user", verified: true },
    definitionId: "first-report",
    definitionVersion: "v1",
    actionId: "report.saved",
    startedAt: new Date("2026-09-28T00:00:00Z"),
    endsAt: new Date("2026-10-05T00:00:00Z"),
    allowedLatenessMs: 86_400_000,
    timezone: "Asia/Seoul",
    countMode: "events",
    threshold: 1,
    deletedObjectPolicy: "retain",
    progress: 0,
    status: "in_progress",
  },
  progress: 0,
  threshold: 1,
  remaining: 1,
  status: "in_progress",
  title: "Save a report",
  nextActionHref: "/reports/new",
};

describe("Goal progress UI", () => {
  it("renders an actual server progress result and the next action link", () => {
    const markup = renderToStaticMarkup(h(GoalProgress, { state: { kind: "ready", progress } }));
    expect(markup).toContain("0 of 1");
    expect(markup).toContain("Save a report");
    expect(markup).toContain("<progress");
    expect(renderToStaticMarkup(h(NextActionCard, { progress }))).toContain('href="/reports/new"');
  });

  it("keeps closing separate from expiry and hides next action after achievement", () => {
    expect(
      renderToStaticMarkup(
        h(GoalProgress, {
          state: {
            kind: "ready",
            progress: {
              ...progress,
              episode: { ...progress.episode, status: "closing" },
              status: "closing",
            },
          },
        }),
      ),
    ).toContain("Checking recent activity");
    expect(
      renderToStaticMarkup(
        h(NextActionCard, {
          progress: { ...progress, status: "achieved" },
        }),
      ),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        h(NextActionCard, {
          progress: { ...progress, status: "closing" },
        }),
      ),
    ).toBe("");
  });

  it.each(["loading", "empty"] as const)("renders %s without inventing completion", (kind) => {
    expect(renderToStaticMarkup(h(GoalProgress, { state: { kind } }))).not.toContain(
      "Goal achieved",
    );
  });

  it.each(["denied", "error"] as const)("renders %s with recovery", (kind) => {
    const markup = renderToStaticMarkup(
      h(GoalProgress, {
        state: { kind, message: "Cannot load progress", retry: () => undefined },
      }),
    );
    expect(markup).toContain("Cannot load progress");
    expect(markup).toContain("Try again");
  });

  it("renders partial evidence explicitly", () => {
    const markup = renderToStaticMarkup(
      h(GoalProgress, {
        state: { kind: "partial", progress, message: "Recent action still being checked" },
      }),
    );
    expect(markup).toContain("Recent action still being checked");
    expect(markup).toContain('aria-busy="true"');
  });
});

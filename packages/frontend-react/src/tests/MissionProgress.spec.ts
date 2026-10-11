import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressCard, StreakCalendar, AchievementToast } from "../libs/MissionProgress";
import type { MissionProgress } from "@croco/gamification-core";
const progress: MissionProgress = {
  key: {
    scope: { tenantId: "t", appId: "a", environmentId: "test" },
    subjectId: "member",
    missionId: "reports",
    version: 1,
    episodeId: "initial",
    periodKey: "2026-10-05",
  },
  definition: {
    id: "reports",
    version: 1,
    actionId: "report.saved",
    countMode: "events",
    unit: "event",
    timezone: "UTC",
    period: "week",
    anchor: "2026-10-05",
    target: 3,
    perPeriodCap: 3,
    lateAcceptanceMs: 1000,
    closedCorrection: "record-only",
  },
  instance: {
    periodKey: "2026-10-05",
    startDate: "2026-10-05",
    endDate: "2026-10-12",
    progress: 1,
    state: "active",
    activityDates: ["2026-10-06"],
  },
  remaining: 2,
};
describe("Personal mission surfaces", () => {
  it("labels cached achieved progress as last confirmed while a refresh is unavailable", () => {
    const cached: MissionProgress = {
      ...progress,
      instance: { ...progress.instance, state: "achieved", progress: 3 },
      remaining: 0,
    };
    const state = { kind: "partial" as const, progress: cached, message: "Refresh unavailable" };
    expect(renderToStaticMarkup(h(ProgressCard, { state }))).toContain(
      "Last confirmed: Mission achieved",
    );
    expect(renderToStaticMarkup(h(ProgressCard, { state }))).toContain("Refresh unavailable");
    expect(renderToStaticMarkup(h(AchievementToast, { state }))).toBe("");
  });
  it("shows authoritative progress and explicit episode identity", () => {
    const output = renderToStaticMarkup(h(ProgressCard, { state: { kind: "ready", progress } }));
    expect(output).toContain("1 of 3");
    expect(output).toContain("Version 1 · Episode initial");
    expect(output).toContain("In progress");
    expect(output).not.toContain("failed");
    expect(
      renderToStaticMarkup(h(StreakCalendar, { state: { kind: "ready", progress } })),
    ).toContain("2026-10-06");
  });
  it.each(["loading", "empty", "denied", "error", "partial"] as const)(
    "never celebrates %s",
    (kind) => {
      const state =
        kind === "partial"
          ? { kind, progress }
          : kind === "denied" || kind === "error"
            ? { kind, message: "Unavailable" }
            : { kind };
      expect(renderToStaticMarkup(h(AchievementToast, { state }))).toBe("");
      expect(renderToStaticMarkup(h(ProgressCard, { state }))).not.toContain("Mission achieved");
    },
  );
  it("requires current achievement and a server completion before announcing success", () => {
    expect(
      renderToStaticMarkup(
        h(AchievementToast, {
          state: {
            kind: "ready",
            progress: { ...progress, instance: { ...progress.instance, state: "achieved" } },
          },
        }),
      ),
    ).toBe("");
    const completed = {
      ...progress,
      instance: {
        ...progress.instance,
        state: "achieved" as const,
        progress: 3,
        completion: {
          id: "c",
          periodKey: "2026-10-05",
          achievedAt: "2026-10-07T12:00:00Z",
          eventId: "e",
        },
      },
    };
    expect(
      renderToStaticMarkup(h(AchievementToast, { state: { kind: "ready", progress: completed } })),
    ).toContain("Mission achieved");
    expect(
      renderToStaticMarkup(
        h(AchievementToast, {
          state: {
            kind: "ready",
            progress: { ...completed, instance: { ...completed.instance, state: "closed" } },
          },
        }),
      ),
    ).toBe("");
  });
});

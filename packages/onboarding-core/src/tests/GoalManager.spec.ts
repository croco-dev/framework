import "reflect-metadata";
import type { AnalyticsManager } from "@croco/analytics-core";
import { Context } from "@croco/framework-context";
import { describe, expect, it, vi } from "vitest";
import { OnboardingManager } from "../libs/OnboardingManager";
import { InMemoryOnboardingStore } from "../libs/OnboardingStore";
import { GoalManager } from "../libs/goals/GoalManager";
import { InMemoryGoalStore } from "../libs/goals/GoalStore";
import { validateGoalDefinition } from "../libs/goals/validateGoalDefinition";
import type {
  ActionReceipt,
  GoalCountMode,
  GoalDefinition,
  GoalDefinitionPublication,
  GoalEpisode,
  GoalScope,
  GoalSubject,
} from "../libs/goals/types";

const scope: GoalScope = { tenantId: "tenant", appId: "app", environmentId: "test" };
const subject: GoalSubject = { id: "user", verified: true };
const start = new Date("2026-09-01T00:00:00.000Z");

function definition(countMode: GoalCountMode = "events"): GoalDefinition {
  return {
    id: "first-report",
    version: "v1",
    anchor: "signup",
    actionId: "report.saved",
    windowMs: 7 * 24 * 60 * 60 * 1000,
    allowedLatenessMs: 24 * 60 * 60 * 1000,
    timezone: "America/Los_Angeles",
    countMode,
    threshold: 3,
    deletedObjectPolicy: "retract",
    title: "Save reports",
    nextActionHref: "/reports/new",
  };
}

function publication(value: GoalDefinition, revision = 1): GoalDefinitionPublication {
  return {
    scope,
    definition: value,
    revision,
    actorId: "operator",
    reason: "Activation policy",
    idempotencyKey: `publish-${revision}`,
    publishedAt: start,
  };
}

function receipt(eventId: string, occurredAt = start, objectId?: string): ActionReceipt {
  return {
    eventId,
    actionId: "report.saved",
    occurredAt,
    objectId,
    confirmation: { source: "server", evidenceId: `domain-${eventId}` },
  };
}

function harness(mode: GoalCountMode = "events") {
  const store = new InMemoryGoalStore();
  const verify = vi.fn(async () => {});
  const authorize = vi.fn(async () => true);
  const manager = new GoalManager(store, { verify }, { authorize }, { verify: async () => true });
  const publish = () => manager.publishDefinition(publication(definition(mode)));
  const begin = (id = "episode-1") =>
    manager.beginEpisode({
      id,
      scope,
      subject,
      definitionId: "first-report",
      anchor: "signup",
      startedAt: start,
    });
  const observe = (value: ActionReceipt, receivedAt = value.occurredAt) =>
    manager.observeAction({
      scope,
      subject,
      episodeId: "episode-1",
      receipt: value,
      receivedAt,
    });
  return { store, manager, verify, authorize, publish, begin, observe };
}

describe("GoalManager", () => {
  it.each([
    ["events", 3],
    ["distinct_objects", 2],
    ["distinct_calendar_days", 1],
  ] as const)("counts three same-day actions in %s mode as %i", async (mode, expected) => {
    const { publish, begin, observe } = harness(mode);
    await publish();
    await begin();
    await observe(receipt("event-1", start, "report-1"));
    await observe(receipt("event-2", new Date(start.getTime() + 1000), "report-1"));
    const third = await observe(receipt("event-3", new Date(start.getTime() + 2000), "report-2"));
    expect(third.episode.progress).toBe(expected);
    expect(third.status).toBe("recorded");
    expect(third.achievedEvent !== undefined).toBe(mode === "events");
    const duplicate = await observe(
      receipt("event-3", new Date(start.getTime() + 2000), "report-2"),
    );
    expect(duplicate.status).toBe("duplicate");
    expect(duplicate.episode.progress).toBe(expected);
  });

  it("freezes the first version and starts a separate return episode", async () => {
    const { manager, publish, begin } = harness();
    await publish();
    const first = (await begin()).episode;
    const next = {
      ...definition(),
      version: "v2",
      anchor: "return" as const,
      threshold: 5,
      windowMs: 1000,
      timezone: "UTC",
    };
    await manager.publishDefinition(publication(next, 2));
    const same = (await begin()).episode;
    const returned = (
      await manager.beginEpisode({
        id: "episode-return",
        scope,
        subject,
        definitionId: "first-report",
        anchor: "return",
        startedAt: start,
      })
    ).episode;
    expect(same).toEqual(first);
    expect(returned).toMatchObject({ definitionVersion: "v2", threshold: 5, timezone: "UTC" });
    expect(returned.endsAt.getTime() - returned.startedAt.getTime()).toBe(1000);
  });

  it("replays a publication key without changing its stored publication time", async () => {
    const { manager, publish } = harness();
    const first = await publish();
    const replay = await manager.publishDefinition({
      ...publication(definition()),
      publishedAt: new Date(start.getTime() + 1000),
    });
    expect(replay).toEqual({ status: "duplicate", publication: first.publication });
    await expect(
      manager.publishDefinition({
        ...publication({ ...definition(), threshold: 4 }),
        publishedAt: new Date(start.getTime() + 1000),
      }),
    ).rejects.toMatchObject({ code: "onboarding/goal-conflict" });
  });

  it("uses publication keys independently for separate goal definitions", async () => {
    const { manager } = harness();
    await manager.publishDefinition(publication(definition()));
    const second = await manager.publishDefinition(
      publication({ ...definition(), id: "second-goal" }),
    );
    expect(second.status).toBe("published");
  });

  it("keeps the window half-open, closes during lateness, and preserves late corrections without achievement", async () => {
    const { manager, publish, begin, observe } = harness();
    await publish();
    const episode = (await begin()).episode;
    await expect(observe(receipt("at-end", episode.endsAt))).rejects.toMatchObject({
      code: "onboarding/goal-receipt-invalid",
    });
    await observe(receipt("event-1", start));
    const closing = await manager.getProgress({
      scope,
      subject,
      episodeId: episode.id,
      asOf: episode.endsAt,
    });
    expect(closing.status).toBe("closing");
    const withinGrace = await observe(
      receipt("event-2", new Date(episode.endsAt.getTime() - 1)),
      new Date(episode.endsAt.getTime() + 1),
    );
    expect(withinGrace.episode.progress).toBe(2);
    const lateAt = new Date(episode.endsAt.getTime() + episode.allowedLatenessMs + 1);
    const late = await observe(receipt("event-3", start), lateAt);
    expect(late.status).toBe("late_correction");
    expect(late.episode.progress).toBe(2);
    expect(
      (await manager.getProgress({ scope, subject, episodeId: episode.id, asOf: lateAt })).status,
    ).toBe("expired");
  });

  it("requires server verification and rejects unauthorized policy publication", async () => {
    const store = new InMemoryGoalStore();
    const manager = new GoalManager(
      store,
      {
        verify: async () => {
          throw new Error("domain rollback");
        },
      },
      { authorize: async () => true },
      { verify: async () => true },
    );
    await manager.publishDefinition(publication(definition()));
    await manager.beginEpisode({
      id: "episode-1",
      scope,
      subject,
      definitionId: "first-report",
      anchor: "signup",
      startedAt: start,
    });
    await expect(
      manager.observeAction({
        scope,
        subject,
        episodeId: "episode-1",
        receipt: receipt("event-1"),
        receivedAt: start,
      }),
    ).rejects.toThrow("domain rollback");
    expect((await store.getEpisode({ scope, subject, episodeId: "episode-1" }))?.progress).toBe(0);
    const denied = new GoalManager(
      store,
      { verify: async () => {} },
      { authorize: async () => false },
      { verify: async () => true },
    );
    await expect(
      denied.publishDefinition(publication({ ...definition(), version: "v2" }, 2)),
    ).rejects.toMatchObject({
      code: "onboarding/goal-authorization-denied",
    });
  });

  it("rejects a spoofed verified marker when server subject verification denies access", async () => {
    const store = new InMemoryGoalStore();
    const manager = new GoalManager(
      store,
      { verify: async () => {} },
      { authorize: async () => true },
      { verify: async () => false },
    );
    await manager.publishDefinition(publication(definition()));
    await expect(
      manager.beginEpisode({
        id: "episode-1",
        scope,
        subject,
        definitionId: "first-report",
        anchor: "signup",
        startedAt: start,
      }),
    ).rejects.toMatchObject({ code: "onboarding/goal-authorization-denied" });
    expect(await store.getEpisode({ scope, subject, episodeId: "episode-1" })).toBeNull();
  });

  it("retracts a recorded event and prevents reuse of an event ID with different evidence", async () => {
    const { manager, publish, begin, observe } = harness();
    await publish();
    await begin();
    await observe(receipt("event-1", start, "report-1"));
    const corrected = await manager.observeAction({
      scope,
      subject,
      episodeId: "episode-1",
      receivedAt: new Date(start.getTime() + 1000),
      receipt: {
        eventId: "correction-1",
        actionId: "report.saved",
        occurredAt: start,
        confirmation: { source: "server", evidenceId: "rollback-1" },
        correction: { kind: "retract_event", targetEventId: "event-1" },
      },
    });
    expect(corrected.episode.progress).toBe(0);
    await expect(
      observe(receipt("event-1", new Date(start.getTime() + 1000), "report-1")),
    ).rejects.toMatchObject({ code: "onboarding/goal-conflict" });
  });

  it("uses the episode timezone for calendar days and retracts a deleted object", async () => {
    const { manager, publish, begin, observe } = harness("distinct_calendar_days");
    await publish();
    await begin();
    await observe(receipt("event-1", new Date("2026-09-01T06:59:00.000Z"), "report-1"));
    const nextDay = await observe(
      receipt("event-2", new Date("2026-09-01T07:01:00.000Z"), "report-2"),
    );
    expect(nextDay.episode.progress).toBe(2);
    const deleted = await manager.observeAction({
      scope,
      subject,
      episodeId: "episode-1",
      receivedAt: new Date("2026-09-01T07:02:00.000Z"),
      receipt: {
        eventId: "delete-1",
        actionId: "report.saved",
        occurredAt: new Date("2026-09-01T07:02:00.000Z"),
        confirmation: { source: "server", evidenceId: "domain-delete-1" },
        correction: { kind: "delete_object", objectId: "report-2" },
      },
    });
    expect(deleted.episode.progress).toBe(1);
  });

  it("lets only one concurrent final receipt create an achieved event", async () => {
    const { publish, begin, observe } = harness();
    await publish();
    await begin();
    await observe(receipt("event-1"));
    await observe(receipt("event-2", new Date(start.getTime() + 1000)));
    const results = await Promise.all([
      observe(receipt("event-3", new Date(start.getTime() + 2000))),
      observe(receipt("event-4", new Date(start.getTime() + 3000))),
    ]);
    expect(results.filter((result) => result.achievedEvent)).toHaveLength(1);
    expect(results.at(-1)?.episode.progress).toBe(4);
  });

  it("validates timezone and guidance links with stable Problems", () => {
    expect(() => validateGoalDefinition({ ...definition(), timezone: "Invalid/Zone" })).toThrow(
      expect.objectContaining({ code: "onboarding/goal-definition-invalid" }),
    );
    expect(() =>
      validateGoalDefinition({
        ...definition(),
        guidanceSteps: [{ id: "intro", title: "Intro", href: "javascript:alert(1)" }],
      }),
    ).toThrow(expect.objectContaining({ code: "onboarding/goal-definition-invalid" }));
  });

  it("rejects an episode window that overflows the Date range", async () => {
    const { manager } = harness();
    await manager.publishDefinition(
      publication({
        ...definition(),
        windowMs: 8_640_000_000_000_000,
      }),
    );
    await expect(
      manager.beginEpisode({
        id: "episode-1",
        scope,
        subject,
        definitionId: "first-report",
        anchor: "signup",
        startedAt: start,
      }),
    ).rejects.toMatchObject({ code: "onboarding/goal-context-invalid" });
  });

  it("bridges an achieved goal to an explicitly registered checklist step", async () => {
    const { publish, begin, observe } = harness();
    const checklist = new OnboardingManager(new InMemoryOnboardingStore(), {
      capture: vi.fn(),
    } as unknown as AnalyticsManager);
    checklist.register({ id: "welcome", steps: [{ id: "first-report", title: "Save a report" }] });
    checklist.registerGoalStepBridge({
      scope,
      goalDefinitionId: "first-report",
      onboardingId: "welcome",
      stepId: "first-report",
    });
    await publish();
    await begin();
    await observe(receipt("event-1"));
    await observe(receipt("event-2", new Date(start.getTime() + 1000)));
    const achieved = await observe(receipt("event-3", new Date(start.getTime() + 2000)));
    expect(achieved.achievedEvent).toBeDefined();
    await Context.run(
      { requestId: "bridge", tenantId: "tenant", user: { id: "user" } },
      async () => {
        expect(await checklist.handleGoalAchieved(achieved.achievedEvent!)).toBe(true);
        expect(await checklist.handleGoalAchieved(achieved.achievedEvent!)).toBe(true);
        expect((await checklist.getStatus("welcome")).isCompleted).toBe(true);
      },
    );
  });
});

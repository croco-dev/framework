import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionConsole } from "../libs/MissionConsole";
import type { MissionPublication } from "@croco/gamification-core";
const scope = { tenantId: "t", appId: "a", environmentId: "test" };
const publication: MissionPublication = {
  scope,
  actorId: "operator",
  reason: "Initial",
  revision: 1,
  idempotencyKey: "initial",
  publishedAt: "2026-10-08T00:00:00Z",
  definition: {
    id: "report",
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
};
const props = {
  access: { scope, actorId: "operator", permissions: ["mission.publish"] },
  registeredActions: ["report.saved"],
  onPublish: async () => publication,
};
describe("Mission console states", () => {
  it.each(["loading", "empty", "denied", "error"] as const)(
    "renders %s without publication controls",
    (kind) => {
      const state =
        kind === "error" || kind === "denied" ? { kind, message: "Unavailable" } : { kind };
      expect(renderToStaticMarkup(h(MissionConsole, { ...props, state }))).not.toContain(
        "Publish new version",
      );
    },
  );
  it("uses labelled native controls and keeps past versions explicit", () => {
    const html = renderToStaticMarkup(
      h(MissionConsole, { ...props, state: { kind: "ready", publication } }),
    );
    expect(html).toContain("<select");
    expect(html).toContain("Publication reason");
    expect(html).toContain("Past progress stays unchanged");
    expect(html).toContain("report.saved");
  });
  it("disables edits without publish permission", () => {
    const html = renderToStaticMarkup(
      h(MissionConsole, {
        ...props,
        access: { ...props.access, permissions: [] },
        state: { kind: "ready", publication },
      }),
    );
    expect(html).toContain('<fieldset disabled=""');
  });
});

it("resets editor identity across mission, actor, and version changes at the same revision", () => {
  const state = { kind: "ready" as const, publication };
  const original = MissionConsole({ ...props, state });
  const otherMission = MissionConsole({
    ...props,
    state: {
      ...state,
      publication: { ...publication, definition: { ...publication.definition, id: "other" } },
    },
  });
  const otherActor = MissionConsole({
    ...props,
    access: { ...props.access, actorId: "other-operator" },
    state,
  });
  const otherVersion = MissionConsole({
    ...props,
    state: {
      ...state,
      publication: { ...publication, definition: { ...publication.definition, version: 2 } },
    },
  });
  expect(otherMission.key).not.toEqual(original.key);
  expect(otherActor.key).not.toEqual(original.key);
  expect(otherVersion.key).not.toEqual(original.key);
});

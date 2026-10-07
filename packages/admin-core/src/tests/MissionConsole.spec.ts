import { describe, expect, it } from "vitest";
import { assertMissionPublication, MissionConsoleInvalidProblem } from "../libs/MissionConsole";
import type { MissionPublication } from "@croco/gamification-core";
const scope = { tenantId: "tenant", appId: "app", environmentId: "test" };
const access = { scope, actorId: "operator", permissions: ["mission.publish"] };
const publication: MissionPublication = {
  scope,
  actorId: "operator",
  reason: "Return goal",
  revision: 2,
  idempotencyKey: "key",
  publishedAt: "2026-10-08T00:00:00Z",
  definition: {
    id: "report",
    version: 2,
    actionId: "report.saved",
    countMode: "events",
    unit: "event",
    timezone: "UTC",
    period: "week",
    anchor: "2026-10-05",
    target: 1,
    perPeriodCap: 3,
    lateAcceptanceMs: 1000,
    closedCorrection: "record-only",
  },
};
describe("Mission console boundary", () => {
  it("accepts audited code-registered publication", () =>
    expect(() => assertMissionPublication(publication, access, ["report.saved"])).not.toThrow());
  it("denies scope, actor and permission forgery", () => {
    expect(() =>
      assertMissionPublication({ ...publication, scope: { ...scope, tenantId: "other" } }, access, [
        "report.saved",
      ]),
    ).toThrow();
    expect(() =>
      assertMissionPublication({ ...publication, actorId: "forged" }, access, ["report.saved"]),
    ).toThrow();
    expect(() =>
      assertMissionPublication(publication, { ...access, permissions: [] }, ["report.saved"]),
    ).toThrow();
  });
  it("requires registered action, bounded values and audit context", () => {
    expect(() => assertMissionPublication(publication, access, [])).toThrow();
    expect(() =>
      assertMissionPublication({ ...publication, reason: "" }, access, ["report.saved"]),
    ).toThrow();
    expect(() =>
      assertMissionPublication(
        { ...publication, definition: { ...publication.definition, perPeriodCap: 0 } },
        access,
        ["report.saved"],
      ),
    ).toThrow();
  });
});

it.each([
  null,
  undefined,
  { ...publication, actorId: 7 },
  { ...publication, scope: null },
  { ...publication, publishedAt: 7 },
])("rejects malformed publication as stable Problem", (value) => {
  expect(() =>
    assertMissionPublication(value as unknown as MissionPublication, access, ["report.saved"]),
  ).toThrow(MissionConsoleInvalidProblem);
});

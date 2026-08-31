import { EngagementPersistenceProblem } from "@croco/engagement-core";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  createEngagementSchema,
  engagementContactEndpoints,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
} from "../index";

describe("engagement Drizzle schema", () => {
  it("declares every durable engagement surface with stable table names", () => {
    expect(
      [
        engagementContactEndpoints,
        engagementPreferences,
        engagementSuppressions,
        engagementDispatches,
        engagementDispatchTargets,
        engagementDeliveryEvents,
      ].map(getTableName),
    ).toEqual([
      "engagement_contact_endpoints",
      "engagement_preferences",
      "engagement_suppressions",
      "engagement_dispatches",
      "engagement_dispatch_targets",
      "engagement_delivery_events",
    ]);
  });

  it("redacts driver details from migration Problems", async () => {
    const driverDetail = "postgres://credential@internal/engagement";
    const failure = await createEngagementSchema({
      execute: () => Promise.reject(new Error(driverDetail)),
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EngagementPersistenceProblem);
    expect(JSON.stringify((failure as EngagementPersistenceProblem).toJSON())).not.toContain(
      driverDetail,
    );
  });
});

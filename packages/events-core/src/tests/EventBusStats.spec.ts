import { describe, expect, it } from "vitest";
import { EventBusStats } from "../libs/EventBusStats";

describe("EventBusStats", () => {
  it("should track successful, failed, and dropped publishes in disjoint buckets", () => {
    const stats = new EventBusStats();

    stats.publish(false);
    stats.publish(false);
    stats.publish(true);
    stats.drop();
    stats.drop();
    stats.drop();

    expect(stats.getStats()).toEqual({
      publishedCount: 2,
      failCount: 1,
      droppedPublishCount: 3,
    });
  });
});
